import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync, cpSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

/**
* 工具参数定义(属性映射 + required 标记)转标准 JSON Schema。
* DSH 把注册的 tool.parameters 原样透传给 LLM provider(无规范化),必须是
* { type: 'object', properties, required? } 标准形状,否则 provider 会拒绝
* (type: null 类错误,导致无法输入)。
*/
function toJsonSchema(params) {
	const properties = {};
	const required = [];
	for (const [key, def] of Object.entries(params)) {
		const { required: req, ...rest } = def;
		properties[key] = rest;
		if (req === true) required.push(key);
	}
	return {
		type: "object",
		properties,
		...(required.length > 0 ? { required } : {})
	};
}

//#region esbuild decorator helpers (standard output shape for @Remote markers)
var __runInitializers = function (thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function (f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
//#endregion

/** GitHub API bases tried in order: env override first, then official, then public mirrors. */
const GITHUB_API_DEFAULT = "https://api.github.com";
const GITHUB_API_MIRRORS = [
	"https://ghproxy.net/https://api.github.com",
	"https://ghfast.top/https://api.github.com"
];
/** npm registry search endpoints (reliable fallbacks, npmmirror is mainland-China friendly). */
const NPM_SEARCH_DEFAULT = "https://registry.npmjs.org/-/v1/search";
const NPM_SEARCH_MIRROR = "https://registry.npmmirror.com/-/v1/search";
/** GitHub topic that marks DSH plugin repositories. */
const CATALOG_TOPIC = "topic:dsh-plugin";
/** GitHub repo-name search that catches plugin repos without the topic tag. */
const CATALOG_NAME_QUERY = "dsh-plugin in:name";
/** The community-curated awesome-dsh-plugin list (owner/repo holding the README). */
const AWESOME_LIST_OWNER = "awesome-dsh-plugin";
const AWESOME_LIST_REPO = "awesome-dsh-plugin";
/**
* The awesome list's entry bullet shape, e.g.
* `- [owner/repo](https://github.com/owner/repo) - one-line description`.
* Monorepo entries carry a `#subpackage` suffix on the label, and their URL
* points into the repo tree (`.../tree/main/packages/<sub>`).
*/
const AWESOME_ENTRY_RE = /^\s*[-*]\s+\[([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:#([A-Za-z0-9_.-]+))?\]\((https?:\/\/[^)]+)\)\s*(?:-\s*(.*))?$/;
/** How many pages of the topic search are fetched (100 repos each). */
const GITHUB_PAGES = 5;
/** npm search texts: broad queries so naming variants are not missed. */
const NPM_SEARCH_QUERIES = ["dsh-plugin", "dsh", "deepseek-harness"];
/** npm search page size (registry maximum is 250). */
const NPM_SEARCH_SIZE = 250;
/** npm registry endpoint used to decide whether a repo name is an installable package. */
const NPM_REGISTRY_URL = "https://registry.npmjs.org";
/** How long one catalog view stays fresh before the next fetch. */
const CATALOG_TTL_MS = 5 * 60 * 1000;
/** How long GitHub search is skipped after a 403/429 rate limit. */
const GITHUB_COOLDOWN_MS = 10 * 60 * 1000;
/** How many repo-verification probes run in parallel. */
const VERIFY_CONCURRENCY = 12;
/** Upper bound on repo-verification probes per catalog fetch. */
const VERIFY_MAX_ENTRIES = 150;
/** How many timestamped backup snapshots are kept. */
const BACKUP_KEEP = 20;
/** How long a pnpm install may run before it is killed. */
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;
/** How long one catalog source may take before the chain moves on. */
const FETCH_TIMEOUT_MS = 10 * 1000;
/** Env override: a full GitHub API base URL (e.g. a working mirror) tried first. */
const GITHUB_API_ENV = "DSH_PLUGIN_MARKET_GITHUB_API";
/** Disk cache file name inside the active profile directory. */
const DISK_CACHE_FILENAME = ".plugin-market-cache.json";
/** Favorites persistence file inside the active profile directory (survives restarts). */
const FAVORITES_FILENAME = ".kidai-favorites.json";
/** The profile's user patch layer (id-targeted overrides and inserts). */
const PROFILE_PATCH_FILENAME = "cordis.patch.yml";
/** Only plain npm package names / GitHub repos may cross the install boundary. */
const NPM_SPEC_PATTERN = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
const GITHUB_REPO_PATTERN = /^(?:https?:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/;
/** A monorepo subpackage install spec (`owner/repo#subpackage`). */
const GITHUB_SUB_PATTERN = /^(?:https?:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#([A-Za-z0-9_.-]+)$/;

/** Normalize one GitHub search item into the catalog entry shape. */
function entryOf(repo) {
	return {
		id: typeof repo.full_name === "string" ? repo.full_name : String(repo.id ?? ""),
		name: typeof repo.name === "string" ? repo.name : "",
		owner: typeof repo.owner?.login === "string" ? repo.owner.login : "",
		description: typeof repo.description === "string" ? repo.description : "",
		iconUrl: typeof repo.owner?.avatar_url === "string" ? repo.owner.avatar_url : "",
		url: typeof repo.html_url === "string" ? repo.html_url : `https://github.com/${repo.full_name}`,
		homepage: typeof repo.homepage === "string" && repo.homepage.length > 0 ? repo.homepage : "",
		topics: Array.isArray(repo.topics) ? repo.topics.filter((topic) => typeof topic === "string").slice(0, 6) : [],
		stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
		updatedAt: typeof repo.updated_at === "string" ? repo.updated_at : ""
	};
}

/** Whether an npm package name follows the DSH plugin naming conventions. */
function isPluginPackage(name) {
	return /^dsh-plugin-/i.test(name)
		|| /^dsh-[a-z0-9]/i.test(name)
		|| /^@[^/]+\/dsh-plugin-/i.test(name)
		|| /deepseek[-_ ]?harness[-_ ]?plugin/i.test(name);
}

/** Normalize one npm search result into the catalog entry shape. */
function npmEntryOf(pkg) {
	const links = pkg?.links ?? {};
	let repository = typeof links.repository === "string" ? links.repository : "";
	if (repository === "" && links.repository !== null && typeof links.repository === "object") repository = String(links.repository.url ?? "");
	const homepage = typeof links.homepage === "string" ? links.homepage : "";
	const githubUrl = repository !== "" && /github\.com/.test(repository) ? repository.replace(/^git\+/, "") : "";
	return {
		id: pkg.name,
		name: pkg.name,
		owner: "",
		description: typeof pkg.description === "string" ? pkg.description : "",
		iconUrl: "",
		url: githubUrl !== "" ? githubUrl : homepage !== "" ? homepage : `https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}`,
		homepage,
		topics: [],
		stars: 0,
		updatedAt: typeof pkg.date === "string" ? pkg.date : ""
	};
}

/** npm registry mirror used as a fallback existence check (mainland-China friendly). */
const NPM_REGISTRY_MIRROR_URL = "https://registry.npmmirror.com";
/** How long one spec-resolution probe (package.json / registry HEAD) may take. */
const PROBE_TIMEOUT_MS = 6 * 1000;

/** Whether a package name exists on the official registry or the npmmirror mirror. */
async function npmExists(name) {
	for (const base of [NPM_REGISTRY_URL, NPM_REGISTRY_MIRROR_URL]) {
		try {
			const response = await fetch(`${base}/${encodeURIComponent(name)}`, {
				method: "HEAD",
				headers: { "User-Agent": "kidai-plugin-market-hub" },
				signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
			});
			if (response.ok) return true;
		} catch {
			/* try the next registry */
		}
	}
	return false;
}

/** Try to read a repo's declared package name from its package.json (CDN first). */
async function repoPackageName(owner, repo) {
	const manifest = await fetchRepoManifest(owner, repo);
	return manifest !== null && typeof manifest.name === "string" && manifest.name.length > 0 ? manifest.name : null;
}

/** The CDN-first URL chain used to read one repo file without API quota.
* Includes China-friendly GitHub mirrors so catalog/audit/install keep working
* when api.github.com / raw.githubusercontent are unreachable directly. */
function repoFileUrls(owner, repo, file) {
	return [
		`https://cdn.jsdelivr.net/gh/${owner}/${repo}@HEAD/${file}`,
		`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`,
		`https://ghproxy.net/https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`,
		`https://ghfast.top/https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`
	];
}

/** Fetch one repo file (package.json / README) through the CDN-first chain. */
async function fetchRepoFile(owner, repo, file, maxBytes = 256 * 1024) {
	for (const url of repoFileUrls(owner, repo, file)) {
		try {
			const response = await fetch(url, {
				headers: { "User-Agent": "kidai-plugin-market-hub" },
				signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
			});
			if (!response.ok) continue;
			const buffer = Buffer.from(await response.arrayBuffer());
			if (buffer.length === 0 || buffer.length > maxBytes) continue;
			return buffer;
		} catch {
			/* try the next source */
		}
	}
	return null;
}

/**
* Fetch one repo file with ALL mirror sources in parallel, returning the first
* successful response (or null when every source fails). Used by the catalog
* verification probes where the serial chain would multiply the slowest
* source's latency across hundreds of repos; the parallel probe finishes in
* roughly the fastest success time or, on total failure, the slowest timeout.
*/
async function fetchRepoFileParallel(owner, repo, file, maxBytes = 256 * 1024) {
	const urls = repoFileUrls(owner, repo, file);
	const attempts = urls.map(async (url) => {
		const response = await fetch(url, {
			headers: { "User-Agent": "kidai-plugin-market-hub" },
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const buffer = Buffer.from(await response.arrayBuffer());
		if (buffer.length === 0 || buffer.length > maxBytes) throw new Error("oversized");
		return buffer;
	});
	const settled = await Promise.allSettled(attempts);
	for (const outcome of settled) if (outcome.status === "fulfilled") return outcome.value;
	return null;
}

/** Parse a repo's package.json (null when unavailable/invalid). */
async function fetchRepoManifest(owner, repo) {
	const buffer = await fetchRepoFile(owner, repo, "package.json", 64 * 1024);
	if (buffer === null) return null;
	try {
		const parsed = JSON.parse(buffer.toString("utf8"));
		return parsed !== null && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

/**
* Whether a repo is a real DSH plugin: its package.json declares
* `dsh.bundle` / `dsh.client`, or the repo ships a `cordis.patch.yml`.
* @returns `{ verified, hasDsh }`.
*/
async function verifyRepoPlugin(owner, repo) {
	const manifest = await fetchRepoFileParallel(owner, repo, "package.json", 64 * 1024);
	if (manifest !== null) {
		try {
			const parsed = JSON.parse(manifest.toString("utf8"));
			if (parsed !== null && typeof parsed === "object" && parsed.dsh !== null && typeof parsed.dsh === "object") {
				const dsh = parsed.dsh;
				if (dsh.bundle !== void 0 || dsh.client !== void 0) return { verified: true, hasDsh: true };
			}
		} catch {
			/* fall through to the patch probe */
		}
	}
	const patch = await fetchRepoFileParallel(owner, repo, "cordis.patch.yml", 64 * 1024);
	return { verified: patch !== null, hasDsh: patch !== null };
}

/** Fetch an npm package's `latest` manifest (version + repository), or null. */
async function npmRegistryLatest(name) {
	for (const base of [NPM_REGISTRY_URL, NPM_REGISTRY_MIRROR_URL]) {
		try {
			const response = await fetch(`${base}/${encodeURIComponent(name)}/latest`, {
				headers: { "User-Agent": "kidai-plugin-market-hub" },
				signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
			});
			if (!response.ok) continue;
			const manifest = await response.json();
			if (manifest === null || typeof manifest !== "object") return null;
			const repository = manifest.repository;
			let repositoryUrl = "";
			if (typeof repository === "string") repositoryUrl = repository;
			else if (repository !== null && typeof repository === "object" && typeof repository.url === "string") repositoryUrl = repository.url;
			return {
				version: typeof manifest.version === "string" ? manifest.version : "",
				repositoryUrl
			};
		} catch {
			/* try the next registry */
		}
	}
	return null;
}

/** Extract `owner/repo` from a GitHub URL-ish string ("" when not a GitHub repo). */
function githubRepoOf(url) {
	if (typeof url !== "string") return "";
	const match = /(?:github\.com[/:]|github:)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/.exec(url);
	if (match === null) return "";
	return `${match[1]}/${match[2].replace(/\.git$/, "")}`;
}

/**
* Parse the awesome-dsh-plugin README markdown into catalog entries.
* Standard bullets yield `owner/repo` entries; monorepo bullets
* (`owner/repo#subpackage`) yield entries named after the subpackage, with
* the id carrying the `#sub` suffix so both can coexist. TOC anchors and
* malformed lines are skipped. Entries are tagged `sourceTier: "AWESOME"`.
* @param text - the raw README markdown.
* @returns catalog entries (name-deduplicated, insertion order).
*/
function awesomeEntriesFromMarkdown(text) {
	const entries = [];
	const seen = /* @__PURE__ */ new Set();
	let category = "";
	for (const line of String(text ?? "").split(/\r?\n/)) {
		// `### Category` headings group the following bullets; the last seen
		// heading is attached to each entry so the client can group by category.
		const heading = /^###\s+(.+?)\s*$/.exec(line);
		if (heading !== null) {
			category = heading[1].trim();
			continue;
		}
		const match = AWESOME_ENTRY_RE.exec(line);
		if (match === null) continue;
		const [ , fullName, sub, url, description ] = match;
		const slash = fullName.indexOf("/");
		const owner = fullName.slice(0, slash);
		const name = typeof sub === "string" && sub.length > 0 ? sub : fullName.slice(slash + 1);
		if (owner.length === 0 || name.length === 0 || seen.has(name)) continue;
		seen.add(name);
		entries.push({
			id: sub ? `${fullName}#${sub}` : fullName,
			name,
			owner,
			description: typeof description === "string" ? description.trim() : "",
			iconUrl: "",
			url,
			homepage: "",
			topics: ["awesome-dsh-plugin"],
			stars: 0,
			updatedAt: "",
			sourceTier: "AWESOME",
			category
		});
	}
	return entries;
}

/**
* The awesome README's `### Category` headings, in list order — the client
* uses this to render the category-grouped awesome tab with the same order
* as the list itself.
* @param text - the raw README markdown.
* @returns category names (order-preserving, deduplicated).
*/
function awesomeCategoriesFromMarkdown(text) {
	const categories = [];
	const seen = /* @__PURE__ */ new Set();
	for (const line of String(text ?? "").split(/\r?\n/)) {
		const heading = /^###\s+(.+?)\s*$/.exec(line);
		if (heading === null) continue;
		const name = heading[1].trim();
		if (name.length === 0 || seen.has(name)) continue;
		seen.add(name);
		categories.push(name);
	}
	return categories;
}

/**
* Fetch the awesome-dsh-plugin README markdown. The CDN-first raw chain is
* tried first (same resilience as repo-file reads); when that fails and the
* GitHub API is not rate-limited (`apiAllowed`), the contents endpoint is
* used as a fallback.
* @param apiAllowed - whether the GitHub API fallback may be used.
* @returns the README text, or null when every source fails.
*/
async function fetchAwesomeReadme(apiAllowed) {
	const buffer = await fetchRepoFile(AWESOME_LIST_OWNER, AWESOME_LIST_REPO, "README.md", 2 * 1024 * 1024);
	if (buffer !== null) return buffer.toString("utf8");
	if (apiAllowed !== true) return null;
	for (const base of [GITHUB_API_DEFAULT, ...GITHUB_API_MIRRORS]) {
		try {
			const response = await fetch(`${base}/repos/${AWESOME_LIST_OWNER}/${AWESOME_LIST_REPO}/readme`, {
				headers: { "User-Agent": "kidai-plugin-market-hub", "Accept": "application/vnd.github.raw+json" },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
			});
			if (!response.ok) continue;
			const text = await response.text();
			if (text.length > 0) return text;
		} catch {
			/* try the next base */
		}
	}
	return null;
}

/**
* Decode raw README bytes picking the encoding that actually reads as Chinese:
* many repos store UTF-8 but serve it as GBK (or vice versa). A clean UTF-8
* decode is authoritative (GBK bytes almost always produce U+FFFD under UTF-8);
* only when UTF-8 fails do we fall back to the GBK-family score, so English
* READMEs with a stray arrow no longer get mojibake'd as "鈫扢".
* @returns `{ text, encoding }`.
*/
function decodeBytesBest(buffer) {
	const candidates = [];
	for (const [label, encoding] of [["utf-8", "utf-8"], ["gb18030", "gb18030"], ["gbk", "gbk"]]) {
		try {
			const text = new TextDecoder(encoding).decode(buffer);
			const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
			const replacements = (text.match(/\uFFFD/g) ?? []).length;
			candidates.push({ text, encoding: label, cjk, replacements });
		} catch {
			/* decoder unavailable — try the next */
		}
	}
	if (candidates.length === 0) return { text: buffer.toString("utf8"), encoding: "utf-8" };
	const utf8 = candidates.find((candidate) => candidate.encoding === "utf-8");
	if (utf8 !== void 0 && utf8.replacements === 0) return { text: utf8.text, encoding: "utf-8" };
	let best = null;
	for (const candidate of candidates) {
		const score = candidate.cjk * 2 - candidate.replacements;
		if (best === null || score > best.score) best = candidate;
	}
	return { text: best.text, encoding: best.encoding };
}

/** Render a market search result for model consumption. */
function renderMarketSearch(value) {
	const rows = (value.entries ?? []).map((entry) => `${entry.verified ? "[verified] " : ""}${entry.name} (${entry.owner}) ⭐${entry.stars ?? 0} — ${entry.description || entry.url}`);
	return `Kidai market search: ${value.count} results\n${rows.join("\n") || "(none)"}`;
}

/** Render an update list for model consumption. */
function renderMarketUpdates(updates) {
	if (!Array.isArray(updates) || updates.length === 0) return "所有已装插件均为最新。";
	return `可更新:\n${updates.map((entry) => `${entry.packageName}: ${entry.current} → ${entry.latest}`).join("\n")}`;
}

//#region static security audit (fail-closed, offline pattern scan)
/** Files never scanned: binaries, lockfiles, maps, vendor dirs, own artifacts. */
const AUDIT_SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "vendor", "images", "assets", ".github", ".idea", ".vscode", ".kidai-backups"]);
const AUDIT_SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".map", ".lock", ".tgz", ".zip", ".gz", ".md", ".json", ".yml", ".yaml", ".txt", ".html", ".css", ".d.ts"]);
const AUDIT_MAX_FILES = 300;
const AUDIT_MAX_BYTES = 6 * 1024 * 1024;
/**
* High-severity patterns that genuinely warrant a stop-and-think gate:
* dynamic execution, real credential-file access, shell-config tampering,
* overwriting another plugin's patch layer. Common-but-benign patterns
* (reading API-key env vars, lifecycle scripts, dotenv) are warnings below —
* flagging them as 高危 made ordinary plugins look malicious.
*/
const AUDIT_BLOCK_PATTERNS = [
	{ kind: "动态执行", re: /\beval\s*\(|\bnew\s+Function\s*\(|\bvm\.runIn(NewContext|ThisContext)|\brequire\(["']child_process["']\)\s*$/mi },
	{ kind: "凭据文件访问", re: /(?:id_rsa|id_ed25519|\.ssh[\\/]|\.aws[\\/]credentials|(?:^|[\\/'"\s])\.npmrc\b|(?:^|[\\/'"\s])\.netrc\b)/i },
	// Path-guarded: `\.profile` etc. must look like a real file path, not a JS
	// property access like `scanResult.profile` (a common false positive that
	// used to block perfectly normal plugins).
	{ kind: "改 shell 配置", re: /(?:^|[\\/'"\s])\.(?:bashrc|zshrc|bash_profile|profile)\b|(?:^|[\\/'"\s])\.gitconfig\b|\/\.config[\\/]fish/i },
	{ kind: "覆盖他人配置", re: /writeFileSync?\s*\([^)]*cordis\.patch\.yml|writeFile\s*\([^)]*cordis\.patch\.yml/i }
];
/** Medium-severity patterns: subprocess, network, file writes, obfuscation,
* API-key env reads and lifecycle scripts (the latter are additionally gated
* by pnpm's allowBuilds). Informational — never block the install. */
const AUDIT_WARN_PATTERNS = [
	{ kind: "子进程", re: /child_process|execSync|spawnSync|\.exec\s*\(|\.spawn\s*\(/i },
	{ kind: "网络请求", re: /https?:\/\/|fetch\s*\(|WebSocket|net\.connect/i },
	{ kind: "文件写入", re: /writeFileSync|createWriteStream|appendFile|unlinkSync|rmSync/i },
	{ kind: "混淆信号", re: /(?:fromCharCode|atob\s*\(\s*["'][A-Za-z0-9+/=]{40,}["']|Buffer\.from\s*\(\s*["'][A-Za-z0-9+/=]{40,}["']\s*,\s*["']base64["'])/i },
	{ kind: "读取密钥环境变量", re: /(?:DEEPSEEK|OPENAI|ANTHROPIC|GEMINI|MISTRAL|COHERE)_.{0,12}?(?:API_?KEY|TOKEN)|process\.env\.\w*(?:TOKEN|SECRET|PASSWORD|API_KEY)/i }
];
//#endregion

/** Cached github.com reachability probe (5 s HEAD; negative for ~5 min). */
let githubReachabilityCache = null;
async function githubReachable() {
	if (githubReachabilityCache !== null && Date.now() - githubReachabilityCache.at < 5 * 60 * 1000) {
		return githubReachabilityCache.ok;
	}
	let ok = false;
	try {
		const response = await fetch("https://github.com/", {
			method: "HEAD",
			redirect: "follow",
			signal: AbortSignal.timeout(5000)
		});
		ok = response.ok || response.status < 500;
	} catch {
		ok = false;
	}
	githubReachabilityCache = { ok, at: Date.now() };
	return ok;
}

/**
* Resolve an install spec to the exact package pnpm should install.
* 1) a bare npm name passes through; 2) a GitHub repo installs by the package
* name its own package.json declares (verified against a registry) when
* available; 3) a plugin-convention repo name on npm; 4) git clone fallback.
* Anti-squatting: an npm candidate is only used when its registry manifest's
* `repository` points back to the same GitHub repo — otherwise the install
* falls back to the git source so a squatter package is never installed.
* @param spec - repo full name (`owner/repo`), GitHub URL, or npm name.
* @returns `{ kind, spec, repo?, npmChecked?, squat? }` or null.
*/
async function resolveInstallSpec(spec) {
	const normalized = spec.trim();
	// Monorepo subpackage (`owner/repo#subpackage`): keep the sub name so the
	// install flow can fetch the repo tarball and install the inner package dir.
	const subMatch = GITHUB_SUB_PATTERN.exec(normalized);
	if (subMatch !== null) {
		const owner = subMatch[1];
		const repo = subMatch[2];
		const sub = subMatch[3];
		return { kind: "git", spec: `git+https://github.com/${owner}/${repo}.git`, repo: `${owner}/${repo}`, owner, repoName: repo, sub };
	}
	if (!GITHUB_REPO_PATTERN.test(normalized)) {
		return NPM_SPEC_PATTERN.test(normalized) ? { kind: "npm", spec: normalized } : null;
	}
	const match = GITHUB_REPO_PATTERN.exec(normalized);
	const owner = match[1];
	const repo = match[2];
	const repoFull = `${owner}/${repo}`;
	const declared = await repoPackageName(owner, repo);
	if (declared !== null && NPM_SPEC_PATTERN.test(declared) && await npmExists(declared)) {
		const latest = await npmRegistryLatest(declared);
		const matches = latest !== null && githubRepoOf(latest.repositoryUrl).toLowerCase() === repoFull.toLowerCase();
		if (matches) return { kind: "npm", spec: declared, repo: repoFull, npmChecked: true };
		return { kind: "git", spec: `git+https://github.com/${owner}/${repo}.git`, repo: repoFull, squat: true };
	}
	if (isPluginPackage(repo) && await npmExists(repo)) {
		const latest = await npmRegistryLatest(repo);
		const matches = latest !== null && githubRepoOf(latest.repositoryUrl).toLowerCase() === repoFull.toLowerCase();
		if (matches) return { kind: "npm", spec: repo, repo: repoFull, npmChecked: true };
		return { kind: "git", spec: `git+https://github.com/${owner}/${repo}.git`, repo: repoFull, squat: true };
	}
	return { kind: "git", spec: `git+https://github.com/${owner}/${repo}.git`, repo: repoFull };
}

/**
* Locate the directory of a monorepo subpackage inside an extracted repo tree:
* the first `package.json` (walking shallow-first) whose `name` equals the
* sub name, or ends with `/` + sub name (a scoped name like
* `@ethanyoq/dsh-ai-novel-writer` for sub `dsh-ai-novel-writer`).
* @param root - the extracted repo root.
* @param sub - the subpackage name (the `#sub` part of `owner/repo#sub`).
* @returns the absolute subpackage directory, or null.
*/
function locateSubpackageDir(root, sub) {
	const wanted = String(sub ?? "").toLowerCase();
	if (wanted.length === 0) return null;
	const queue = [root];
	const seen = /* @__PURE__ */ new Set();
	while (queue.length > 0) {
		const dir = queue.shift();
		if (seen.has(dir)) continue;
		seen.add(dir);
		const manifestPath = join(dir, "package.json");
		if (existsSync(manifestPath)) {
			try {
				const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
				const name = typeof manifest.name === "string" ? manifest.name : "";
				const normalizedName = name.toLowerCase();
				if (normalizedName === wanted || normalizedName.endsWith(`/${wanted}`)) return dir;
			} catch {
				/* not a manifest — keep walking */
			}
		}
		let entries = [];
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			/* unreadable — skip */
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (entry.name === "node_modules" || entry.name === ".git") continue;
			queue.push(join(dir, entry.name));
		}
	}
	return null;
}

/**
* Locate the single plugin package inside an extracted repo tree when the repo
* root has no manifest: walk shallow-first for a directory whose package.json
* declares a DSH plugin (`dsh.bundle` or `dsh.client`). Returns null when zero
* or multiple plugin packages exist (ambiguous — refuse rather than guess).
* @param root - the extracted repo root.
* @returns the plugin package directory, or null.
*/
function locatePluginPackageDir(root) {
	const queue = [root];
	const seen = /* @__PURE__ */ new Set();
	const hits = [];
	while (queue.length > 0 && hits.length < 2) {
		const dir = queue.shift();
		if (seen.has(dir)) continue;
		seen.add(dir);
		const manifestPath = join(dir, "package.json");
		if (existsSync(manifestPath)) {
			try {
				const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
				if (manifest?.dsh?.bundle !== void 0 || manifest?.dsh?.client !== void 0) {
					hits.push(dir);
					continue;
				}
			} catch {
				/* not a manifest — keep walking */
			}
		}
		let entries = [];
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			/* unreadable — skip */
		}
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "test" || entry.name === "tests") continue;
			queue.push(join(dir, entry.name));
		}
	}
	return hits.length === 1 ? hits[0] : null;
}

/**
* Resolve the importable entry-point candidates declared by a package manifest
* (`main` plus the `exports["."]` default/import/require forms), as absolute
* paths under `pkgDir`. Empty when the manifest declares no entry at all —
* callers that need the whole resolution (declared + Node's implicit fallback)
* should use `resolvePackageEntryCandidates` plus `resolveNodeFallbackEntry`.
* @param pkgDir - the installed package directory.
* @param manifest - the parsed package.json.
* @returns absolute candidate paths (not yet checked for existence).
*/
function resolvePackageEntryCandidates(pkgDir, manifest) {
	const candidates = [];
	if (typeof manifest?.main === "string" && manifest.main.length > 0) candidates.push(manifest.main);
	const exportsDot = manifest?.exports?.["."];
	if (typeof exportsDot === "string" && exportsDot.length > 0) candidates.push(exportsDot);
	else if (exportsDot !== null && typeof exportsDot === "object" && !Array.isArray(exportsDot)) {
		const defaultExport = exportsDot.default;
		if (typeof defaultExport === "string" && defaultExport.length > 0) candidates.push(defaultExport);
		else if (typeof exportsDot.import === "string" && exportsDot.import.length > 0) candidates.push(exportsDot.import);
		else if (typeof exportsDot.require === "string" && exportsDot.require.length > 0) candidates.push(exportsDot.require);
	}
	return candidates.map((candidate) => candidate.startsWith("./") ? join(pkgDir, candidate.slice(2)) : join(pkgDir, candidate));
}

/**
* Node's implicit entry fallback when a package declares neither `main` nor an
* `exports["."]` mapping: `<pkgDir>/index.js` (then .mjs/.cjs). This is exactly
* what the loader's ESM resolver does — a package with no declared entry and no
* index file fails at boot with `Cannot find package '<pkgDir>/index.js'`.
* @param pkgDir - the installed package directory.
* @returns the absolute fallback path when one of the index files exists, else null.
*/
function resolveNodeFallbackEntry(pkgDir) {
	for (const name of ["index.js", "index.mjs", "index.cjs"]) {
		const candidate = join(pkgDir, name);
		try {
			if (statSync(candidate).isFile()) return candidate;
		} catch {
			/* keep trying */
		}
	}
	return null;
}

/**
* Whether the package resolves to an importable entry file, matching the
* loader's resolution: declared `main`/`exports["."]` candidates first, then
* Node's implicit `index.js` fallback. A package that declares NEITHER an
* entry NOR ships an index file is NOT loadable — installing/mounting it makes
* DSH fail at boot (`Cannot find package '<pkgDir>/index.js'`), the misakanet
* failure mode (a deployment-scripts repo that was never a DSH plugin but
* declared `dsh.bundle.patch`).
* @param pkgDir - the installed package directory.
* @param manifest - the parsed package.json.
* @returns whether an entry file exists.
*/
function packageEntryExists(pkgDir, manifest) {
	const candidates = resolvePackageEntryCandidates(pkgDir, manifest);
	if (candidates.length > 0) {
		return candidates.some((candidate) => {
			try { return statSync(candidate).isFile(); } catch { return false; }
		});
	}
	// No declared entry — Node falls back to `index.js`; require it to exist.
	return resolveNodeFallbackEntry(pkgDir) !== null;
}

/**
* Minimal semver range satisfaction for the DSH runtime compatibility check.
* Supports the range forms plugins actually declare for `@deepseek-ai/dsh-*`
* peers: exact (`0.1.0-rc.7`), caret (`^0.1.0-rc.6`), tilde (`~0.1.0-rc.6`),
* `>=`, and `*`/bare. Prerelease handling follows the common convention: a
* range with a prerelease tag only matches same-major/minor/patch prereleases.
* @param version - the actual runtime version (e.g. `0.1.0-rc.7`).
* @param range - the declared peer range.
* @returns whether `version` satisfies `range`.
*/
function versionSatisfies(version, range) {
	if (typeof version !== "string" || version.length === 0 || typeof range !== "string") return false;
	const trimmed = range.trim();
	if (trimmed === "" || trimmed === "*" || trimmed === "latest") return true;
	if (trimmed.startsWith(">=")) {
		return compareVersions(version, trimmed.slice(2).trim()) >= 0;
	}
	if (trimmed.startsWith(">")) {
		return compareVersions(version, trimmed.slice(1).trim()) > 0;
	}
	if (trimmed.startsWith("<=")) {
		return compareVersions(version, trimmed.slice(2).trim()) <= 0;
	}
	if (trimmed.startsWith("<")) {
		return compareVersions(version, trimmed.slice(1).trim()) < 0;
	}
	let base = trimmed;
	if (base.startsWith("^") || base.startsWith("~")) {
		const isCaret = base.startsWith("^");
		base = base.slice(1).trim();
		const v = parseVersion(version);
		const r = parseVersion(base);
		if (v === null || r === null) return false;
		// DSH rc builds are API-unstable: a peer range that pins an `-rc.N`
		// prerelease (e.g. `^0.1.0-rc.6`) must match the exact same rc series.
		// Semver would say `^0.1.0-rc.6` includes `0.1.0-rc.7`, but DSH broke
		// client APIs between rc releases (e.g. the settings.plugin.item slot
		// became keyed), so a rc.6-built plugin must NOT be allowed on rc.7.
		// A stable runtime (no prerelease) is newer than any rc and satisfies.
		if (r.prerelease !== "" && v.prerelease !== "") {
			return v.major === r.major && v.minor === r.minor && v.patch === r.patch && v.prerelease === r.prerelease;
		}
		if (isCaret) {
			if (r.major > 0) return v.major === r.major && compareVersions(version, base) >= 0 && (v.minor > r.minor || v.minor === r.minor && v.patch >= r.patch);
			if (r.minor > 0) return v.major === 0 && v.minor === r.minor && v.patch >= r.patch;
			return v.major === 0 && v.minor === 0 && v.patch >= r.patch;
		}
		return v.major === r.major && v.minor === r.minor && v.patch >= r.patch;
	}
	// Exact (possibly with prerelease): same normalized string, or same
	// major.minor.patch when the range has no prerelease and the version does.
	const exact = parseVersion(base);
	const actual = parseVersion(version);
	if (exact === null || actual === null) return false;
	if (base === version) return true;
	if (exact.prerelease === "" && actual.prerelease !== "") {
		return exact.major === actual.major && exact.minor === actual.minor && exact.patch === actual.patch;
	}
	return false;
}

function parseVersion(value) {
	const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(value).trim());
	if (match === null) return null;
	return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? "" };
}

/**
* Slots that DSH's rc.7/rc.8 client shells declare with `kind: "keyed"` — a
* registration must carry `options.key`. rc.6-era plugins omit it, which makes
* the client fail at boot ("keyed slot ... requires options.key"). The market
* patches this automatically instead of requiring per-plugin fixes.
* (Set verified against the rc.8 client-ui packages: conversation.chat.node,
* conversation.chat.commandview, settings.plugin.item, tool.view.cordis.)
*/
const KEYED_SLOT_NAMES = new Set(["settings.plugin.item", "conversation.chat.node", "conversation.chat.commandview", "tool.view.cordis"]);

/**
* Generic, non-plugin-specific repair for a compiled browser client bundle:
* every `ctx.slots.register({ name: <keyed slot>, ... })` block that lacks a
* `key` field gets one injected from its own `id` (the natural key for the
* slot cell). Works on both pretty-printed and minified tsdown/esbuild output.
* @param source - the client bundle text.
* @returns `{ source, patched }` — patched text plus whether anything changed.
*/
function patchKeyedSlotRegistrations(source) {
	const slotNames = [...KEYED_SLOT_NAMES].map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	if (slotNames.length === 0) return { source, patched: false };
	const nameAlternation = slotNames.join("|");
	// Match a register call whose options object names a keyed slot, then
	// inject `key: "<id>"` right after that name line when no `key:` exists.
	// Handles indented and minified forms: `name:"x",id:"y",...`.
	const pattern = new RegExp(`(slots\\.register\\(\\{\\s*)(name:\\s*"(?:${nameAlternation})"\\s*,)([\\s\\S]*?)(\\}\\s*,\\s*[A-Za-z_$][\\w$]*\\))`, "g");
	let patched = false;
	let cursor = 0;
	const chunks = [];
	let match;
	while ((match = pattern.exec(source)) !== null) {
		const [, prefix, namePart, rest, closePart] = match;
		if (/\bkey\s*:/.test(rest)) {
			chunks.push(source.slice(cursor, match.index) + match[0]);
			cursor = pattern.lastIndex;
			continue;
		}
		// Extract the id value (quoted or bare) to reuse as the key.
		const idMatch = /\bid\s*:\s*"([^"]+)"/.exec(rest) ?? /\bid\s*:\s*([A-Za-z_$][\w$]*)/.exec(rest);
		const keyValue = idMatch !== null ? idMatch[1] : "plugin";
		// Insert on its own line when the name line is indented (pretty output),
		// or inline after the comma for minified one-line bundles.
		const indent = /\n(\s*)$/.exec(prefix)?.[1] ?? "";
		const keyInsert = indent.length > 0
			? `\n${indent}key: "${keyValue}",`
			: `key: "${keyValue}",`;
		chunks.push(source.slice(cursor, match.index) + prefix + namePart + keyInsert + rest + closePart);
		cursor = pattern.lastIndex;
		patched = true;
	}
	if (!patched) return { source, patched: false };
	chunks.push(source.slice(cursor));
	return { source: chunks.join(""), patched: true };
}

/**
* Locate a bundle's browser client file (the `dsh.client` entry), falling back
* to the `exports["./client"]` default / the `lib/client.js` convention.
* @param pkgDir - the installed package directory.
* @returns the absolute client file path, or null.
*/
function resolveClientBundlePath(pkgDir) {
	const candidates = [];
	try {
		const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
		const clientExport = manifest?.exports?.["./client"];
		if (typeof clientExport === "string") candidates.push(clientExport);
		else if (clientExport !== null && typeof clientExport === "object" && !Array.isArray(clientExport)) {
			const value = clientExport.default ?? clientExport.import ?? clientExport.require;
			if (typeof value === "string") candidates.push(value);
		}
		if (typeof manifest?.dsh?.client?.entry === "string") candidates.push(manifest.dsh.client.entry);
	} catch {
		/* fall through */
	}
	candidates.push("lib/client.js", "client.js", "dist/client.js");
	for (const candidate of candidates) {
		const resolved = candidate.startsWith("./") ? join(pkgDir, candidate.slice(2)) : join(pkgDir, candidate);
		if (existsSync(resolved)) return resolved;
	}
	return null;
}

function compareVersions(left, right) {
	const a = parseVersion(left);
	const b = parseVersion(right);
	if (a === null || b === null) return 0;
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	if (a.patch !== b.patch) return a.patch - b.patch;
	if (a.prerelease === b.prerelease) return 0;
	if (a.prerelease === "") return 1;
	if (b.prerelease === "") return -1;
	return a.prerelease < b.prerelease ? -1 : 1;
}

/**
* The DSH runtime version this desktop app is built against, read from the
* bundled `@deepseek-ai/dsh` manifest (e.g. `0.1.0-rc.7`). Returns null when
* the bundled runtime cannot be located.
*/
function detectRuntimeVersion() {
	try {
		const candidates = [
			join(process.resourcesPath ?? "", "app.asar.unpacked", "node_modules", "@deepseek-ai", "dsh", "package.json"),
			join(dirname(process.execPath), "resources", "app.asar.unpacked", "node_modules", "@deepseek-ai", "dsh", "package.json")
		];
		for (const candidate of candidates) {
			if (!existsSync(candidate)) continue;
			const manifest = JSON.parse(readFileSync(candidate, "utf8"));
			if (typeof manifest.version === "string" && manifest.version.length > 0) return manifest.version;
		}
	} catch {
		/* best-effort */
	}
	return null;
}

/** Walk up from a directory to locate a package manifest (bypasses exports maps). */
function resolvePkgJsonWalk(startDir, packageName) {
	let dir = startDir;
	for (;;) {
		const candidate = join(dir, "node_modules", packageName, "package.json");
		if (existsSync(candidate)) return candidate;
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/** Whether an executable name exists on PATH (Windows-aware). */
function commandOnPath(name) {
	const path = process.env.PATH ?? "";
	const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
	for (const dir of path.split(process.platform === "win32" ? ";" : ":")) {
		if (dir.length === 0) continue;
		for (const ext of exts) if (existsSync(join(dir, `${name}${ext}`))) return true;
	}
	return false;
}

/** The package description of an installed plugin directory ("" when unknown). */
function readPackageDescription(dir) {
	try {
		const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
		return typeof manifest.description === "string" ? manifest.description : "";
	} catch {
		return "";
	}
}

/** The install-time proxy of a plugin directory: its creation time ("" when unknown). */
function installedAtOf(dir) {
	try {
		const info = statSync(dir);
		return new Date(info.birthtime).toISOString();
	} catch {
		return "";
	}
}

/** The pluginMarketHub Remote gateway: live catalog, installed set, and install. */
let PluginMarketGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _listPublished_decorators;
	let _installed_decorators;
	let _install_decorators;
	let _setEnabled_decorators;
	let _openLocal_decorators;
	let _restartApp_decorators;
	let _cancelEnabled_decorators;
	let _checkUpdates_decorators;
	let _updatePlugin_decorators;
	let _fetchReadme_decorators;
	let _auditPackage_decorators;
	let _favoritesGet_decorators;
	let _favoritesSet_decorators;
	let _uninstallPlugin_decorators;
	let _scanOrphanPlugins_decorators;
	let _mountOrphan_decorators;
	let _removeOrphanFiles_decorators;
	return class PluginMarketGateway extends _classSuper {
		static inject = ["loader", "tools", "commands"];
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_listPublished_decorators = [Remote("listPublished")];
			_installed_decorators = [Remote("installed")];
			_install_decorators = [Remote("installPlugin")];
			_setEnabled_decorators = [Remote("setEnabled")];
			_openLocal_decorators = [Remote("openLocal")];
			_restartApp_decorators = [Remote("restartApp")];
			_cancelEnabled_decorators = [Remote("cancelEnabled")];
			_checkUpdates_decorators = [Remote("checkUpdates")];
			_updatePlugin_decorators = [Remote("updatePlugin")];
			_fetchReadme_decorators = [Remote("fetchReadme")];
			_auditPackage_decorators = [Remote("auditPackage")];
			_favoritesGet_decorators = [Remote("favoritesGet")];
			_favoritesSet_decorators = [Remote("favoritesSet")];
			_uninstallPlugin_decorators = [Remote("uninstallPlugin")];
			_scanOrphanPlugins_decorators = [Remote("scanOrphanPlugins")];
			_mountOrphan_decorators = [Remote("mountOrphan")];
			_removeOrphanFiles_decorators = [Remote("removeOrphanFiles")];
			__esDecorate(this, null, _listPublished_decorators, {
				kind: "method",
				name: "listPublished",
				static: false,
				private: false,
				access: { has: (obj) => "listPublished" in obj, get: (obj) => obj.listPublished },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _installed_decorators, {
				kind: "method",
				name: "installed",
				static: false,
				private: false,
				access: { has: (obj) => "installed" in obj, get: (obj) => obj.installed },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _install_decorators, {
				kind: "method",
				name: "installPlugin",
				static: false,
				private: false,
				access: { has: (obj) => "installPlugin" in obj, get: (obj) => obj.installPlugin },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _setEnabled_decorators, {
				kind: "method",
				name: "setEnabled",
				static: false,
				private: false,
				access: { has: (obj) => "setEnabled" in obj, get: (obj) => obj.setEnabled },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _openLocal_decorators, {
				kind: "method",
				name: "openLocal",
				static: false,
				private: false,
				access: { has: (obj) => "openLocal" in obj, get: (obj) => obj.openLocal },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _restartApp_decorators, {
				kind: "method",
				name: "restartApp",
				static: false,
				private: false,
				access: { has: (obj) => "restartApp" in obj, get: (obj) => obj.restartApp },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _cancelEnabled_decorators, {
				kind: "method",
				name: "cancelEnabled",
				static: false,
				private: false,
				access: { has: (obj) => "cancelEnabled" in obj, get: (obj) => obj.cancelEnabled },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _checkUpdates_decorators, {
				kind: "method",
				name: "checkUpdates",
				static: false,
				private: false,
				access: { has: (obj) => "checkUpdates" in obj, get: (obj) => obj.checkUpdates },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _updatePlugin_decorators, {
				kind: "method",
				name: "updatePlugin",
				static: false,
				private: false,
				access: { has: (obj) => "updatePlugin" in obj, get: (obj) => obj.updatePlugin },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _fetchReadme_decorators, {
				kind: "method",
				name: "fetchReadme",
				static: false,
				private: false,
				access: { has: (obj) => "fetchReadme" in obj, get: (obj) => obj.fetchReadme },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _auditPackage_decorators, {
				kind: "method",
				name: "auditPackage",
				static: false,
				private: false,
				access: { has: (obj) => "auditPackage" in obj, get: (obj) => obj.auditPackage },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _favoritesGet_decorators, {
				kind: "method",
				name: "favoritesGet",
				static: false,
				private: false,
				access: { has: (obj) => "favoritesGet" in obj, get: (obj) => obj.favoritesGet },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _favoritesSet_decorators, {
				kind: "method",
				name: "favoritesSet",
				static: false,
				private: false,
				access: { has: (obj) => "favoritesSet" in obj, get: (obj) => obj.favoritesSet },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _uninstallPlugin_decorators, {
				kind: "method",
				name: "uninstallPlugin",
				static: false,
				private: false,
				access: { has: (obj) => "uninstallPlugin" in obj, get: (obj) => obj.uninstallPlugin },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _scanOrphanPlugins_decorators, {
				kind: "method",
				name: "scanOrphanPlugins",
				static: false,
				private: false,
				access: { has: (obj) => "scanOrphanPlugins" in obj, get: (obj) => obj.scanOrphanPlugins },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _mountOrphan_decorators, {
				kind: "method",
				name: "mountOrphan",
				static: false,
				private: false,
				access: { has: (obj) => "mountOrphan" in obj, get: (obj) => obj.mountOrphan },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _removeOrphanFiles_decorators, {
				kind: "method",
				name: "removeOrphanFiles",
				static: false,
				private: false,
				access: { has: (obj) => "removeOrphanFiles" in obj, get: (obj) => obj.removeOrphanFiles },
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		constructor(ctx) {
			super(ctx, "pluginMarketHub");
			this.catalogCache = new Map();
			this.lastOverrides = /* @__PURE__ */ new Map();
			this.githubCooldownUntil = 0;
			this.refreshInflight = /* @__PURE__ */ new Map();
			this.registerAgentTools();
			try {
				const disk = this.readDiskCache();
				if (disk !== null) for (const [sort, entry] of disk) this.catalogCache.set(sort, entry);
			} catch {
				this.catalogCache = new Map();
			}
			__runInitializers(this, _instanceExtraInitializers);
		}
		/**
		* Expose the marketplace to headless environments: model tools
		* (`kidai_market_search` / `kidai_market_install` / `kidai_market_updates`)
		* and a `/kidai-market` slash command. Best-effort — a missing tools or
		* commands service must never break the gateway itself.
		*/
		registerAgentTools() {
			try {
				const tools = this.ctx.get("tools");
				if (tools !== void 0 && typeof tools.register === "function") {
					const self = this;
					// 同族插件(kidai-plugin-market)也注册同名工具:已存在则跳过,
					// 避免 "already registered" 抛错导致整组工具静默缺失(先注册者生效)。
					const alreadyRegistered = typeof tools.get === "function" ? tools.get("kidai_market_search") : void 0;
					if (alreadyRegistered === void 0) {
					tools.register({
						name: "kidai_market_search",
						description: "Search the Kidai plugin marketplace for published DSH plugins by name/description, optionally server-sorted by recent update / stars / name. Returns name, one-line description, stars and verified status.",
						parameters: toJsonSchema({ query: { type: "string", required: false, description: "Keyword; empty returns the leading catalog entries" }, sort: { type: "string", required: false, description: "updated | stars | name" } }),
						output: { schema: { type: "object", additionalProperties: false, properties: { count: { type: "number" }, entries: { type: "array", items: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, owner: { type: "string" }, description: { type: "string" }, stars: { type: "number" }, verified: { type: "boolean" }, url: { type: "string" } } } } } }, render: (_args, value) => [{ type: "text", text: renderMarketSearch(value) }] },
						async execute(args) {
							const view = await self.listPublished(false, typeof args.sort === "string" ? args.sort : "updated");
							const q = typeof args.query === "string" ? args.query.trim().toLocaleLowerCase() : "";
							const entries = view.entries.filter((entry) => q.length === 0 || `${entry.name} ${entry.owner} ${entry.description}`.toLocaleLowerCase().includes(q)).slice(0, 20);
							return { count: entries.length, entries: entries.map((entry) => ({ name: entry.name, owner: entry.owner, description: entry.description, stars: entry.stars ?? 0, verified: entry.verified === true, url: entry.url })) };
						},
						presentCall(args) { return { card: "generic", title: "Kidai market search", kind: "read", rawInput: args.query ?? "" }; }
					});
					tools.register({
						name: "kidai_market_install",
						description: "Install a plugin from the Kidai marketplace into the current DSH profile (activation after a restart). spec is an npm package name or a GitHub owner/repo.",
						parameters: toJsonSchema({ spec: { type: "string", required: true, description: "npm package name or GitHub owner/repo" } }),
						output: { schema: { type: "object", additionalProperties: false, properties: { ok: { type: "boolean" }, message: { type: "string" } } }, render: (_args, value) => [{ type: "text", text: value.message }] },
						async execute(args) {
							const result = await self.installPlugin(args.spec, {});
							return { ok: result.ok === true, message: result.message ?? "install failed" };
						},
						presentCall(args) { return { card: "generic", title: "Kidai market install", kind: "write", rawInput: args.spec }; }
					});
					tools.register({
						name: "kidai_market_updates",
						description: "Check installed plugins for newer npm versions and list the updatable ones.",
						parameters: toJsonSchema({}),
						output: { schema: { type: "object", additionalProperties: false, properties: { updates: { type: "array", items: { type: "object", additionalProperties: false, properties: { packageName: { type: "string" }, current: { type: "string" }, latest: { type: "string" } } } } } }, render: (_args, value) => [{ type: "text", text: renderMarketUpdates(value.updates) }] },
						async execute() {
							const view = await self.checkUpdates();
							return { updates: view.updates.map((entry) => ({ packageName: entry.packageName, current: entry.current, latest: entry.latest })) };
						},
						presentCall() { return { card: "generic", title: "Kidai market updates", kind: "read", rawInput: "" }; }
					});
					}
				}
			} catch (error) {
				this.ctx.logger?.warn?.(`kidai-plugin-market-hub: tools registration skipped: ${error instanceof Error ? error.message : String(error)}`);
			}
			try {
				const commands = this.ctx.get("commands");
				if (commands !== void 0 && typeof commands.register === "function") {
					const self = this;
					commands.register({
						name: "kidai-market",
						description: "Kidai plugin marketplace: search / install / update plugins. Usage: /kidai-market search <keyword> | install <package-or-owner/repo> | updates",
						input: { hint: "search <关键词> / install <包名或owner/repo> / updates" },
						async handler(invocation) {
							const line = (invocation.rawInput ?? "").trim();
							const [verb, ...rest] = line.split(/\s+/);
							if (verb === "search") {
								const view = await self.listPublished(false, "updated");
								const q = rest.join(" ").toLocaleLowerCase();
								const hits = view.entries.filter((entry) => `${entry.name} ${entry.owner} ${entry.description}`.toLocaleLowerCase().includes(q)).slice(0, 10);
								if (hits.length === 0) return { kind: "success", text: "未找到匹配插件。" };
								return { kind: "success", text: hits.map((entry) => `${entry.name}${entry.verified === true ? " ✓已验证" : ""} ⭐${entry.stars ?? 0} — ${entry.description || entry.url}`).join("\n") };
							}
							if (verb === "install") {
								const spec = rest.join(" ");
								if (spec.length === 0) return { kind: "error", text: "用法: /kidai-market install <包名或owner/repo>" };
								const result = await self.installPlugin(spec, {});
								return { kind: result.ok === true ? "success" : "error", text: result.message ?? "安装失败" };
							}
							if (verb === "updates") {
								const view = await self.checkUpdates();
								if (view.updates.length === 0) return { kind: "success", text: "所有已装插件均为最新。" };
								return { kind: "success", text: view.updates.map((entry) => `${entry.packageName}: ${entry.current} → ${entry.latest}`).join("\n") };
							}
							return { kind: "error", text: "用法: /kidai-market search <关键词> | install <包名> | updates" };
						}
					});
				}
			} catch (error) {
				this.ctx.logger?.warn?.(`kidai-plugin-market-hub: command registration skipped: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		/**
		* The active profile directory: the config-tree anchor of this deployment.
		* @returns the absolute profile directory.
		*/
		profileDir() {
			const baseUrl = this.ctx.baseUrl;
			if (typeof baseUrl !== "string" || baseUrl.length === 0) throw new Error("kidai-plugin-market-hub: ctx.baseUrl is unset — cannot locate the active profile");
			return fileURLToPath(new URL(".", baseUrl));
		}
		/**
		* Read the current profile manifest, tolerating a missing/corrupt file.
		* @returns the parsed manifest (empty shape on failure).
		*/
		readManifest() {
			try {
				return JSON.parse(readFileSync(join(this.profileDir(), "package.json"), "utf8"));
			} catch {
				return { dependencies: {}, dsh: {} };
			}
		}
		/** Normalize the requested sort into one of the supported sort keys. */
		normalizeSort(sort) {
			if (sort === "stars" || sort === "name") return sort;
			return "updated";
		}
		/**
		* Fetch the live catalog for one sort order, merging GitHub repositories
		* and npm packages: GitHub topic search (a few pages) plus a repo-name
		* search (catches untagged repos), both server-sorted by the requested
		* order (`stars` for the star view, `updated` otherwise), merged with npm
		* searches across several naming variants; entries are deduplicated by
		* plugin name with the GitHub record preferred. Sources are tried per
		* family (official, then mirrors). Views are cached per sort for
		* {@link CATALOG_TTL_MS}; `force` bypasses that window. When everything
		* fails, that sort's last good view (memory, then disk) is returned
		* marked stale, falling back to any other sort's cached view.
		* @param force - bypass the freshness window.
		* @param sort - `"stars"` | `"name"` | anything else → `"updated"`.
		* @returns the catalog view for that sort.
		*/
		async listPublished(force, sort) {
			const key = this.normalizeSort(sort);
			const now = Date.now();
			const cached = this.catalogCache.get(key);
			if (force !== true && cached !== void 0 && now - Date.parse(cached.fetchedAt) < CATALOG_TTL_MS) return cached;
			// GitHub rate-limit cooldown: serve the cached view (stale) instead
			// of hammering a 403/429-limited API; a fresh npm-only view is only
			// attempted when nothing is cached.
			if (this.isGitHubCooling() && cached !== void 0) return { ...cached, stale: true, cooling: true };
			// A stale in-memory/disk view is better than a blank first paint:
			// return it immediately (marked stale) and refresh in the background
			// so the UI paints in milliseconds instead of tens of seconds.
			const staleSource = cached ?? this.readDiskCache()?.get(key);
			if (force !== true && staleSource !== void 0 && Array.isArray(staleSource.entries)) {
				this.refreshInBackground(key);
				return { ...staleSource, stale: true };
			}
			try {
				const view = await this.fetchMergedCatalog(key);
				view.fetchedAt = new Date(now).toISOString();
				this.catalogCache.set(key, view);
				this.writeDiskCache(key, view);
				return view;
			} catch (error) {
				const failure = error instanceof Error ? error.message : String(error);
				if (cached !== void 0) return { ...cached, stale: true };
				for (const [otherKey, otherView] of this.catalogCache) {
					if (otherKey !== key) return { ...otherView, stale: true, requestedSort: key };
				}
				const disk = this.readDiskCache();
				if (disk !== null && disk.has(key)) return { ...disk.get(key), stale: true };
				for (const [, otherView] of disk ?? []) return { ...otherView, stale: true, requestedSort: key };
				throw new Error(`kidai-plugin-market-hub: all catalog sources failed (${failure})`);
			}
		}
		/**
		* Refresh one catalog sort in the background (deduplicated per sort key).
		* The first caller returns immediately; later callers piggyback on the
		* in-flight refresh. On completion the fresh view replaces both the
		* in-memory and the on-disk cache; failures keep whatever was cached.
		* @param key - normalized sort key.
		*/
		refreshInBackground(key) {
			if (this.refreshInflight.has(key)) return;
			const task = (async () => {
				try {
					const view = await this.fetchMergedCatalog(key);
					view.fetchedAt = new Date().toISOString();
					this.catalogCache.set(key, view);
					this.writeDiskCache(key, view);
					return view;
				} catch {
					/* keep the stale view; a later force refresh will retry */
					return null;
				} finally {
					this.refreshInflight.delete(key);
				}
			})();
			this.refreshInflight.set(key, task);
		}
		/** Whether GitHub search is inside its rate-limit cooldown window. */
		isGitHubCooling() {
			return this.githubCooldownUntil > Date.now();
		}
		/**
		* Name → verified flags seen in any cached view (memory or disk), so a
		* re-verified entry is not probed again on every sort switch.
		* @returns a Map of plugin name → boolean.
		*/
		verifiedFlags() {
			const flags = /* @__PURE__ */ new Map();
			for (const view of this.catalogCache.values()) {
				for (const entry of view.entries) if (typeof entry.name === "string" && typeof entry.verified === "boolean") flags.set(entry.name, entry.verified);
			}
			const disk = this.readDiskCache();
			if (disk !== null) for (const view of disk.values()) {
				for (const entry of view.entries) if (typeof entry.name === "string" && typeof entry.verified === "boolean") flags.set(entry.name, entry.verified);
			}
			return flags;
		}
		/**
		* The merged catalog for one sort key, fetching GitHub (server-sorted),
		* npm, and the awesome-dsh-plugin curated list. `name` is not a GitHub
		* search sort, so it uses the `updated` feed; the client re-sorts by
		* name locally. Every entry is tagged with its source tier
		* (`TOPIC` / `NAME` / `NPM` / `AWESOME`) and GitHub
		* entries are verified (dsh declarations) with a bounded concurrency;
		* previously-seen flags are reused so sort switches stay cheap.
		* @param sort - normalized sort key (`stars` | `updated`).
		* @returns the fresh view; throws when every source fails.
		*/
		async fetchMergedCatalog(sort) {
			const githubSort = sort === "stars" ? "stars" : "updated";
			const failures = [];
			const entries = [];
			const seen = /* @__PURE__ */ new Set();
			const families = /* @__PURE__ */ new Set();
			const cooling = this.isGitHubCooling();
			// 1) GitHub + npm run CONCURRENTLY (each family internally parallel
			//    too) so a slow or unreachable GitHub API cannot stall the fast
			//    npm queries. GitHub: topic search pages + name search per base,
			//    stop at the first base that yields any entries (official, then
			//    mirrors); the pages of one base are fetched in parallel so an
			//    unreachable base costs one timeout, not six.
			if (cooling) {
				failures.push("github: rate-limited (cooldown)");
			}
			const githubTask = (async () => {
				if (cooling) return;
				for (const base of this.githubBases()) {
					const urls = [];
					for (let page = 1; page <= GITHUB_PAGES; page++) urls.push(`${base.base}/search/repositories?q=${encodeURIComponent(CATALOG_TOPIC)}&sort=${githubSort}&order=desc&per_page=100&page=${page}`);
					urls.push(`${base.base}/search/repositories?q=${encodeURIComponent(CATALOG_NAME_QUERY)}&sort=${githubSort}&order=desc&per_page=100`);
					const settled = await Promise.allSettled(urls.map(async (url) => {
						const pageEntries = await this.fetchGithubPage(url);
						return { url, pageEntries };
					}));
					let got = 0;
					for (const outcome of settled) {
						if (outcome.status !== "fulfilled") {
							failures.push(`${base.id}: ${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`);
							continue;
						}
						const { url, pageEntries } = outcome.value;
						got += pageEntries.length;
						for (const entry of pageEntries) if (!seen.has(entry.name)) {
							seen.add(entry.name);
							entries.push({ ...entry, sourceTier: url.includes("in%3Aname") ? "NAME" : "TOPIC" });
						}
					}
					families.add(base.id);
					if (got > 0) break;
				}
			})();
			// npm: several queries from the first registry that responds; the
			// queries are fired in parallel per registry.
			const npmTask = (async () => {
				for (const registry of [NPM_SEARCH_DEFAULT, NPM_SEARCH_MIRROR]) {
					const settled = await Promise.allSettled(NPM_SEARCH_QUERIES.map(async (query) => ({
						query,
						pageEntries: await this.fetchNpmPage(`${registry}?text=${encodeURIComponent(query)}&size=${NPM_SEARCH_SIZE}`)
					})));
					let got = 0;
					for (const outcome of settled) {
						if (outcome.status !== "fulfilled") {
							failures.push(`${registry === NPM_SEARCH_DEFAULT ? "npm" : "npm-mirror"}:${outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)}`);
							continue;
						}
						const { pageEntries } = outcome.value;
						got += pageEntries.length;
						for (const entry of pageEntries) if (!seen.has(entry.name)) {
							seen.add(entry.name);
							entries.push({ ...entry, sourceTier: "NPM" });
						}
					}
					families.add(registry === NPM_SEARCH_DEFAULT ? "npm" : "npm-mirror");
					if (got > 0) break;
				}
			})();
			await Promise.allSettled([githubTask, npmTask]);
			// The verify probe set depends only on GitHub/npm entries + cached
			// flags, so it can run CONCURRENTLY with the awesome merge below.
			const flags = this.verifiedFlags();
			const unknown = entries.filter((entry) => entry.kind === "github" && entry.sourceTier !== "AWESOME" && !flags.has(entry.name)).slice(0, VERIFY_MAX_ENTRIES);
			const verifyTask = this.verifyEntries(unknown);
			// 2) awesome-dsh-plugin: the community-curated README list, parsed for
			// `- [owner/repo](url) - description` bullets (monorepo entries carry a
			// `#subpackage` label); `### Category` headings are captured so the
			// client can render a category-grouped tab. Fail-soft: a list outage
			// must not kill the catalog when GitHub/npm already yielded entries.
			// Merged after GitHub/npm so a matching entry keeps its richer data.
			let awesomeCategories = [];
			try {
				const awesomeText = await fetchAwesomeReadme(!this.isGitHubCooling());
				const awesomeEntries = awesomeEntriesFromMarkdown(awesomeText);
				awesomeCategories = awesomeCategoriesFromMarkdown(awesomeText);
				if (awesomeEntries.length > 0) {
					families.add("awesome");
					for (const entry of awesomeEntries) {
						if (seen.has(entry.name)) {
							// The curated list matches an entry already fetched from
							// GitHub/npm: keep the richer source data (stars, updatedAt,
							// icon, url, topics) and stamp the awesome category + tier so
							// it surfaces in the awesome tab with a real star count.
							const existing = entries.find((candidate) => candidate.name === entry.name);
							if (existing !== void 0 && typeof existing.category !== "string") {
								existing.category = entry.category;
								existing.sourceTier = "AWESOME";
							}
						} else {
							seen.add(entry.name);
							entries.push({ ...entry, kind: "github" });
						}
					}
				} else {
					failures.push("awesome: list empty/unreachable");
				}
			} catch (error) {
				failures.push(`awesome: ${error instanceof Error ? error.message : String(error)}`);
			}
			if (entries.length === 0) throw new Error(failures.join("; "));
			// 3) verify GitHub entries (npm entries are registry-listed already;
			// awesome-list entries are human-curated, so they count as verified):
			// npm-kind entries count as verified; GitHub repos are probed for
			// dsh declarations unless a cached flag is already known.
			const results = await verifyTask;
			for (const entry of entries) {
				if (entry.kind === "npm") entry.verified = true;
				else if (entry.sourceTier === "AWESOME") entry.verified = true;
				else if (results.has(entry.name)) entry.verified = results.get(entry.name);
				else if (flags.has(entry.name)) entry.verified = flags.get(entry.name);
				else entry.verified = false;
			}
			return {
				entries,
				source: [...families].join("+"),
				categories: awesomeCategories
			};
		}
		/**
		* Probe GitHub entries for real-plugin declarations with bounded
		* concurrency, reusing the CDN-first chain (no API quota).
		* @param entries - GitHub-kind catalog entries without a known flag.
		* @returns a Map of name → verified boolean.
		*/
		async verifyEntries(entries) {
			const results = /* @__PURE__ */ new Map();
			let cursor = 0;
			const worker = async () => {
				for (;;) {
					const index = cursor++;
					if (index >= entries.length) return;
					const entry = entries[index];
					if (typeof entry.owner !== "string" || entry.owner.length === 0 || typeof entry.name !== "string" || entry.name.length === 0) {
						results.set(entry.name, false);
						continue;
					}
					try {
						const verdict = await verifyRepoPlugin(entry.owner, entry.name);
						results.set(entry.name, verdict.verified);
					} catch {
						results.set(entry.name, false);
					}
				}
			};
			const workers = [];
			for (let i = 0; i < VERIFY_CONCURRENCY; i++) workers.push(worker());
			await Promise.all(workers);
			return results;
		}
		/** The GitHub API bases tried in order, with the env override first. */
		githubBases() {
			const envBase = typeof process.env[GITHUB_API_ENV] === "string" && process.env[GITHUB_API_ENV].trim().length > 0 ? process.env[GITHUB_API_ENV].replace(/\/+$/, "") : void 0;
			const bases = [];
			if (envBase !== void 0) bases.push({ id: "github-env", base: envBase });
			bases.push({ id: "github", base: GITHUB_API_DEFAULT });
			for (const mirror of GITHUB_API_MIRRORS) bases.push({ id: "github-mirror", base: mirror });
			return bases;
		}
		/** Fetch and normalize one GitHub repository-search page. */
		async fetchGithubPage(url) {
			const response = await fetch(url, {
				headers: { "User-Agent": "kidai-plugin-market-hub", "Accept": "application/vnd.github+json" },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
			});
			if (!response.ok) {
				// 403 (rate limit) / 429 (secondary limit): cool down GitHub for a
				// while so repeated sort switches serve cache instead of failing.
				if (response.status === 403 || response.status === 429) {
					this.githubCooldownUntil = Date.now() + GITHUB_COOLDOWN_MS;
				}
				throw new Error(`HTTP ${response.status}`);
			}
			const data = await response.json();
			return (Array.isArray(data.items) ? data.items : []).map((repo) => ({ ...entryOf(repo), kind: "github" }));
		}
		/** Fetch, filter, and normalize one npm registry-search page. */
		async fetchNpmPage(url) {
			const response = await fetch(url, {
				headers: { "User-Agent": "kidai-plugin-market-hub" },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			return (Array.isArray(data.objects) ? data.objects : [])
				.map((item) => item?.package)
				.filter((pkg) => pkg !== null && typeof pkg?.name === "string" && isPluginPackage(pkg.name))
				.map((pkg) => ({ ...npmEntryOf(pkg), kind: "npm" }));
		}
		/** Last-good catalog persisted next to the profile manifest. */
		diskCachePath() {
			return join(this.profileDir(), DISK_CACHE_FILENAME);
		}
		/**
		* Last-good catalog views (one per sort) persisted next to the profile
		* manifest. Returns a Map keyed by sort (`updated`/`stars`/`name`), each
		* value `{entries, fetchedAt, source}` with an ISO-string `fetchedAt`;
		* a legacy single-view file (`{entries, fetchedAt, source}` at the root)
		* is treated as `updated`. Numeric timestamps are normalized to ISO.
		* @returns a Map, or null when unreadable.
		*/
		readDiskCache() {
			try {
				const parsed = JSON.parse(readFileSync(this.diskCachePath(), "utf8"));
				if (parsed === null || typeof parsed !== "object") return null;
				const bySort = parsed.bySort;
				if (bySort !== null && typeof bySort === "object") {
					const map = /* @__PURE__ */ new Map();
					for (const [sort, view] of Object.entries(bySort)) {
						if (view !== null && typeof view === "object" && Array.isArray(view.entries) && typeof view.source === "string") {
							const fetchedAt = typeof view.fetchedAt === "string" ? view.fetchedAt : new Date(typeof view.fetchedAt === "number" ? view.fetchedAt : 0).toISOString();
							map.set(sort, { entries: view.entries, fetchedAt, source: view.source, categories: Array.isArray(view.categories) ? view.categories : [] });
						}
					}
					return map.size > 0 ? map : null;
				}
				if (Array.isArray(parsed.entries) && typeof parsed.source === "string") {
					const fetchedAt = typeof parsed.fetchedAt === "string" ? parsed.fetchedAt : new Date(typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0).toISOString();
					return new Map([["updated", { entries: parsed.entries, fetchedAt, source: parsed.source, categories: Array.isArray(parsed.categories) ? parsed.categories : [] }]]);
				}
				return null;
			} catch {
				return null;
			}
		}
		writeDiskCache(sort, view) {
			try {
				const prev = this.readDiskCache() ?? /* @__PURE__ */ new Map();
				prev.set(sort, view);
				const bySort = {};
				for (const [key, entry] of prev) bySort[key] = entry;
				writeFileSync(this.diskCachePath(), JSON.stringify({ bySort }, null, 2));
			} catch (error) {
				this.ctx.logger.warn(`kidai-plugin-market-hub: could not persist catalog cache: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		/**
		* Read which plugin packages the active profile depends on and which
		* third-party plugins are currently mounted as loader entries.
		* @returns dependencies/bundles, the profile dir, and the plugin rows.
		*/
		async installed() {
			const manifest = this.readManifest();
			return {
				dependencies: Object.keys(manifest.dependencies ?? {}).sort(),
				bundles: Array.isArray(manifest.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : [],
				plugins: this.thirdPartyPlugins(),
				restartSupported: this.restartSupported(),
				profileDir: this.profileDir()
			};
		}
		/**
		* Installed plugin rows for the 已安装 view: every loader entry, tagged
		* native (`@deepseek-ai/*`) or third-party, with description, install
		* time, and local path for the card UI.
		* @returns plugin rows sorted by name.
		*/
		thirdPartyPlugins() {
			const loader = this.ctx.loader;
			if (loader === void 0 || typeof loader.entries !== "function") return [];
			const rows = [];
			const seen = /* @__PURE__ */ new Set();
			for (const entry of loader.entries()) {
				const name = entry.options?.name;
				if (typeof name !== "string" || seen.has(name)) continue;
				seen.add(name);
				// Launcher-internal rows are not user plugins: the root include
				// group and the desktop app's own shell entries.
				if (name === "cordis:include" || name === "cordis:group" || name === "dsh-plugin-desktop" || name.startsWith("dsh-plugin-desktop/")) continue;
				const path = this.resolvePackageDir(name);
				rows.push({
					name,
					entryId: String(entry.id ?? ""),
					enabled: !entry.disabled,
					origin: name.startsWith("@deepseek-ai/") ? "native" : "third-party",
					description: readPackageDescription(path),
					installedAt: installedAtOf(path),
					path
				});
			}
			return rows.sort((a, b) => a.name.localeCompare(b.name));
		}
		/** The on-disk directory of an installed package, when it can be found. */
		resolvePackageDir(packageName) {
			const manifestPath = resolvePkgJsonWalk(this.profileDir(), packageName);
			return manifestPath !== null ? dirname(manifestPath) : join(this.profileDir(), "node_modules", packageName);
		}
		/**
		* Enable or disable one installed plugin by writing a `disabled` override
		* into the HOME-level user patch layer (`$DSH_HOME/cordis.patch.yml`) —
		* the file both the Desktop launcher and `dsh --profile web` actually
		* load at boot (the profile-dir cordis.patch.yml template is not read by
		* either). The include plugin merges `{ id, disabled }` onto the target
		* row without touching its name/config; deployments with HMR hot-apply
		* the change, otherwise it takes effect on restart.
		*
		* Loader entry ids are nested under the root include group (e.g.
		* `include:novelweb`), but the patch layer targets the plain row id
		* (`novelweb`) — the leading group segments are stripped here.
		* @param entryId - the loader entry id of the plugin (may carry group
		* prefixes such as `include:`).
		* @param enabled - whether the plugin should be enabled.
		* @returns the write outcome.
		*/
		async setEnabled(entryId, enabled) {
			if (typeof entryId !== "string" || entryId.trim().length === 0) return { ok: false, entryId: String(entryId ?? ""), enabled: enabled === true, message: "kidai-plugin-market-hub: invalid plugin id", restartNeeded: false };
			const rowId = entryId.split(":").pop() ?? "";
			if (!/^[A-Za-z0-9_.-]+$/.test(rowId)) return { ok: false, entryId, enabled: enabled === true, message: "kidai-plugin-market-hub: invalid plugin id", restartNeeded: false };
			const patchPath = join(this.homeDir(), PROFILE_PATCH_FILENAME);
			let doc = [];
			try {
				const parsed = YAML.parse(readFileSync(patchPath, "utf8"));
				if (Array.isArray(parsed)) doc = parsed;
			} catch {
				doc = [];
			}
			const target = enabled === true ? false : true;
			const index = doc.findIndex((row) => row !== null && typeof row === "object" && !Array.isArray(row) && row.id === rowId && row.insert === void 0);
			// Remember the pre-submission override so 「已提交」→ cancel can undo it.
			this.lastOverrides.set(rowId, index >= 0 ? { ...doc[index] } : null);
			// Rolling snapshot so a bad toggle can be restored by hand if needed.
			this.backupProfileFiles("toggle");
			const row = { id: rowId, disabled: target };
			// Merge instead of replacing the whole row: a top-level patch row may
			// carry config/name/other fields, and overwriting them would silently
			// drop the plugin's configuration on the next boot.
			if (index >= 0) doc[index] = { ...doc[index], disabled: target };
			else doc.push(row);
			try {
				writeFileSync(patchPath, YAML.stringify(doc));
			} catch (error) {
				return { ok: false, entryId, rowId, enabled: enabled === true, message: `kidai-plugin-market-hub: 写入用户补丁层失败: ${error instanceof Error ? error.message : String(error)}`, restartNeeded: false };
			}
			return { ok: true, entryId, rowId, enabled: enabled === true, path: patchPath, restartSupported: this.restartSupported(), message: `已${enabled === true ? "启用" : "停用"}「${rowId}」\n配置文件：${patchPath}\n重启 DSH 后生效。`, restartNeeded: true };
		}
		/**
		* Undo the most recent enable/disable submission for one plugin: restore
		* the patch layer row to its pre-submission value (or remove it when
		* there was none). Does not touch the plugin's files or dependencies.
		* @param entryId - the loader entry id of the plugin.
		* @returns the cancel outcome.
		*/
		async cancelEnabled(entryId) {
			if (typeof entryId !== "string" || entryId.trim().length === 0) return { ok: false, entryId: String(entryId ?? ""), message: "kidai-plugin-market-hub: invalid plugin id", restartNeeded: false };
			const rowId = entryId.split(":").pop() ?? "";
			if (!/^[A-Za-z0-9_.-]+$/.test(rowId)) return { ok: false, entryId, message: "kidai-plugin-market-hub: invalid plugin id", restartNeeded: false };
			const patchPath = join(this.homeDir(), PROFILE_PATCH_FILENAME);
			let doc = [];
			try {
				const parsed = YAML.parse(readFileSync(patchPath, "utf8"));
				if (Array.isArray(parsed)) doc = parsed;
			} catch {
				doc = [];
			}
			const previous = this.lastOverrides.has(rowId) ? this.lastOverrides.get(rowId) : null;
			const index = doc.findIndex((row) => row !== null && typeof row === "object" && !Array.isArray(row) && row.id === rowId && row.insert === void 0);
			// Rolling snapshot before the undo lands, so the undo itself is undoable.
			this.backupProfileFiles("cancel");
			if (previous !== null && previous !== void 0) {
				if (index >= 0) doc[index] = previous;
				else doc.push(previous);
			} else if (index >= 0) {
				doc.splice(index, 1);
			}
			this.lastOverrides.delete(rowId);
			try {
				writeFileSync(patchPath, YAML.stringify(doc));
			} catch (error) {
				return { ok: false, entryId, rowId, message: `kidai-plugin-market-hub: 写入用户补丁层失败: ${error instanceof Error ? error.message : String(error)}`, restartNeeded: false };
			}
			return { ok: true, entryId, rowId, path: patchPath, message: `已撤销「${rowId}」的提交，配置已恢复。`, restartNeeded: false };
		}
		/**
		* Load the persisted favorite plugin names for the active profile.
		* Favorites live in a small JSON file next to the profile manifest so
		* they survive DSH restarts (browser localStorage is ephemeral across
		* launches for this deployment).
		* @returns `{ ok, names }` — never throws.
		*/
		async favoritesGet() {
			try {
				const parsed = JSON.parse(readFileSync(join(this.profileDir(), FAVORITES_FILENAME), "utf8"));
				const names = Array.isArray(parsed?.names) ? parsed.names.filter((name) => typeof name === "string") : [];
				return { ok: true, names };
			} catch {
				return { ok: true, names: [] };
			}
		}
		/**
		* Persist the favorite plugin names for the active profile.
		* @param names - the favorite plugin names.
		* @returns the write outcome.
		*/
		async favoritesSet(names) {
			const list = Array.isArray(names) ? names.filter((name) => typeof name === "string") : [];
			const unique = [...new Set(list)];
			try {
				writeFileSync(join(this.profileDir(), FAVORITES_FILENAME), `${JSON.stringify({ names: unique }, null, 2)}\n`);
				return { ok: true, count: unique.length };
			} catch (error) {
				return { ok: false, message: `kidai-plugin-market-hub: 写入收藏失败: ${error instanceof Error ? error.message : String(error)}` };
			}
		}
		/**
		* Whether this deployment can be restarted from the host (Electron only).
		* @returns true when running under an Electron main process.
		*/
		restartSupported() {
			return typeof process.versions?.electron === "string";
		}
		/**
		* Restart the DSH deployment immediately (Desktop only). The response is
		* flushed first, then the Electron app relaunches with the same command
		* line; non-Electron deployments report restart as unsupported.
		* @returns the restart outcome.
		*/
		async restartApp() {
			if (!this.restartSupported()) return { ok: false, restartSupported: false, message: "当前部署不支持立即重启，请手动重启 DSH。" };
			try {
				const { app } = await import("electron");
				setTimeout(() => {
					try {
						app.relaunch();
					} catch (_relaunchFailure) {
						/* app.exit still closes the process */
					}
					try {
						app.exit(0);
					} catch (_exitFailure) {
						/* nothing left to do */
					}
				}, 800);
				return { ok: true, restartSupported: true, message: "正在重启 DSH…" };
			} catch (error) {
				return { ok: false, restartSupported: false, message: `无法重启：${error instanceof Error ? error.message : String(error)}` };
			}
		}
		/**
		* The Harness home directory (`$DSH_HOME` or `~/.dsh`), mirroring
		* `resolveDshHome` — where the home-level user patch layer lives.
		* @returns the absolute home directory.
		*/
		homeDir() {
			const override = process.env.DSH_HOME;
			return typeof override === "string" && override.trim().length > 0 ? override : join(homedir(), ".dsh");
		}
		/** The rolling backup directory inside the active profile. */
		backupDir() {
			return join(this.profileDir(), ".kidai-backups");
		}
		/**
		* Snapshot the files an install/update/toggle can mutate — the profile
		* manifest, the lockfile, and the home-level user patch layer — into a
		* timestamped backup folder, then prune old snapshots.
		* @param reason - short label used in the folder name.
		* @returns the backup path, or null when nothing could be copied.
		*/
		backupProfileFiles(reason) {
			try {
				const dir = this.backupDir();
				const stamp = new Date().toISOString().replace(/[:.]/g, "-");
				const target = join(dir, `${stamp}-${reason}`);
				mkdirSync(target, { recursive: true });
				const sources = [["package.json", join(this.profileDir(), "package.json")]];
				const lock = join(this.profileDir(), "pnpm-lock.yaml");
				if (existsSync(lock)) sources.push(["pnpm-lock.yaml", lock]);
				const patch = join(this.homeDir(), PROFILE_PATCH_FILENAME);
				if (existsSync(patch)) sources.push(["cordis.patch.yml", patch]);
				let copied = 0;
				for (const [name, path] of sources) {
					try {
						writeFileSync(join(target, name), readFileSync(path));
						copied += 1;
					} catch {
						/* skip unreadable sources */
					}
				}
				if (copied === 0) return null;
				this.pruneBackups();
				return target;
			} catch {
				return null;
			}
		}
		/** Restore a snapshot's files back over the live profile/home files. */
		restoreBackup(backupPath) {
			try {
				for (const name of ["package.json", "pnpm-lock.yaml", "cordis.patch.yml"]) {
					const source = join(backupPath, name);
					if (!existsSync(source)) continue;
					const target = name === "cordis.patch.yml" ? join(this.homeDir(), PROFILE_PATCH_FILENAME) : join(this.profileDir(), name);
					writeFileSync(target, readFileSync(source));
				}
				return true;
			} catch {
				return false;
			}
		}
		/** Keep only the newest {@link BACKUP_KEEP} snapshots. */
		pruneBackups() {
			try {
				const dir = this.backupDir();
				if (!existsSync(dir)) return;
				const entries = readdirSync(dir).filter((name) => /^\d{4}-\d{2}-\d{2}T/.test(name)).sort().reverse();
				for (const name of entries.slice(BACKUP_KEEP)) {
					try {
						rmSync(join(dir, name), { recursive: true, force: true });
					} catch {
						/* best-effort */
					}
				}
			} catch {
				/* best-effort */
			}
		}
		/**
		* Open an installed plugin's local directory in the platform file
		* manager (Explorer / Finder / xdg-open).
		* @param packageName - the installed package name.
		* @returns the open outcome with the resolved path.
		*/
		async openLocal(packageName) {
			if (typeof packageName !== "string" || !NPM_SPEC_PATTERN.test(packageName)) return { ok: false, packageName: String(packageName ?? ""), message: "kidai-plugin-market-hub: invalid package name", restartNeeded: false };
			const dir = this.resolvePackageDir(packageName);
			if (!existsSync(dir)) return { ok: false, packageName, message: `kidai-plugin-market-hub: 未找到本地目录 ${dir}`, restartNeeded: false };
			const opener = process.platform === "win32" ? ["explorer.exe", dir] : process.platform === "darwin" ? ["open", dir] : ["xdg-open", dir];
			const result = await this.runChild(opener[0], opener.slice(1), { cwd: undefined, timeoutMs: 15000, env: process.env });
			if (result.error !== void 0) return { ok: false, packageName, message: `kidai-plugin-market-hub: 打开本地目录失败: ${result.error.message}`, restartNeeded: false };
			return { ok: true, packageName, path: dir, message: `已打开目录：\n${dir}`, restartNeeded: false };
		}
		/**
		* Install one plugin into the active profile: resolve an npm spec (or a
		* GitHub repo) with anti-squatting, run a fail-closed static security
		* audit unless `allowRisky`, snapshot the profile files, run pnpm,
		* reconcile the `dsh.profile.bundles` layer list, then verify the
		* installed manifest and roll back on any failure. The new plugin
		* activates after the deployment restarts.
		* @param spec - a repo full name (`owner/repo`), GitHub URL, or npm name.
		* @param options - `{ allowRisky?: boolean }` — bypass the audit gate.
		* @returns the install outcome with a user-facing message.
		*/
		async installPlugin(spec, options) {
			if (typeof spec !== "string" || spec.trim().length === 0) return { ok: false, packageName: "", message: "kidai-plugin-market-hub: empty install spec", restartNeeded: false, command: "" };
			const normalized = spec.trim();
			const allowRisky = options !== null && typeof options === "object" && options.allowRisky === true;
			// Runtime-compat warnings collected during the guard: when the user
			// acknowledged the risk (`allowRisky`), the install proceeds and the
			// success payload carries the warnings so the UI can show them.
			let runtimeRiskWarnings = null;
			const profileDir = this.profileDir();
			const manifestPath = join(profileDir, "package.json");
			if (!existsSync(manifestPath)) return { ok: false, packageName: normalized, message: `kidai-plugin-market-hub: ${profileDir} has no package.json — not a DSH profile`, restartNeeded: false, command: "" };
			const resolved = await resolveInstallSpec(normalized);
			if (resolved === null) return { ok: false, packageName: normalized, message: "kidai-plugin-market-hub: spec is neither a known npm package nor a GitHub repository", restartNeeded: false, command: "" };
			let pnpmSpec = resolved.spec;
			// Fail-closed audit: scan the exact artifact before anything is
			// written; blocked findings require an explicit allowRisky retry.
			if (!allowRisky) {
				const audit = await this.auditPackage(normalized);
				if (audit.blocked) {
					return {
						ok: false,
						packageName: pnpmSpec,
						message: "kidai-plugin-market-hub: 安全审查发现高危风险,已拦截安装(如确需安装,请在风险提示页点击「我已知晓」后重试)。",
						restartNeeded: false,
						command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`,
						auditBlocked: true,
						findings: audit.findings
					};
				}
			}
			const pnpm = this.resolvePnpm();
			if (pnpm === null) return { ok: false, packageName: normalized, message: "kidai-plugin-market-hub: pnpm is not available (install pnpm, or run `dsh plugin --profile <name> add <package>` yourself)", restartNeeded: false, command: `dsh plugin add ${normalized}` };
			const before = this.readManifest();
			const backup = this.backupProfileFiles("install");
			// file: run the bundled pnpm script under this process's Node
			// (Electron under ELECTRON_RUN_AS_NODE); command: pnpm on PATH.
			const command = pnpm.kind === "file" ? process.execPath : pnpm.name;
			// For GitHub-hosted plugins, if the direct clone fails (github.com
			// unreachable) retry once through the ghproxy.net mirror, which is
			// reachable in environments where GitHub is blocked.
			let gitMirrorSpec = null;
			let subVendorDir = null;
			let usedMirror = false;
			if (resolved.kind === "git" && typeof resolved.sub === "string" && resolved.sub.length > 0) {
				// Monorepo subpackage (`owner/repo#sub`): pnpm cannot install one
				// subdir of a git URL without cloning the whole repo (slow and
				// often times out through mirrors), so fetch the repo tarball
				// through the mirror chain, extract it, locate the subpackage
				// dir, copy it to a stable vendor dir inside the profile, and
				// install with a `file:` spec — same result, mirror-friendly.
				const prepared = await this.prepareGitSubpackage(resolved, profileDir);
				if (!prepared.ok) {
					return {
						ok: false,
						packageName: normalized,
						message: prepared.message,
						restartNeeded: false,
						command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`
					};
				}
				pnpmSpec = `file:${prepared.dir}`;
				subVendorDir = prepared.dir;
				usedMirror = prepared.usedMirror;
			} else if (resolved.kind === "git" && typeof resolved.repo === "string") {
				// Whole-repo install. When github.com is unreachable the plain
				// `pnpm add git+https://github.com/...` clone stalls for the full
				// timeout, and the mirror git protocol (ghproxy.net) demands
				// credentials — but the mirror TARBALL chain (codeload/ghproxy/
				// ghfast/gh-proxy) works. Fall back to the tarball path so an
				// unreachable GitHub does not turn into a multi-minute hang.
				if (!(this.githubReachableOverride !== void 0 ? await this.githubReachableOverride() : await githubReachable())) {
					const prepared = await this.prepareGitSubpackage(resolved, profileDir);
					if (!prepared.ok) {
						return {
							ok: false,
							packageName: normalized,
							message: prepared.message,
							restartNeeded: false,
							command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`
						};
					}
					pnpmSpec = `file:${prepared.dir}`;
					subVendorDir = prepared.dir;
					usedMirror = prepared.usedMirror;
				} else {
					gitMirrorSpec = `git+https://ghproxy.net/https://github.com/${resolved.repo}.git`;
				}
			}
			let outcome = null;
			for (const attempt of [pnpmSpec, gitMirrorSpec]) {
				if (attempt === null) break;
				const attemptArgs = pnpm.kind === "file" ? [pnpm.path, "add", attempt] : ["add", attempt];
				const attemptOutcome = await this.runChild(command, attemptArgs, {
					cwd: profileDir,
					viaShell: pnpm.kind !== "file",
					timeoutMs: INSTALL_TIMEOUT_MS,
					env: {
						...process.env,
						CI: "true",
						ELECTRON_RUN_AS_NODE: "1"
					}
				});
				outcome = attemptOutcome;
				if (attempt !== pnpmSpec) usedMirror = true;
				const attemptFailed = attemptOutcome.error !== void 0 || attemptOutcome.timedOut || attemptOutcome.status !== 0;
				if (!attemptFailed) break;
				// direct failed and a mirror retry remains — try it
			}
			const failed = outcome.error !== void 0 || outcome.timedOut || outcome.status !== 0;
			if (failed) {
				const detail = outcome.error !== void 0 ? outcome.error.message : this.tail((outcome.stderr ?? outcome.stdout ?? "").trim());
				const hint = resolved.kind === "git" ? " (git-hosted plugins build on install via prepare scripts, which pnpm blocks until allowed — add the printed key under allowBuilds in the profile's pnpm-workspace.yaml, then re-run)" : "";
				const rolledBack = backup !== null && this.restoreBackup(backup);
				return { ok: false, packageName: normalized, message: `kidai-plugin-market-hub: pnpm add ${pnpmSpec} failed: ${detail}${hint}${rolledBack ? "\n已自动回滚到安装前状态。" : ""}`, restartNeeded: false, command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}` };
			}
			this.reconcileBundles(before, profileDir, manifestPath);
			// Post-install loadability guard: a marketplace install must produce a
			// loadable profile bundle (the package declares `dsh.bundle.patch` —
			// the same contract the loader and `dsh plugin add` use). pnpm may
			// rewrite the spec (a git URL becomes the package's own name), so the
			// newly-added dependency keys are computed from the manifest diff
			// instead of trusting `pnpmSpec`. Anything not loadable is rolled back
			// so the UI never promises "重启后生效" for a plugin that will not load.
			const beforeDeps = new Set(Object.keys(before.dependencies ?? {}));
			const afterManifest = this.readManifest();
			const newDeps = Object.keys(afterManifest.dependencies ?? {}).filter((name) => !beforeDeps.has(name));
			if (newDeps.length === 0) {
				// pnpm exited 0 but the manifest did not change. The most common
				// reason is that the plugin is ALREADY a dependency ("Already up
				// to date") — report that gracefully instead of a scary failure.
				const depNames = Object.keys(afterManifest.dependencies ?? {});
				const alreadyPresent = depNames.some((name) => {
					if (name === normalized || name === pnpmSpec) return true;
					const value = String(afterManifest.dependencies[name] ?? "");
					// Subpackage installs record the package's own name from the
					// vendor manifest (`@scope/sub`), so also match by that name.
					if (typeof resolved.sub === "string" && resolved.sub.length > 0 && (name === resolved.sub || name.endsWith(`/${resolved.sub}`))) return true;
					return resolved.repo !== void 0 && value.includes(resolved.repo);
				});
				if (alreadyPresent) {
					return {
						ok: true,
						alreadyInstalled: true,
						packageName: pnpmSpec,
						message: `该插件已在依赖清单中，无需重复安装。\n目录：${profileDir}`,
						restartNeeded: false,
						command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`
					};
				}
				const rolledBack = backup !== null && this.restoreBackup(backup);
				const pnpmTail = this.tail(((outcome.stdout ?? "") + " " + (outcome.stderr ?? "")).trim());
				return { ok: false, packageName: pnpmSpec, message: `kidai-plugin-market-hub: pnpm add 完成但未在配置清单中新增任何依赖，已回滚。\npnpm 输出：${pnpmTail}${rolledBack ? "" : "\n(备份目录: .kidai-backups)"}`, restartNeeded: false, command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}` };
			}
			const notLoadable = newDeps.filter((name) => {
				try {
					const pkgDir = join(profileDir, "node_modules", name);
					const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
					if (manifest.dsh?.bundle?.patch === void 0) return true;
					// A bundle must also resolve to an importable entry point.
					// pnpm installs `file:`/git deps as a copy, and a TypeScript
					// source-only subpackage declares `main: lib/index.js` that
					// does not exist until it is built — DSH would then fail at
					// boot (ERR_MODULE_NOT_FOUND). Fail the install here instead.
					// `packageEntryExists` also covers the NO-declared-entry case
					// (a non-plugin repo that declares `dsh.bundle.patch` but
					// ships no main/exports/index — Node's implicit `index.js`
					// fallback would fail the whole plugin tree at boot).
					return !packageEntryExists(pkgDir, manifest);
				} catch {
					return true;
				}
			});
			// Runtime-compatibility guard: a plugin built against an older DSH
			// runtime (peer `@deepseek-ai/dsh-*: 0.1.0-rc.6`) can reference APIs
			// the bundled runtime (rc.7) changed — e.g. the `settings.plugin.item`
			// slot became keyed and now requires `options.key`. The market repairs
			// the known breaks automatically (keyed-slot injection below), so this
			// guard does NOT hard-reject: without `allowRisky` it stops for an
			// explicit risk acknowledgement; with `allowRisky` the install
			// proceeds, the repaired bundle is installed, and the outcome carries
			// the warning. A stale peer range must not block the user.
			{
				const runtimeVersion = this.runtimeVersionOverride !== void 0 ? this.runtimeVersionOverride : detectRuntimeVersion();
				const incompatible = [];
				if (runtimeVersion !== null) {
					for (const name of newDeps) {
						try {
							const manifest = JSON.parse(readFileSync(join(profileDir, "node_modules", name, "package.json"), "utf8"));
							const peers = manifest?.peerDependencies;
							if (peers === null || typeof peers !== "object" || Array.isArray(peers)) continue;
							for (const [peer, range] of Object.entries(peers)) {
								if (!peer.startsWith("@deepseek-ai/dsh-") || typeof range !== "string" || range.length === 0) continue;
								if (!versionSatisfies(runtimeVersion, range)) {
									incompatible.push(`${name} 要求 ${peer} ${range},当前 DSH 运行时为 ${runtimeVersion}`);
									break;
								}
							}
						} catch {
							/* unreadable manifest — skip */
						}
					}
				}
				if (incompatible.length > 0 && !allowRisky) {
					for (const depName of newDeps) {
						await this.runChild(command, pnpm.kind === "file" ? [pnpm.path, "remove", depName] : ["remove", depName], {
							cwd: profileDir,
							viaShell: pnpm.kind !== "file",
							timeoutMs: INSTALL_TIMEOUT_MS,
							env: { ...process.env, CI: "true", ELECTRON_RUN_AS_NODE: "1" }
						});
					}
					const rolledBack = backup !== null && this.restoreBackup(backup);
					return {
						ok: false,
						riskConfirmRequired: true,
						runtimeIncompatible: incompatible,
						packageName: newDeps.join(", "),
						message: `kidai-plugin-market-hub: 该插件声明旧版 DSH 运行时（${incompatible.join("；")}）。市场会先自动修补已知的兼容差异（keyed-slot 注册注入等），但旧版插件可能仍存在未覆盖的 API 变更，继续安装有 DSH 启动失败的风险。${rolledBack ? "已回滚到安装前状态。" : "\n(备份目录: .kidai-backups)"}如确认继续，请在确认框点击「我已知晓」。`,
						restartNeeded: false,
						command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`
					};
				}
				// allowRisky acknowledged the risk — keep the warnings to attach
				// to the success payload below.
				if (incompatible.length > 0) runtimeRiskWarnings = incompatible;
			}
			if (notLoadable.length > 0) {
				for (const name of notLoadable) {
					await this.runChild(command, pnpm.kind === "file" ? [pnpm.path, "remove", name] : ["remove", name], {
						cwd: profileDir,
						viaShell: pnpm.kind !== "file",
						timeoutMs: INSTALL_TIMEOUT_MS,
						env: { ...process.env, CI: "true", ELECTRON_RUN_AS_NODE: "1" }
					});
				}
				const rolledBack = backup !== null && this.restoreBackup(backup);
				return {
					ok: false,
					packageName: notLoadable.join(", "),
					message: `kidai-plugin-market-hub: 安装后校验失败——${notLoadable.join(", ")} 无法作为 DSH 插件加载（未声明 dsh.bundle.patch，或声明的入口文件 main/exports 在安装目录中不存在——TypeScript 源码包子包需要先构建生成 lib/），已自动卸载并回滚。${rolledBack ? "" : "\n(备份目录: .kidai-backups)"}`,
					restartNeeded: false,
					command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`
				};
			}
			// Generic client repair (not per-plugin): rc.7 turned several client
			// slots into `kind: "keyed"` registrations that require `options.key`.
			// Plugins built against rc.6 omit it, so their browser half would fail
			// at boot ("keyed slot ... requires options.key"). Automatically inject
			// `key` (from the registration's own `id`) into every keyed-slot
			// register call in each newly installed bundle's client bundle. This
			// is a mechanical, pattern-based migration — the same repair applies to
			// any plugin that hits the same API change.
			for (const name of newDeps) {
				try {
					const pkgDir = join(profileDir, "node_modules", name);
					const clientPath = resolveClientBundlePath(pkgDir);
					if (clientPath === null) continue;
					const original = readFileSync(clientPath, "utf8");
					const repaired = patchKeyedSlotRegistrations(original);
					if (repaired.patched && repaired.source !== original) {
						writeFileSync(clientPath, repaired.source);
						this.ctx.logger.info?.(`kidai-plugin-market-hub: 已自动修补 ${name} 的 keyed slot 注册(rc.7 兼容)`);
					}
				} catch {
					/* a broken client bundle is caught by the runtime guard below */
				}
			}
			// Duplicate-entry-id guard (scan + prompt only — the installed plugin
			// files are NEVER modified): a bundle whose patch INSERTs rows whose
			// ids already exist in the composed tree (core rows, or rows from
			// other profile bundles) would make DSH fail at boot
			// (assertUniqueEntryIds). Such inserts almost always re-declare
			// services the composition already mounts; instead of silently
			// rewriting the third-party patch, the install is cancelled with a
			// clear explanation so the user can decide how to proceed.
			const existingRowIds = /* @__PURE__ */ new Set();
			try {
				const loader = this.ctx.loader;
				if (loader !== void 0 && typeof loader.entries === "function") {
					for (const entry of loader.entries()) {
						const id = String(entry?.id ?? "");
						if (id.length > 0) existingRowIds.add(id.split(":").pop() ?? id);
					}
				}
			} catch { /* loader unavailable — skip the guard */ }
			const uniqueCollisions = [...new Set((() => {
				const hits = [];
				if (existingRowIds.size === 0) return hits;
				for (const name of newDeps) {
					try {
						const manifest = JSON.parse(readFileSync(join(profileDir, "node_modules", name, "package.json"), "utf8"));
						const patchRel = manifest?.dsh?.bundle?.patch;
						if (typeof patchRel !== "string" || patchRel.length === 0) continue;
						const patchPath = join(profileDir, "node_modules", name, patchRel);
						if (!existsSync(patchPath)) continue;
						// logLevel silent: plugin patches legitimately use !!js
						// expressions that the plain yaml lib cannot resolve.
						const doc = YAML.parse(readFileSync(patchPath, "utf8"), { logLevel: "silent" });
						if (!Array.isArray(doc)) continue;
						for (const row of doc) {
							if (row === null || typeof row !== "object" || !Array.isArray(row.insert)) continue;
							for (const ins of row.insert) {
								if (ins !== null && typeof ins === "object" && typeof ins.id === "string" && existingRowIds.has(ins.id)) hits.push(ins.id);
							}
						}
					} catch { /* unreadable patch — skip this package */ }
				}
				return hits;
			})())];
			if (uniqueCollisions.length > 0) {
				for (const name of newDeps) {
					await this.runChild(command, pnpm.kind === "file" ? [pnpm.path, "remove", name] : ["remove", name], {
						cwd: profileDir,
						viaShell: pnpm.kind !== "file",
						timeoutMs: INSTALL_TIMEOUT_MS,
						env: { ...process.env, CI: "true", ELECTRON_RUN_AS_NODE: "1" }
					});
				}
				const rolledBack = backup !== null && this.restoreBackup(backup);
				return {
					ok: false,
					conflictIds: uniqueCollisions,
					packageName: newDeps.join(", "),
					message: `kidai-plugin-market-hub: 安全扫描发现该插件的补丁 insert 了与组合树现有条目重复的 loader id（${uniqueCollisions.join(", ")}）。这些服务组合树已提供；为避免 DSH 因重复条目 id 无法启动，已取消安装，且未修改插件文件。如需安装，请手动编辑该插件的 cordis.patch.yml 移除这些重复的 insert 行后重试。${rolledBack ? "" : "\n(备份目录: .kidai-backups)"}`,
					restartNeeded: false,
					command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`
				};
			}
			const channel = resolved.squat === true ? "git(防抢注回退)" : resolved.kind === "npm" ? "npm" : typeof resolved.sub === "string" && resolved.sub.length > 0 ? "git(子包)" : "git";
			// Loader-name guard: every `insert` row's `name` must resolve to a
			// package that is actually installed in this profile. Some plugins
			// (e.g. dsh-tavern) declare `name: '@local/dsh-tavern'` and depend on
			// their own install.cmd/install.ps1 to copy the package under
			// `node_modules/@local/...` — a step a plain `pnpm add` never runs.
			// Installing such a plugin without that link makes DSH fail at boot
			// (`Cannot find package '@local/dsh-tavern'`).
			//
			// Instead of rejecting, the market now performs the link step
			// generically: a `@local/<real>` insert name is auto-satisfied by
			// creating a junction `node_modules/@local/<real>` → `node_modules/<real>`
			// when `<real>` is (or just became) a profile dependency. Only names
			// with no installable target are rejected.
			{
				const unresolvedNames = [];
				const installedDepNames = new Set(Object.keys(afterManifest.dependencies ?? {}));
				// `@local/<real>` → `node_modules/@local/<real>` junction, created
				// once per real package across all new deps' patches.
				const linkedLocalNames = /* @__PURE__ */ new Set();
				for (const name of newDeps) {
					try {
						const manifest = JSON.parse(readFileSync(join(profileDir, "node_modules", name, "package.json"), "utf8"));
						const patchRel = manifest?.dsh?.bundle?.patch;
						if (typeof patchRel !== "string" || patchRel.length === 0) continue;
						const patchPath = join(profileDir, "node_modules", name, patchRel);
						if (!existsSync(patchPath)) continue;
						const doc = YAML.parse(readFileSync(patchPath, "utf8"), { logLevel: "silent" });
						if (!Array.isArray(doc)) continue;
						for (const row of doc) {
							if (row === null || typeof row !== "object" || !Array.isArray(row.insert)) continue;
							for (const ins of row.insert) {
								if (ins === null || typeof ins !== "object" || typeof ins.name !== "string" || ins.name.length === 0) continue;
								// `name` may be the plugin's own npm name, a
								// sibling package already declared, or an entry
								// id that the loader resolves from the tree.
								if (installedDepNames.has(ins.name) || ins.name === name) continue;
								if (existsSync(join(profileDir, "node_modules", ...ins.name.split("/")))) continue;
								// `@local/<real>`: link to the real package when
								// it is (or just became) a dependency.
								const localPrefix = "@local/";
								if (ins.name.startsWith(localPrefix)) {
									const real = ins.name.slice(localPrefix.length);
									const realDir = join(profileDir, "node_modules", ...real.split("/"));
									if ((installedDepNames.has(real) || newDeps.includes(real)) && existsSync(realDir)) {
										if (!linkedLocalNames.has(real)) {
											linkedLocalNames.add(real);
											try {
												const localDir = join(profileDir, "node_modules", "@local");
												mkdirSync(join(localDir, ...real.split("/").slice(0, -1)), { recursive: true });
												symlinkSync(realDir, join(localDir, ...real.split("/")), "junction");
												this.ctx.logger.info?.(`kidai-plugin-market-hub: 已自动为 ${real} 创建 @local 链接(loader 名 ${ins.name})`);
											} catch {
												/* junction creation failed — fall through to unresolved */
											}
										}
										if (existsSync(join(profileDir, "node_modules", ...ins.name.split("/")))) continue;
									}
								}
								unresolvedNames.push(`${ins.name} (来自 ${name} 的 patch insert)`);
							}
						}
					} catch { /* unreadable patch — skip this package */ }
				}
				if (unresolvedNames.length > 0) {
					for (const depName of newDeps) {
						await this.runChild(command, pnpm.kind === "file" ? [pnpm.path, "remove", depName] : ["remove", depName], {
							cwd: profileDir,
							viaShell: pnpm.kind !== "file",
							timeoutMs: INSTALL_TIMEOUT_MS,
							env: { ...process.env, CI: "true", ELECTRON_RUN_AS_NODE: "1" }
						});
					}
					const rolledBack = backup !== null && this.restoreBackup(backup);
					return {
						ok: false,
						unresolvedNames,
						packageName: newDeps.join(", "),
						message: `kidai-plugin-market-hub: 该插件的补丁 insert 引用了本 profile 中不存在的包名（${unresolvedNames.join("; ")}）。这类插件通常依赖其自带的安装脚本(install.cmd/install.ps1)把包复制到 node_modules/@local/ 等本地目录，纯 pnpm 安装无法完成该步骤，会导致 DSH 启动失败。已取消安装并回滚；请改用插件自带的安装脚本，或改装 npm 发布的常规包。${rolledBack ? "" : "\n(备份目录: .kidai-backups)"}`,
						restartNeeded: false,
						command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`
					};
				}
			}
			// `pnpmSpec` may be a `file:<vendor>` path for subpackage installs;
			// show the human-friendly spec (owner/repo#sub) in the message.
			const displaySpec = typeof resolved.sub === "string" && resolved.sub.length > 0 ? `${resolved.repo}#${resolved.sub}` : pnpmSpec;
			const riskNote = runtimeRiskWarnings !== null && runtimeRiskWarnings.length > 0
				? `\n风险提示：该插件声明旧版 DSH 运行时（${runtimeRiskWarnings.join("；")}），市场已自动修补已知兼容差异（keyed-slot 注册注入等）；若启动后异常，请在已安装列表卸载该插件。`
				: "";
			return {
				ok: true,
				packageName: pnpmSpec,
				message: `已安装 ${displaySpec}(通道: ${channel})\n目录：${profileDir}\n重启 DSH 后生效。${usedMirror ? "\n（GitHub 直连失败，已通过镜像完成安装）" : ""}${riskNote}`,
				restartNeeded: true,
				command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`,
				channel,
				backupPath: backup ?? "",
				runtimeIncompatible: runtimeRiskWarnings
			};
		}
		/**
		* Check installed plugins for newer npm versions. Local `link:`/`file:`/
		* `workspace:` sources and the core `@deepseek-ai/*` bundles are reported
		* as skipped rather than updatable.
		* @returns `{ updates, skipped }`.
		*/
		async checkUpdates() {
			const manifest = this.readManifest();
			const deps = manifest.dependencies ?? {};
			const updates = [];
			const skipped = [];
			const names = Object.keys(deps).sort();
			for (const name of names) {
				const raw = deps[name];
				const current = typeof raw === "string" ? raw.replace(/^[~^]/, "") : String(raw ?? "");
				if (/^(link|file|workspace):/.test(String(raw ?? ""))) {
					skipped.push({ packageName: name, reason: "local-source" });
					continue;
				}
				if (name.startsWith("@deepseek-ai/")) {
					skipped.push({ packageName: name, reason: "core" });
					continue;
				}
				if (!NPM_SPEC_PATTERN.test(name)) {
					skipped.push({ packageName: name, reason: "not-an-npm-name" });
					continue;
				}
				const latest = await npmRegistryLatest(name);
				if (latest === null || latest.version.length === 0) {
					skipped.push({ packageName: name, reason: "registry-unreachable" });
					continue;
				}
				updates.push({ packageName: name, current, latest: latest.version, updatable: current !== latest.version });
			}
			return { updates: updates.filter((entry) => entry.updatable), skipped };
		}
		/**
		* Update one installed plugin to its latest npm version: snapshot the
		* profile files, run `pnpm update <name>`, then reconcile the bundle
		* layer. Fails closed with a rollback when pnpm fails.
		* @param packageName - an installed npm package name.
		* @returns the update outcome.
		*/
		async updatePlugin(packageName) {
			if (typeof packageName !== "string" || !NPM_SPEC_PATTERN.test(packageName)) return { ok: false, packageName: String(packageName ?? ""), message: "kidai-plugin-market-hub: invalid package name", restartNeeded: false };
			const profileDir = this.profileDir();
			const manifestPath = join(profileDir, "package.json");
			if (!existsSync(manifestPath)) return { ok: false, packageName, message: `kidai-plugin-market-hub: ${profileDir} has no package.json — not a DSH profile`, restartNeeded: false };
			const manifest = this.readManifest();
			if (!Object.hasOwn(manifest.dependencies ?? {}, packageName)) return { ok: false, packageName, message: `kidai-plugin-market-hub: ${packageName} 未安装,无法更新`, restartNeeded: false };
			const raw = manifest.dependencies[packageName];
			if (/^(link|file|workspace):/.test(String(raw ?? ""))) return { ok: false, packageName, message: `kidai-plugin-market-hub: ${packageName} 为本地源码安装(link/file/workspace),跳过在线更新`, restartNeeded: false };
			const pnpm = this.resolvePnpm();
			if (pnpm === null) return { ok: false, packageName, message: "kidai-plugin-market-hub: pnpm is not available", restartNeeded: false };
			const backup = this.backupProfileFiles("update");
			const command = pnpm.kind === "file" ? process.execPath : pnpm.name;
			const args = pnpm.kind === "file" ? [pnpm.path, "update", packageName] : ["update", packageName];
			const outcome = await this.runChild(command, args, {
				cwd: profileDir,
				viaShell: pnpm.kind !== "file",
				timeoutMs: INSTALL_TIMEOUT_MS,
				env: { ...process.env, CI: "true", ELECTRON_RUN_AS_NODE: "1" }
			});
			const failed = outcome.error !== void 0 || outcome.timedOut || outcome.status !== 0;
			if (failed) {
				const detail = outcome.error !== void 0 ? outcome.error.message : this.tail((outcome.stderr ?? outcome.stdout ?? "").trim());
				const rolledBack = backup !== null && this.restoreBackup(backup);
				return { ok: false, packageName, message: `kidai-plugin-market-hub: pnpm update ${packageName} failed: ${detail}${rolledBack ? "\n已自动回滚到更新前状态。" : ""}`, restartNeeded: false };
			}
			this.reconcileBundles(this.readManifest(), profileDir, manifestPath);
			const latest = await npmRegistryLatest(packageName);
			return { ok: true, packageName, message: `已更新 ${packageName}${latest !== null ? ` → ${latest.version}` : ""}\n重启 DSH 后生效。`, restartNeeded: true, backupPath: backup ?? "" };
		}
		/**
		* Uninstall one third-party plugin: snapshot the profile files, run
		* `pnpm remove <name>`, reconcile the bundle layer, and drop any HOME
		* patch disable/enable row for it. Refuses native/core packages.
		* @param packageName - an installed third-party package name.
		* @returns the uninstall outcome.
		*/
		async uninstallPlugin(packageName) {
			if (typeof packageName !== "string" || packageName.trim().length === 0) return { ok: false, packageName: String(packageName ?? ""), message: "kidai-plugin-market-hub: invalid package name", restartNeeded: false };
			// `@local/<name>` is the loader-facing name for a locally linked
			// package (e.g. tavern's patch references `@local/dsh-tavern` while
			// the profile dependency is `dsh-tavern`). Uninstall the real package
			// and also remove the `@local/...` junction.
			const localPrefix = "@local/";
			const isLocalLinked = packageName.startsWith(localPrefix);
			const realName = isLocalLinked ? packageName.slice(localPrefix.length) : packageName;
			if (!NPM_SPEC_PATTERN.test(realName)) return { ok: false, packageName, message: "kidai-plugin-market-hub: invalid package name", restartNeeded: false };
			if (realName.startsWith("@deepseek-ai/") || realName === "dsh-plugin-desktop") return { ok: false, packageName, message: `kidai-plugin-market-hub: ${packageName} 是 DSH 核心插件,不能卸载`, restartNeeded: false };
			const profileDir = this.profileDir();
			const manifestPath = join(profileDir, "package.json");
			if (!existsSync(manifestPath)) return { ok: false, packageName, message: `kidai-plugin-market-hub: ${profileDir} has no package.json — not a DSH profile`, restartNeeded: false };
			const manifest = this.readManifest();
			if (!Object.hasOwn(manifest.dependencies ?? {}, realName)) return { ok: false, packageName, message: `kidai-plugin-market-hub: ${realName} 未在依赖清单中,无法卸载`, restartNeeded: false };
			const pnpm = this.resolvePnpm();
			if (pnpm === null) return { ok: false, packageName, message: "kidai-plugin-market-hub: pnpm is not available", restartNeeded: false };
			const before = this.readManifest();
			const backup = this.backupProfileFiles("uninstall");
			const command = pnpm.kind === "file" ? process.execPath : pnpm.name;
			const args = pnpm.kind === "file" ? [pnpm.path, "remove", realName] : ["remove", realName];
			const outcome = await this.runChild(command, args, {
				cwd: profileDir,
				viaShell: pnpm.kind !== "file",
				timeoutMs: INSTALL_TIMEOUT_MS,
				env: { ...process.env, CI: "true", ELECTRON_RUN_AS_NODE: "1" }
			});
			const failed = outcome.error !== void 0 || outcome.timedOut || outcome.status !== 0;
			if (failed) {
				const detail = outcome.error !== void 0 ? outcome.error.message : this.tail((outcome.stderr ?? outcome.stdout ?? "").trim());
				const rolledBack = backup !== null && this.restoreBackup(backup);
				return { ok: false, packageName, message: `kidai-plugin-market-hub: pnpm remove ${realName} failed: ${detail}${rolledBack ? "\n已自动回滚到卸载前状态。" : ""}`, restartNeeded: false };
			}
			const after = this.readManifest();
			if (Object.hasOwn(after.dependencies ?? {}, realName)) {
				const rolledBack = backup !== null && this.restoreBackup(backup);
				return { ok: false, packageName, message: `kidai-plugin-market-hub: 卸载后 ${realName} 仍在依赖清单中,已回滚。${rolledBack ? "" : "\n(备份目录: .kidai-backups)"}`, restartNeeded: false };
			}
			// Remove the `@local/...` junction when the package was locally linked
			// — under BOTH names: `@local/<real>` for an explicit `@local/` spec,
			// and a leftover `@local/<short>` junction (pointing at the real dir)
			// when the user uninstalled by the plain package name.
			try {
				const localRoot = join(profileDir, "node_modules", "@local");
				// realName may be scoped (`@scope/pkg`) → junction lives at
				// `@local/@scope/pkg`; the short segment covers `@local/pkg`.
				// Do NOT gate on existsSync(): after `pnpm remove` deletes the
				// real dir the junction is DANGLING, and existsSync() reports
				// false for a dangling junction — rmSync(force) still removes it.
				const candidates = [realName, realName.split("/").pop()];
				for (const seg of new Set(candidates)) {
					const junctionPath = join(localRoot, ...String(seg).split("/"));
					try {
						rmSync(junctionPath, { recursive: true, force: true });
					} catch {
						/* best-effort junction cleanup */
					}
				}
			} catch {
				/* best-effort junction cleanup */
			}
			// Reconcile bundles: remove the package (both names) from the layer list.
			const bundles = Array.isArray(after.dsh?.profile?.bundles) ? after.dsh.profile.bundles.filter((name) => name !== realName && name !== packageName) : [];
			after.dsh = { ...after.dsh, profile: { ...after.dsh?.profile, bundles } };
			writeFileSync(manifestPath, `${JSON.stringify(after, null, 2)}\n`);
			// Drop any HOME patch row (disable/enable/config) for this package.
			// The patch row id is the loader entry's plain id (e.g. `tavern`),
			// which may be neither the real name nor the @local name — so resolve
			// the loader entry id(s) for this package and remove those rows too.
			const entryIds = /* @__PURE__ */ new Set();
			try {
				const loader = this.ctx.loader;
				if (loader !== void 0 && typeof loader.entries === "function") {
					for (const entry of loader.entries()) {
						const name = entry?.options?.name;
						if (name !== packageName && name !== realName) continue;
						const id = String(entry?.id ?? "");
						if (id.length > 0) {
							entryIds.add(id);
							const short = id.split(":").pop();
							if (short.length > 0) entryIds.add(short);
						}
					}
				}
			} catch {
				/* loader unavailable */
			}
			try {
				const patchPath = join(this.homeDir(), PROFILE_PATCH_FILENAME);
				const doc = YAML.parse(readFileSync(patchPath, "utf8"), { logLevel: "silent" });
				if (Array.isArray(doc)) {
					const shortReal = realName.split("/").pop();
					const shortLocal = packageName.split("/").pop();
					const filtered = doc.filter((row) => row === null || typeof row !== "object" || Array.isArray(row) || row.id !== realName && row.id !== packageName && row.id !== shortReal && row.id !== shortLocal && !entryIds.has(row.id));
					if (filtered.length !== doc.length) writeFileSync(patchPath, YAML.stringify(filtered));
				}
				this.lastOverrides.delete(packageName);
				this.lastOverrides.delete(realName);
			} catch {
				/* best-effort patch cleanup */
			}
			return { ok: true, packageName, message: `已卸载 ${packageName}\n目录：${profileDir}\n重启 DSH 后生效。`, restartNeeded: true, backupPath: backup ?? "" };
		}
		/**
		* Scan the profile for orphaned plugin files: packages present under
		* `node_modules` (or the vendor dir) that declare a DSH bundle/client
		* but are NOT mounted as loader entries — i.e. their files exist but the
		* plugin is not running. Used by the refresh button to surface plugins
		* that were installed manually or left behind after a bad uninstall.
		* @returns `{ orphans }` — each with name, path, and why it is orphaned.
		*/
		scanOrphanPlugins() {
			const profileDir = this.profileDir();
			const orphans = [];
			const seen = /* @__PURE__ */ new Set();
			// Loader-mounted package names (the running set).
			const mounted = /* @__PURE__ */ new Set();
			try {
				const loader = this.ctx.loader;
				if (loader !== void 0 && typeof loader.entries === "function") {
					for (const entry of loader.entries()) {
						const name = entry?.options?.name;
						if (typeof name === "string" && name.length > 0) mounted.add(name.split("/").slice(0, 2).join("/"));
					}
				}
			} catch {
				/* loader unavailable */
			}
			const manifest = this.readManifest();
			const declared = new Set(Object.keys(manifest.dependencies ?? {}));
			const probe = (pkgDir, name) => {
				if (typeof name !== "string" || name.length === 0 || seen.has(name)) return;
				seen.add(name);
				if (name.startsWith("@deepseek-ai/") || name === "dsh-plugin-desktop") return;
				const manifestPath = join(pkgDir, "package.json");
				if (!existsSync(manifestPath)) return;
				let pkg;
				try { pkg = JSON.parse(readFileSync(manifestPath, "utf8")); } catch { return; }
				const isPlugin = pkg?.dsh?.bundle !== void 0 || pkg?.dsh?.client !== void 0;
				if (!isPlugin) return;
				const isMounted = mounted.has(name);
				const isDeclared = declared.has(name);
				if (isDeclared && isMounted) return;
				const inBundles = Array.isArray(manifest.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles.includes(name) : false;
				orphans.push({
					name,
					path: pkgDir,
					declared: isDeclared,
					inBundles,
					reason: !isDeclared ? "文件存在但未声明依赖" : "已声明依赖但未挂载(可能被禁用或残留)"
				});
			};
			// 1) direct dependencies declared in the profile manifest.
			for (const name of declared) {
				const dir = join(profileDir, "node_modules", ...name.split("/"));
				if (existsSync(dir)) probe(dir, name);
			}
			// 2) vendor dir copies (.kidai-vendor/*) used by subpackage installs.
			const vendorRoot = join(profileDir, ".kidai-vendor");
			try {
				if (existsSync(vendorRoot)) {
					for (const entry of readdirSync(vendorRoot, { withFileTypes: true })) {
						if (!entry.isDirectory()) continue;
						const name = entry.name.split("-").slice(2).join("-");
						probe(join(vendorRoot, entry.name), name);
					}
				}
			} catch {
				/* vendor scan best-effort */
			}
			// 3) top-level node_modules plugin-looking packages not in deps.
			try {
				const nm = join(profileDir, "node_modules");
				if (existsSync(nm)) {
					for (const entry of readdirSync(nm, { withFileTypes: true })) {
						if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "@deepseek-ai") continue;
						if (entry.name.startsWith("@")) {
							const scopeDir = join(nm, entry.name);
							for (const sub of readdirSync(scopeDir, { withFileTypes: true })) {
								if (!sub.isDirectory()) continue;
								probe(join(scopeDir, sub.name), `${entry.name}/${sub.name}`);
							}
						} else {
							probe(join(nm, entry.name), entry.name);
						}
					}
				}
			} catch {
				/* node_modules scan best-effort */
			}
			return { orphans };
		}
		/**
		* Mount an orphaned plugin back into the profile: a package that is a
		* declared dependency (its files exist under node_modules) but is not
		* mounted as a loader entry. Mounting ensures it is listed in
		* `dsh.profile.bundles` (the bundle contract the loader uses) and clears
		* any `disabled` override in the HOME user patch layer, so the next DSH
		* restart loads it again. Only meaningful for `declared` orphans.
		* @param packageName - the orphan's package name.
		* @param options - `{ disabled?: boolean }` — when true, the package is
		* mounted (listed in bundles) but stays DISABLED in the HOME patch layer
		* ("挂载但不启用"): the loader will create its entry but not run it.
		* @returns the mount outcome.
		*/
		async mountOrphan(packageName, options) {
			const mountDisabled = options !== null && typeof options === "object" && options.disabled === true;
			if (typeof packageName !== "string" || !NPM_SPEC_PATTERN.test(packageName)) return { ok: false, packageName: String(packageName ?? ""), message: "kidai-plugin-market-hub: invalid package name", restartNeeded: false };
			const profileDir = this.profileDir();
			const manifestPath = join(profileDir, "package.json");
			if (!existsSync(manifestPath)) return { ok: false, packageName, message: `kidai-plugin-market-hub: ${profileDir} has no package.json — not a DSH profile`, restartNeeded: false };
			const manifest = this.readManifest();
			if (!Object.hasOwn(manifest.dependencies ?? {}, packageName)) return { ok: false, packageName, message: `kidai-plugin-market-hub: ${packageName} 不在依赖清单中,无法挂载(如为残留文件,请用「删除文件」)`, restartNeeded: false };
			const pkgDir = join(profileDir, "node_modules", ...packageName.split("/"));
			const pkgManifestPath = join(pkgDir, "package.json");
			if (!existsSync(pkgManifestPath)) return { ok: false, packageName, message: `kidai-plugin-market-hub: ${packageName} 的包目录不存在: ${pkgDir}`, restartNeeded: false };
			let isBundle = false;
			try {
				const pkgManifest = JSON.parse(readFileSync(pkgManifestPath, "utf8"));
				isBundle = pkgManifest.dsh?.bundle?.patch !== void 0;
				// Hard fail: a "bundle" with NO importable entry (no main /
				// exports, and no index.js fallback) makes the whole plugin tree
				// fail at boot — the misakanet failure mode. Refuse to remount it
				// instead of breaking the next startup.
				if (isBundle && !packageEntryExists(pkgDir, pkgManifest)) {
					return { ok: false, packageName, message: `kidai-plugin-market-hub: ${packageName} 声明了 dsh.bundle 但没有可加载的入口文件(无 main/exports,也没有 index.js)。挂载它会导致 DSH 启动失败(加载器无法解析入口)。该包很可能不是真正的 DSH 插件(如部署脚本仓库),请改用「删除文件」移除,或改装已发布的 npm 插件。`, restartNeeded: false };
				}
			} catch {
				isBundle = false;
			}
			const bundles = Array.isArray(manifest.dsh?.profile?.bundles) ? manifest.dsh.profile.bundles : [];
			let changed = false;
			if (isBundle && !bundles.includes(packageName)) {
				bundles.push(packageName);
				changed = true;
			}
			if (changed) {
				manifest.dsh = { ...manifest.dsh, profile: { ...manifest.dsh?.profile, bundles } };
				writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
			}
			// HOME patch row: mount-with-enable clears the `disabled` row;
			// mount-without-enable ("挂载但不启用") WRITES a disabled row so the
			// loader creates the entry but does not run it.
			try {
				const entryIds = /* @__PURE__ */ new Set();
				const loader = this.ctx.loader;
				if (loader !== void 0 && typeof loader.entries === "function") {
					for (const entry of loader.entries()) {
						const name = entry?.options?.name;
						if (name !== packageName) continue;
						const id = String(entry?.id ?? "");
						if (id.length > 0) {
							entryIds.add(id);
							const short = id.split(":").pop();
							if (short.length > 0) entryIds.add(short);
						}
					}
				}
				const patchPath = join(this.homeDir(), PROFILE_PATCH_FILENAME);
				const doc = YAML.parse(readFileSync(patchPath, "utf8"), { logLevel: "silent" });
				if (Array.isArray(doc)) {
					const short = packageName.split("/").pop();
					if (mountDisabled) {
						// Ensure a `disabled: true` row exists for this package's
						// plain id / short segment (loader entry id is unknown
						// until the entry exists, so target the patch insert id).
						const existing = doc.some((row) => row !== null && typeof row === "object" && !Array.isArray(row) && row.disabled === true && (row.id === short));
						if (!existing) {
							doc.push({ id: short, disabled: true });
							writeFileSync(patchPath, YAML.stringify(doc));
							changed = true;
						}
					} else {
						const filtered = doc.filter((row) => row === null || typeof row !== "object" || Array.isArray(row) || row.disabled !== true || row.id !== packageName && row.id !== short && !entryIds.has(row.id));
						if (filtered.length !== doc.length) {
							writeFileSync(patchPath, YAML.stringify(filtered));
							changed = true;
						}
					}
				}
			} catch {
				/* best-effort patch cleanup */
			}
			return {
				ok: true,
				packageName,
				message: mountDisabled
					? `已挂载 ${packageName}(不启用)\n已加入 bundles 并写入禁用行,重启 DSH 后生效。`
					: `已重新挂载 ${packageName}\n重启 DSH 后生效。${isBundle ? "" : "\n注意:该包未声明 dsh.bundle,挂载后可能无法作为插件加载。"}`,
				restartNeeded: true,
				changed,
				mounted: true,
				disabled: mountDisabled
			};
		}
		/**
		* Delete the on-disk files of an orphaned plugin WITHOUT touching the
		* manifest: packages found under node_modules (or the vendor dir) that
		* declare a DSH bundle/client but are not declared dependencies. This
		* removes leftover files after a bad uninstall. Declared orphans should
		* be removed with `uninstallPlugin` instead (it also edits the manifest).
		* @param packageName - the orphan's package name.
		* @returns the removal outcome.
		*/
		async removeOrphanFiles(packageName) {
			if (typeof packageName !== "string" || !NPM_SPEC_PATTERN.test(packageName)) return { ok: false, packageName: String(packageName ?? ""), message: "kidai-plugin-market-hub: invalid package name", restartNeeded: false };
			const profileDir = this.profileDir();
			const manifest = this.readManifest();
			if (Object.hasOwn(manifest.dependencies ?? {}, packageName)) {
				// Declared dependency — route through the real uninstall so the
				// manifest, bundles and patch rows are cleaned consistently.
				return this.uninstallPlugin(packageName);
			}
			const targets = [];
			const pkgDir = join(profileDir, "node_modules", ...packageName.split("/"));
			if (existsSync(pkgDir)) targets.push(pkgDir);
			const short = packageName.split("/").pop();
			const vendorRoot = join(profileDir, ".kidai-vendor");
			try {
				if (existsSync(vendorRoot)) {
					for (const entry of readdirSync(vendorRoot, { withFileTypes: true })) {
						if (!entry.isDirectory()) continue;
						if (entry.name.endsWith(`-${short}`) || entry.name.includes(`-${packageName.replace(/\//g, "-")}`)) targets.push(join(vendorRoot, entry.name));
					}
				}
			} catch {
				/* vendor scan best-effort */
			}
			// Also drop any @local junction that points at this package.
			try {
				const localRoot = join(profileDir, "node_modules", "@local");
				for (const seg of new Set([packageName, short])) {
					const junctionPath = join(localRoot, ...String(seg).split("/"));
					if (existsSync(junctionPath)) targets.push(junctionPath);
				}
			} catch {
				/* best-effort */
			}
			let removed = 0;
			for (const target of targets) {
				try {
					rmSync(target, { recursive: true, force: true });
					removed += 1;
				} catch {
					/* keep going */
				}
			}
			if (removed === 0) return { ok: false, packageName, message: `kidai-plugin-market-hub: 未找到 ${packageName} 的残留文件`, restartNeeded: false };
			return { ok: true, packageName, message: `已删除 ${packageName} 的残留文件(${removed} 项)\n目录：${profileDir}`, restartNeeded: false, removed };
		}
		/**
		* Fetch a repo's README through the CDN-first chain, decoding the bytes
		* so Chinese text survives a UTF-8/GBK mix-up (mojibake repair).
		* @param owner - repository owner.
		* @param repo - repository name.
		* @returns `{ ok, text, encoding, url }` — ok false when no README found.
		*/
		async fetchReadme(owner, repo) {
			if (typeof owner !== "string" || owner.length === 0 || typeof repo !== "string" || repo.length === 0 || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
				return { ok: false, text: "", encoding: "utf-8", url: "" };
			}
			for (const file of ["README.md", "readme.md", "README.zh.md", "README_zh.md", "README_en.md"]) {
				const buffer = await fetchRepoFile(owner, repo, file, 512 * 1024);
				if (buffer === null) continue;
				const decoded = decodeBytesBest(buffer);
				return { ok: true, text: decoded.text.slice(0, 64 * 1024), encoding: decoded.encoding, url: `https://github.com/${owner}/${repo}#readme` };
			}
			return { ok: false, text: "", encoding: "utf-8", url: `https://github.com/${owner}/${repo}#readme` };
		}
		/**
		* Fail-closed static audit of an install spec: download the exact npm
		* tarball (or GitHub codeload HEAD) to a temp dir and scan its files for
		* high/medium-risk patterns without executing anything.
		* @param spec - npm name, `owner/repo`, or GitHub URL.
		* @returns `{ ok, blocked, findings, detail }`.
		*/
		async auditPackage(spec) {
			const normalized = String(spec ?? "").trim();
			if (normalized.length === 0) return { ok: true, blocked: false, findings: [], detail: "" };
			let archiveUrl = "";
			let label = "";
			if (NPM_SPEC_PATTERN.test(normalized)) {
				label = normalized;
				for (const base of [NPM_REGISTRY_URL, NPM_REGISTRY_MIRROR_URL]) {
					try {
						const response = await fetch(`${base}/${encodeURIComponent(normalized)}/latest`, {
							headers: { "User-Agent": "kidai-plugin-market-hub" },
							signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
						});
						if (!response.ok) continue;
						const manifest = await response.json();
						if (typeof manifest?.dist?.tarball === "string") { archiveUrl = manifest.dist.tarball; break; }
					} catch {
						/* try the next registry */
					}
				}
			} else {
				const subMatch = GITHUB_SUB_PATTERN.exec(normalized);
				const gitMatch = subMatch ?? GITHUB_REPO_PATTERN.exec(normalized);
				if (gitMatch === null) return { ok: true, blocked: false, findings: [], detail: "spec 无法解析,跳过审计" };
				const owner = gitMatch[1];
				const repo = gitMatch[2];
				label = `${owner}/${repo}${typeof subMatch?.[3] === "string" && subMatch[3].length > 0 ? `#${subMatch[3]}` : ""}`;
				// Direct codeload first; China-friendly GitHub mirrors as fallback
				// so the audit still works when github.com is unreachable.
				// gh-proxy.com serves the github.com/.../archive path (the other
				// mirrors refuse codeload), so it is the last resort for big repos.
				archiveUrl = [
					`https://codeload.github.com/${owner}/${repo}/tar.gz/HEAD`,
					`https://ghproxy.net/https://codeload.github.com/${owner}/${repo}/tar.gz/HEAD`,
					`https://ghfast.top/https://codeload.github.com/${owner}/${repo}/tar.gz/HEAD`,
					`https://gh-proxy.com/https://github.com/${owner}/${repo}/archive/HEAD.tar.gz`
				];
			}
			if (archiveUrl.length === 0) return { ok: true, blocked: false, findings: [], detail: "无法定位安装产物,跳过审计" };
			const urlList = Array.isArray(archiveUrl) ? archiveUrl : [archiveUrl];
			let bytes = null;
			let lastStatus = "";
			for (const url of urlList) {
				try {
					const response = await fetch(url, {
						headers: { "User-Agent": "kidai-plugin-market-hub" },
						signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
					});
					if (!response.ok) { lastStatus = `HTTP ${response.status}`; continue; }
					const candidate = Buffer.from(await response.arrayBuffer());
					if (candidate.length > 0 && candidate.length <= AUDIT_MAX_BYTES * 4) { bytes = candidate; break; }
				} catch { lastStatus = "网络不可达"; /* try the next source */ }
			}
			if (bytes === null) return { ok: true, blocked: false, findings: [], detail: `下载安装产物失败(${lastStatus}),跳过审计` };
			try {
				const root = mkdtempSync(join(tmpdir(), "kidai-audit-"));
				try {
					const archivePath = join(root, "artifact.tgz");
					writeFileSync(archivePath, bytes);
					const extract = join(root, "src");
					mkdirSync(extract, { recursive: true });
					const tarResult = await this.runChild("tar", ["-xzf", archivePath, "-C", extract], { cwd: root, timeoutMs: 60000, env: process.env });
					if (tarResult.error !== void 0 || tarResult.status !== 0) return { ok: true, blocked: false, findings: [], detail: "无法解压安装产物(缺少 tar?),跳过审计" };
					return this.scanAuditDir(extract, label);
				} finally {
					try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ }
				}
			} catch (error) {
				return { ok: true, blocked: false, findings: [], detail: `审计下载失败: ${error instanceof Error ? error.message : String(error)}` };
			}
		}
		/**
		* Scan an extracted artifact directory for risk patterns.
		* @returns `{ ok, blocked, findings, detail }`.
		*/
		scanAuditDir(dir, label) {
			const findings = [];
			let files = 0;
			let bytes = 0;
			const walk = (current) => {
				let names = [];
				try { names = readdirSync(current); } catch { return; }
				for (const name of names) {
					if (files >= AUDIT_MAX_FILES || bytes >= AUDIT_MAX_BYTES) return;
					const full = join(current, name);
					let isDir = false;
					try { isDir = statSync(full).isDirectory(); } catch { continue; }
					if (isDir) {
						if (AUDIT_SKIP_DIRS.has(name)) continue;
						walk(full);
						continue;
					}
					if (name === "package.json") {
						try {
							const manifest = JSON.parse(readFileSync(full, "utf8"));
							for (const script of ["preinstall", "install", "postinstall", "prepare"]) {
								if (typeof manifest.scripts?.[script] === "string" && manifest.scripts[script].trim().length > 0) {
									// pnpm gates build-script execution via allowBuilds, so a
									// lifecycle script is a warning, not a hard block.
									findings.push({ file: "package.json", line: 0, severity: "warn", kind: "生命周期脚本", evidence: `${script}: ${manifest.scripts[script].slice(0, 120)}` });
								}
							}
						} catch { /* unreadable manifest */ }
						continue;
					}
					const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
					if (AUDIT_SKIP_EXT.has(ext)) continue;
					files += 1;
					let text = "";
					try {
						const info = statSync(full);
						bytes += info.size;
						if (info.size > 512 * 1024) continue;
						text = readFileSync(full, "utf8");
					} catch { continue; }
					if (text.length === 0) continue;
					const lines = text.split("\n");
					for (const [severity, patterns] of [["block", AUDIT_BLOCK_PATTERNS], ["warn", AUDIT_WARN_PATTERNS]]) {
						for (const pattern of patterns) {
							const lineIndex = lines.findIndex((line) => pattern.re.test(line));
							if (lineIndex >= 0) {
								findings.push({ file: name, line: lineIndex + 1, severity, kind: pattern.kind, evidence: lines[lineIndex].trim().slice(0, 140) });
								if (findings.length >= 30) break;
							}
						}
						if (findings.length >= 30) break;
					}
				}
			};
			walk(dir);
			const blocked = findings.some((finding) => finding.severity === "block");
			return { ok: !blocked, blocked, findings: findings.slice(0, 30), detail: label };
		}
		/**
		* Resolve the pnpm CLI: the pnpm bundled with the DSH installation first
		* (located by walking node_modules and reading its manifest bin entry —
		* pnpm@11's exports map blocks subpath requires like
		* `pnpm/bin/pnpm.cjs`), then a `pnpm` on PATH.
		* @returns `{ kind: "file", path }`, `{ kind: "command", name }`, or null.
		*/
		resolvePnpm() {
			const manifestPath = resolvePkgJsonWalk(this.profileDir(), "pnpm");
			if (manifestPath !== null) {
				try {
					const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
					const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.pnpm;
					const rel = typeof bin === "string" && bin.length > 0 ? bin : typeof manifest.main === "string" ? manifest.main : null;
					if (rel !== null) {
						const candidate = join(dirname(manifestPath), rel);
						if (existsSync(candidate)) return { kind: "file", path: candidate };
					}
				} catch {
					/* fall through to PATH */
				}
			}
			if (commandOnPath("pnpm")) return { kind: "command", name: "pnpm" };
			return null;
		}
		/**
		* Fetch a GitHub repo's tarball through the mirror chain (direct codeload
		* first, then China-friendly mirrors — gh-proxy.com serves the
		* `github.com/.../archive` path that the others refuse), extract it to a
		* temp dir, locate the subpackage directory, and copy it to a stable
		* vendor dir inside the profile so a `file:` dependency survives restarts.
		* @param resolved - the `resolveInstallSpec` result (must carry `sub`).
		* @param profileDir - the active profile directory (vendor dir target).
		* @returns `{ ok, dir, usedMirror }` or `{ ok: false, message }`.
		*/
		async prepareGitSubpackage(resolved, profileDir) {
			const owner = resolved.owner;
			const repo = resolved.repoName;
			const sub = resolved.sub;
			// Direct codeload first; then mirror fallbacks. gh-proxy.com serves
			// the github.com/.../archive path (the others refuse codeload), so
			// it is the last resort for big repos. Per-URL timeout is bounded
			// (2 min) so one stalled mirror cannot stall the whole chain.
			const urlList = [
				`https://codeload.github.com/${owner}/${repo}/tar.gz/HEAD`,
				`https://ghproxy.net/https://codeload.github.com/${owner}/${repo}/tar.gz/HEAD`,
				`https://ghfast.top/https://codeload.github.com/${owner}/${repo}/tar.gz/HEAD`,
				`https://gh-proxy.com/https://github.com/${owner}/${repo}/archive/HEAD.tar.gz`
			];
			let bytes = null;
			let usedMirror = false;
			for (let i = 0; i < urlList.length; i++) {
				try {
					const response = await fetch(urlList[i], {
						headers: { "User-Agent": "kidai-plugin-market-hub" },
						signal: AbortSignal.timeout(2 * 60 * 1000)
					});
					if (!response.ok) continue;
					const candidate = Buffer.from(await response.arrayBuffer());
					if (candidate.length > 0) { bytes = candidate; usedMirror = i > 0; break; }
				} catch {
					/* try the next source */
				}
			}
			if (bytes === null) {
				return { ok: false, message: `kidai-plugin-market-hub: 无法下载 ${owner}/${repo} 仓库包(直连与镜像均不可达),无法定位子包 ${sub}` };
			}
			const root = mkdtempSync(join(tmpdir(), "kidai-sub-"));
			try {
				const archivePath = join(root, "repo.tgz");
				writeFileSync(archivePath, bytes);
				const extract = join(root, "src");
				mkdirSync(extract, { recursive: true });
				const tarResult = await this.runChild("tar", ["-xzf", archivePath, "-C", extract], { cwd: root, timeoutMs: 120000, env: process.env });
				if (tarResult.error !== void 0 || tarResult.status !== 0) {
					return { ok: false, message: `kidai-plugin-market-hub: 解压 ${owner}/${repo} 失败(缺少 tar?),无法定位子包 ${sub}` };
				}
				let subDir = null;
				if (typeof sub === "string" && sub.length > 0) {
					subDir = locateSubpackageDir(extract, sub);
					if (subDir === null) {
						return { ok: false, message: `kidai-plugin-market-hub: 仓库 ${owner}/${repo} 中未找到子包 ${sub}` };
					}
				} else {
					// Whole-repo install (`owner/repo` without #sub): the repo root
					// usually IS the plugin package. Accept a nested package dir
					// only when the root has no manifest, so a monorepo root with
					// no dsh plugin is still installable when it has exactly one
					// plugin-looking package.
					const rootManifest = join(extract, "package.json");
					if (existsSync(rootManifest)) {
						subDir = extract;
					} else {
						subDir = locatePluginPackageDir(extract);
						if (subDir === null) {
							return { ok: false, message: `kidai-plugin-market-hub: 仓库 ${owner}/${repo} 根目录没有 package.json,也未找到唯一的插件包` };
						}
					}
				}
				// Stable vendor copy so the file: dep survives restarts. The name
				// is escaped with dashes so the path stays a single path segment.
				const vendorName = typeof sub === "string" && sub.length > 0 ? `${owner}-${repo}-${sub}` : `${owner}-${repo}`;
				const vendorDir = join(profileDir, ".kidai-vendor", vendorName);
				rmSync(vendorDir, { recursive: true, force: true });
				mkdirSync(vendorDir, { recursive: true });
				cpSync(subDir, vendorDir, { recursive: true });
				// A GitHub subpackage is frequently a TypeScript source-only
				// package whose `main`/`exports` point at build output (`lib/`)
				// that does not exist in the tarball. Installing it unbuilt would
				// make DSH fail at boot (ERR_MODULE_NOT_FOUND) — exactly the
				// AI-Novel-Writer incident. Build it here when the declared entry
				// is missing, and refuse the install when the build fails.
				try {
					const manifest = JSON.parse(readFileSync(join(vendorDir, "package.json"), "utf8"));
					// `workspace:*`/`workspace:^` deps can only resolve inside the
					// original monorepo — a standalone vendor copy cannot build.
					const workspaceDeps = Object.entries(manifest.dependencies ?? {}).filter(([, range]) => typeof range === "string" && /^workspace:/.test(range)).map(([name]) => name);
					if (workspaceDeps.length > 0) {
						try { rmSync(vendorDir, { recursive: true, force: true }); } catch { /* best-effort */ }
						return { ok: false, message: `kidai-plugin-market-hub: ${owner}/${repo} 的插件包依赖 workspace: 协议包(${workspaceDeps.join(", ")})。这类 monorepo 内部包无法脱离仓库独立安装,已取消。请从仓库主包安装,或改装已发布到 npm 的版本。` };
					}
					if (!packageEntryExists(vendorDir, manifest)) {
						const built = await this.buildVendorSubpackage(vendorDir);
						if (!built.ok) {
							// Don't leave a half-built vendor copy behind.
							try { rmSync(vendorDir, { recursive: true, force: true }); } catch { /* best-effort */ }
							return { ok: false, message: built.message };
						}
					}
				} catch {
					/* unreadable manifest — the loadability guard will reject it */
				}
				return { ok: true, dir: vendorDir, usedMirror };
			} finally {
				try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort */ }
			}
		}
		/**
		* Build a source-only subpackage vendor dir in place so its declared
		* entry point (`lib/index.js` etc.) exists before pnpm links it into the
		* profile. Runs `pnpm install` then the package's `build` script with
		* Electron's own Node as the interpreter — the `.bin` shims resolve to
		* the system Node (v20) which modern toolchains (rolldown/tsdown) reject,
		* so we drive the tools through `process.execPath` directly.
		* @param vendorDir - the copied subpackage directory.
		* @returns `{ ok: true }` or `{ ok: false, message }`.
		*/
		async buildVendorSubpackage(vendorDir) {
			const pnpm = this.resolvePnpm();
			if (pnpm === null) {
				return { ok: false, message: "kidai-plugin-market-hub: pnpm 不可用,无法构建源码包子包(该包未随仓库附带构建产物 lib/)" };
			}
			const command = pnpm.kind === "file" ? process.execPath : pnpm.name;
			const env = { ...process.env, CI: "true", ELECTRON_RUN_AS_NODE: "1" };
			const installOutcome = await this.runChild(command, pnpm.kind === "file" ? [pnpm.path, "install"] : ["install"], {
				cwd: vendorDir,
				viaShell: pnpm.kind !== "file",
				timeoutMs: INSTALL_TIMEOUT_MS,
				env
			});
			if (installOutcome.error !== void 0 || installOutcome.timedOut || installOutcome.status !== 0) {
				const detail = installOutcome.error !== void 0 ? installOutcome.error.message : this.tail((installOutcome.stderr ?? installOutcome.stdout ?? "").trim());
				return { ok: false, message: `kidai-plugin-market-hub: 子包依赖安装失败(pnpm install): ${detail}\n无法构建源码包子包,已取消安装。` };
			}
			// Prefer the exact tool entry points under Electron's node; fall back
			// to `pnpm run build` (which uses .bin shims) only as a last resort.
			let buildOutcome = null;
			const tsdownCli = join(vendorDir, "node_modules", "tsdown", "dist", "run.mjs");
			const tscCli = join(vendorDir, "node_modules", "typescript", "bin", "tsc");
			if (existsSync(tsdownCli)) {
				buildOutcome = await this.runChild(process.execPath, [tsdownCli], { cwd: vendorDir, timeoutMs: INSTALL_TIMEOUT_MS, env });
			} else if (existsSync(tscCli)) {
				buildOutcome = await this.runChild(process.execPath, [tscCli, "-p", join(vendorDir, "tsconfig.json")], { cwd: vendorDir, timeoutMs: INSTALL_TIMEOUT_MS, env });
			} else {
				buildOutcome = await this.runChild(command, pnpm.kind === "file" ? [pnpm.path, "run", "build"] : ["run", "build"], { cwd: vendorDir, viaShell: pnpm.kind !== "file", timeoutMs: INSTALL_TIMEOUT_MS, env });
			}
			if (buildOutcome.error !== void 0 || buildOutcome.timedOut || buildOutcome.status !== 0) {
				const detail = buildOutcome.error !== void 0 ? buildOutcome.error.message : this.tail((buildOutcome.stderr ?? buildOutcome.stdout ?? "").trim());
				return { ok: false, message: `kidai-plugin-market-hub: 子包构建失败: ${detail}\n无法生成 ${join(vendorDir, "lib")} 等构建产物,已取消安装。` };
			}
			// Confirm the declared entry now exists (some packages emit to a
			// different outDir or need a second stage like link-self).
			try {
				const manifest = JSON.parse(readFileSync(join(vendorDir, "package.json"), "utf8"));
				if (!packageEntryExists(vendorDir, manifest)) {
					return { ok: false, message: `kidai-plugin-market-hub: 子包构建结束但入口文件(main/exports)仍不存在,已取消安装。\n目录：${vendorDir}` };
				}
			} catch {
				return { ok: false, message: `kidai-plugin-market-hub: 子包构建后无法读取其 package.json,已取消安装。\n目录：${vendorDir}` };
			}
			return { ok: true };
		}
		/** Profile name derived from the directory, for command hints. */
		profileName(profileDir) {			const segments = profileDir.split(/[\\/]/).filter(Boolean);
			return segments.length > 0 ? segments[segments.length - 1] : "desktop";
		}
		/**
		* Append every new dependency that declares a `dsh.bundle.patch` to the
		* profile's bundle layer list — the same reconciliation `dsh plugin add`
		* performs, so the marketplace stays consistent with the CLI.
		*/
		reconcileBundles(before, profileDir, manifestPath) {
			const after = this.readManifest();
			const beforeDeps = new Set(Object.keys(before.dependencies ?? {}));
			const bundles = Array.isArray(after.dsh?.profile?.bundles) ? after.dsh.profile.bundles : [];
			let changed = false;
			for (const packageName of Object.keys(after.dependencies ?? {})) {
				if (bundles.includes(packageName)) continue;
				const installedPath = join(profileDir, "node_modules", packageName, "package.json");
				let isBundle = false;
				try {
					isBundle = JSON.parse(readFileSync(installedPath, "utf8")).dsh?.bundle?.patch !== void 0;
				} catch {
					isBundle = false;
				}
				if (isBundle) {
					bundles.push(packageName);
					changed = true;
				} else if (!beforeDeps.has(packageName)) {
					this.ctx.logger.warn(`kidai-plugin-market-hub: ${packageName} declares no dsh.bundle — installed as a plain dependency, not a profile layer`);
				}
			}
			if (!changed) return;
			after.dsh = { ...after.dsh, profile: { ...after.dsh?.profile, bundles } };
			writeFileSync(manifestPath, `${JSON.stringify(after, null, 2)}\n`);
		}
		/** Keep error messages bounded. */
		tail(text) {
			return text.length > 1200 ? `…${text.slice(-1200)}` : text;
		}
		/**
		* Run one child command without blocking the host event loop (spawn, not
		* spawnSync — a blocking pnpm install would freeze the whole DSH host).
		* Resolves on exit with the captured output; on timeout the process tree
		* is killed and `timedOut` is set. Never throws.
		* @param options.viaShell - route through cmd.exe on Windows (required for
		* .cmd shims like a PATH-installed pnpm; CreateProcess cannot run them).
		* @returns `{ error?, status, stdout, stderr, timedOut }`.
		*/
		runChild(command, args, options) {
			const viaShell = options.viaShell === true && process.platform === "win32";
			const spawnOptions = {
				cwd: options.cwd,
				env: options.env,
				stdio: ["ignore", "pipe", "pipe"],
				windowsHide: true,
				// POSIX: detached process group so the timeout can kill the whole tree.
				detached: !viaShell && process.platform !== "win32",
			};
			const child = viaShell
				? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${[command, ...args].map((arg) => this.quoteCmdArg(arg)).join(" ")}"`], { ...spawnOptions, shell: false, windowsVerbatimArguments: true })
				: spawn(command, args, { ...spawnOptions, shell: false });
			return new Promise((resolvePromise) => {
				let stdout = "";
				let stderr = "";
				let timedOut = false;
				const timer = setTimeout(() => {
					timedOut = true;
					this.killTree(child);
				}, options.timeoutMs);
				child.stdout?.on("data", (chunk) => {
					stdout = (stdout + chunk.toString()).slice(-16 * 1024 * 1024);
				});
				child.stderr?.on("data", (chunk) => {
					stderr = (stderr + chunk.toString()).slice(-16 * 1024 * 1024);
				});
				child.on("error", (error) => {
					clearTimeout(timer);
					resolvePromise({ error, status: -1, stdout, stderr, timedOut });
				});
				child.on("close", (code) => {
					clearTimeout(timer);
					resolvePromise({ error: void 0, status: code ?? -1, stdout, stderr, timedOut });
				});
			});
		}
		/** cmd.exe 视为语法字符(即使在一个 token 内);需要引用的 token 用双引号包裹并加倍内部引号。 */
		quoteCmdArg(arg) {
			return /[\s"&|<>^()%!]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg;
		}
		/**
		* Kill a child and its whole process tree: Windows taskkill /T /F (plain
		* kill() only terminates the wrapper, leaving pnpm grandchildren alive);
		* POSIX signal the detached process group, escalating to SIGKILL after 5s.
		*/
		killTree(child) {
			if (process.platform === "win32" && child.pid !== void 0) {
				try {
					spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
					return;
				} catch {
					/* fall through to plain kill */
				}
			}
			const signalTree = (signal) => {
				if (child.pid === void 0) return;
				try {
					process.kill(-child.pid, signal);
				} catch {
					try {
						child.kill(signal);
					} catch {
						/* already gone */
					}
				}
			};
			signalTree("SIGTERM");
			const escalate = setTimeout(() => signalTree("SIGKILL"), 5000);
			escalate.unref?.();
		}
	};
})();
//#endregion

export { PluginMarketGateway, resolveInstallSpec, locateSubpackageDir, versionSatisfies, detectRuntimeVersion, patchKeyedSlotRegistrations, resolveClientBundlePath, PluginMarketGateway as default };
