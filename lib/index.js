import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
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
	"https://ghfast.top/https://api.github.com",
	"https://ghproxy.net/https://api.github.com"
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
const GITHUB_PAGES = 2;
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
const VERIFY_CONCURRENCY = 6;
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
/** The profile's user patch layer (id-targeted overrides and inserts). */
const PROFILE_PATCH_FILENAME = "cordis.patch.yml";
/** Only plain npm package names / GitHub repos may cross the install boundary. */
const NPM_SPEC_PATTERN = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
const GITHUB_REPO_PATTERN = /^(?:https?:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/;

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

/** The CDN-first URL chain used to read one repo file without API quota. */
function repoFileUrls(owner, repo, file) {
	return [
		`https://cdn.jsdelivr.net/gh/${owner}/${repo}@HEAD/${file}`,
		`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`,
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
	const manifest = await fetchRepoManifest(owner, repo);
	if (manifest !== null && manifest.dsh !== null && typeof manifest.dsh === "object") {
		const dsh = manifest.dsh;
		if (dsh.bundle !== void 0 || dsh.client !== void 0) return { verified: true, hasDsh: true };
	}
	const patch = await fetchRepoFile(owner, repo, "cordis.patch.yml", 64 * 1024);
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
	for (const line of String(text ?? "").split(/\r?\n/)) {
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
			sourceTier: "AWESOME"
		});
	}
	return entries;
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
* many repos store UTF-8 but serve it as GBK (or vice versa); decode both ways
* and keep the one with more CJK characters / fewer replacement chars.
* @returns `{ text, encoding }`.
*/
function decodeBytesBest(buffer) {
	const decoders = [["utf-8", "utf-8"], ["gb18030", "gb18030"], ["gbk", "gbk"]];
	let best = null;
	for (const [label, encoding] of decoders) {
		try {
			const text = new TextDecoder(encoding).decode(buffer);
			const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
			const replacements = (text.match(/\uFFFD/g) ?? []).length;
			const score = cjk * 2 - replacements;
			if (best === null || score > best.score) best = { text, encoding: label, score };
		} catch {
			/* decoder unavailable — try the next */
		}
	}
	if (best === null) return { text: buffer.toString("utf8"), encoding: "utf-8" };
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
/** High-severity patterns: dynamic execution, credential paths, persistence. */
const AUDIT_BLOCK_PATTERNS = [
	{ kind: "动态执行", re: /\beval\s*\(|\bnew\s+Function\s*\(|\bvm\.runIn(NewContext|ThisContext)|\brequire\(["']child_process["']\)\s*$/mi },
	{ kind: "凭据路径", re: /(?:id_rsa|id_ed25519|\.ssh|\.aws[\\/]credentials|\.npmrc|\.env|\.netrc)/i },
	{ kind: "密钥读取", re: /(?:DEEPSEEK|OPENAI|ANTHROPIC|GEMINI|MISTRAL|COHERE)_.{0,12}?(?:API_?KEY|TOKEN)|process\.env\.\w*(?:TOKEN|SECRET|PASSWORD|API_KEY)/i },
	{ kind: "改 shell 配置", re: /(?:\.bashrc|\.zshrc|\.bash_profile|\.profile|\.gitconfig|\.config[\\/]fish)/i },
	{ kind: "覆盖他人配置", re: /writeFileSync?\s*\([^)]*cordis\.patch\.yml|writeFile\s*\([^)]*cordis\.patch\.yml/i }
];
/** Medium-severity patterns: subprocess, network, file writes, obfuscation. */
const AUDIT_WARN_PATTERNS = [
	{ kind: "子进程", re: /child_process|execSync|spawnSync|\.exec\s*\(|\.spawn\s*\(/i },
	{ kind: "网络请求", re: /https?:\/\/|fetch\s*\(|WebSocket|net\.connect/i },
	{ kind: "文件写入", re: /writeFileSync|createWriteStream|appendFile|unlinkSync|rmSync/i },
	{ kind: "混淆信号", re: /(?:fromCharCode|atob\s*\(\s*["'][A-Za-z0-9+/=]{40,}["']|Buffer\.from\s*\(\s*["'][A-Za-z0-9+/=]{40,}["']\s*,\s*["']base64["'])/i }
];
//#endregion

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
			// 1) GitHub: topic search pages + name search per base, server-sorted;
			// stop at the first base that yields any entries (official, then mirrors).
			if (cooling) {
				failures.push("github: rate-limited (cooldown)");
			}
			for (const base of this.githubBases()) {
				if (cooling) break;
				const urls = [];
				for (let page = 1; page <= GITHUB_PAGES; page++) urls.push(`${base.base}/search/repositories?q=${encodeURIComponent(CATALOG_TOPIC)}&sort=${githubSort}&order=desc&per_page=100&page=${page}`);
				urls.push(`${base.base}/search/repositories?q=${encodeURIComponent(CATALOG_NAME_QUERY)}&sort=${githubSort}&order=desc&per_page=100`);
				let got = 0;
				for (const url of urls) {
					try {
						const pageEntries = await this.fetchGithubPage(url);
						got += pageEntries.length;
						for (const entry of pageEntries) if (!seen.has(entry.name)) {
							seen.add(entry.name);
							entries.push({ ...entry, sourceTier: url.includes("in%3Aname") ? "NAME" : "TOPIC" });
						}
					} catch (error) {
						failures.push(`${base.id}: ${error instanceof Error ? error.message : String(error)}`);
					}
				}
				families.add(base.id);
				if (got > 0) break;
			}
			// 2) npm: several queries from the first registry that responds.
			for (const registry of [NPM_SEARCH_DEFAULT, NPM_SEARCH_MIRROR]) {
				let got = 0;
				for (const query of NPM_SEARCH_QUERIES) {
					try {
						const pageEntries = await this.fetchNpmPage(`${registry}?text=${encodeURIComponent(query)}&size=${NPM_SEARCH_SIZE}`);
						got += pageEntries.length;
						for (const entry of pageEntries) if (!seen.has(entry.name)) {
							seen.add(entry.name);
							entries.push({ ...entry, sourceTier: "NPM" });
						}
					} catch (error) {
						failures.push(`${registry === NPM_SEARCH_DEFAULT ? "npm" : "npm-mirror"}:${query}: ${error instanceof Error ? error.message : String(error)}`);
					}
				}
				families.add(registry === NPM_SEARCH_DEFAULT ? "npm" : "npm-mirror");
				if (got > 0) break;
			}
			// 3) awesome-dsh-plugin: the community-curated README list, parsed for
			// `- [owner/repo](url) - description` bullets (monorepo entries carry a
			// `#subpackage` label). Fail-soft: a list outage must not kill the
			// catalog when GitHub/npm already yielded entries (and vice versa).
			try {
				const awesomeEntries = awesomeEntriesFromMarkdown(await fetchAwesomeReadme(!this.isGitHubCooling()));
				if (awesomeEntries.length > 0) {
					families.add("awesome");
					for (const entry of awesomeEntries) if (!seen.has(entry.name)) {
						seen.add(entry.name);
						entries.push({ ...entry, kind: "github" });
					}
				} else {
					failures.push("awesome: list empty/unreachable");
				}
			} catch (error) {
				failures.push(`awesome: ${error instanceof Error ? error.message : String(error)}`);
			}
			if (entries.length === 0) throw new Error(failures.join("; "));
			// 4) verify GitHub entries (npm entries are registry-listed already;
			// awesome-list entries are human-curated, so they count as verified):
			// npm-kind entries count as verified; GitHub repos are probed for
			// dsh declarations unless a cached flag is already known.
			const flags = this.verifiedFlags();
			// Cap the probe set so a first load cannot stall on a huge catalog
			// (repeated loads only probe repos never seen before).
			const unknown = entries.filter((entry) => entry.kind === "github" && entry.sourceTier !== "AWESOME" && !flags.has(entry.name)).slice(0, VERIFY_MAX_ENTRIES);
			const results = await this.verifyEntries(unknown);
			for (const entry of entries) {
				if (entry.kind === "npm") entry.verified = true;
				else if (entry.sourceTier === "AWESOME") entry.verified = true;
				else if (results.has(entry.name)) entry.verified = results.get(entry.name);
				else if (flags.has(entry.name)) entry.verified = flags.get(entry.name);
				else entry.verified = false;
			}
			return {
				entries,
				source: [...families].join("+")
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
							map.set(sort, { entries: view.entries, fetchedAt, source: view.source });
						}
					}
					return map.size > 0 ? map : null;
				}
				if (Array.isArray(parsed.entries) && typeof parsed.source === "string") {
					const fetchedAt = typeof parsed.fetchedAt === "string" ? parsed.fetchedAt : new Date(typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : 0).toISOString();
					return new Map([["updated", { entries: parsed.entries, fetchedAt, source: parsed.source }]]);
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
			const profileDir = this.profileDir();
			const manifestPath = join(profileDir, "package.json");
			if (!existsSync(manifestPath)) return { ok: false, packageName: normalized, message: `kidai-plugin-market-hub: ${profileDir} has no package.json — not a DSH profile`, restartNeeded: false, command: "" };
			const resolved = await resolveInstallSpec(normalized);
			if (resolved === null) return { ok: false, packageName: normalized, message: "kidai-plugin-market-hub: spec is neither a known npm package nor a GitHub repository", restartNeeded: false, command: "" };
			const pnpmSpec = resolved.spec;
			// Fail-closed audit: scan the exact artifact before anything is
			// written; blocked findings require an explicit allowRisky retry.
			if (!allowRisky) {
				const audit = await this.auditPackage(normalized);
				if (audit.blocked) {
					return {
						ok: false,
						packageName: pnpmSpec,
						message: "kidai-plugin-market-hub: 静态安全审计发现高危风险,已拦截安装(如确需安装请勾选“仍要安装,自负风险”)。",
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
			const args = pnpm.kind === "file" ? [pnpm.path, "add", pnpmSpec] : ["add", pnpmSpec];
			const outcome = await this.runChild(command, args, {
				cwd: profileDir,
				// PATH 上的 pnpm 在 Windows 是 pnpm.cmd,必须经 cmd.exe 启动。
				viaShell: pnpm.kind !== "file",
				timeoutMs: INSTALL_TIMEOUT_MS,
				env: {
					...process.env,
					CI: "true",
					// Under the Desktop app process.execPath is the Electron binary;
					// ELECTRON_RUN_AS_NODE makes it execute the pnpm script as Node.
					ELECTRON_RUN_AS_NODE: "1"
				}
			});
			const failed = outcome.error !== void 0 || outcome.timedOut || outcome.status !== 0;
			if (failed) {
				const detail = outcome.error !== void 0 ? outcome.error.message : this.tail((outcome.stderr ?? outcome.stdout ?? "").trim());
				const hint = resolved.kind === "git" ? " (git-hosted plugins build on install via prepare scripts, which pnpm blocks until allowed — add the printed key under allowBuilds in the profile's pnpm-workspace.yaml, then re-run)" : "";
				const rolledBack = backup !== null && this.restoreBackup(backup);
				return { ok: false, packageName: normalized, message: `kidai-plugin-market-hub: pnpm add ${pnpmSpec} failed: ${detail}${hint}${rolledBack ? "\n已自动回滚到安装前状态。" : ""}`, restartNeeded: false, command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}` };
			}
			this.reconcileBundles(before, profileDir, manifestPath);
			// Post-install brick guard: a package we promoted into the bundle
			// layer must actually declare a bundle patch — otherwise the next
			// boot would try to load a bundle that does not exist.
			const installedManifest = this.readInstalledManifest(pnpmSpec, profileDir);
			const promoted = Object.keys(this.readManifest().dependencies ?? {}).includes(pnpmSpec) && (Array.isArray(this.readManifest().dsh?.profile?.bundles) && this.readManifest().dsh.profile.bundles.includes(pnpmSpec));
			if (promoted && installedManifest !== null && installedManifest.dsh?.bundle?.patch === void 0) {
				await this.runChild(command, pnpm.kind === "file" ? [pnpm.path, "remove", pnpmSpec] : ["remove", pnpmSpec], {
					cwd: profileDir,
					viaShell: pnpm.kind !== "file",
					timeoutMs: INSTALL_TIMEOUT_MS,
					env: { ...process.env, CI: "true", ELECTRON_RUN_AS_NODE: "1" }
				});
				const rolledBack = backup !== null && this.restoreBackup(backup);
				return { ok: false, packageName: pnpmSpec, message: `kidai-plugin-market-hub: 安装后校验失败——${pnpmSpec} 未声明 dsh.bundle,已自动卸载并回滚。${rolledBack ? "" : "\n(备份目录: .kidai-backups)"}`, restartNeeded: false, command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}` };
			}
			const channel = resolved.squat === true ? "git(防抢注回退)" : resolved.kind === "npm" ? "npm" : "git";
			return {
				ok: true,
				packageName: pnpmSpec,
				message: `已安装 ${pnpmSpec}(通道: ${channel})\n目录：${profileDir}\n重启 DSH 后生效。`,
				restartNeeded: true,
				command: `dsh plugin --profile ${this.profileName(profileDir)} add ${normalized}`,
				channel,
				backupPath: backup ?? ""
			};
		}
		/** Read an installed package's manifest (null when absent). */
		readInstalledManifest(packageName, profileDir) {
			try {
				const parsed = JSON.parse(readFileSync(join(profileDir, "node_modules", packageName, "package.json"), "utf8"));
				return parsed !== null && typeof parsed === "object" ? parsed : null;
			} catch {
				return null;
			}
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
				const match = GITHUB_REPO_PATTERN.exec(normalized);
				if (match === null) return { ok: true, blocked: false, findings: [], detail: "spec 无法解析,跳过审计" };
				label = `${match[1]}/${match[2]}`;
				archiveUrl = `https://codeload.github.com/${match[1]}/${match[2]}/tar.gz/HEAD`;
			}
			if (archiveUrl.length === 0) return { ok: true, blocked: false, findings: [], detail: "无法定位安装产物,跳过审计" };
			try {
				const response = await fetch(archiveUrl, {
					headers: { "User-Agent": "kidai-plugin-market-hub" },
					signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
				});
				if (!response.ok) return { ok: true, blocked: false, findings: [], detail: `下载安装产物失败(HTTP ${response.status}),跳过审计` };
				const bytes = Buffer.from(await response.arrayBuffer());
				if (bytes.length === 0 || bytes.length > AUDIT_MAX_BYTES * 4) return { ok: true, blocked: false, findings: [], detail: "安装产物过大或为空,跳过审计" };
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
									findings.push({ file: "package.json", line: 0, severity: "block", kind: "生命周期脚本", evidence: `${script}: ${manifest.scripts[script].slice(0, 120)}` });
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
		/** Profile name derived from the directory, for command hints. */
		profileName(profileDir) {
			const segments = profileDir.split(/[\\/]/).filter(Boolean);
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

export { PluginMarketGateway, resolveInstallSpec, PluginMarketGateway as default };
