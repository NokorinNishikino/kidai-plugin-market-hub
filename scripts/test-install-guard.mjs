// Unit test for the installPlugin loadability guard: a marketplace install
// must produce a loadable profile bundle (the package declares
// `dsh.bundle.patch`). pnpm is simulated through a runChild/resolvePnpm
// override; the manifest diff, reconciliation, backup and rollback all run on
// a real temp profile directory.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { PluginMarketGateway } = await import("../lib/index.js");

let failures = 0;
function check(label, condition, detail = "") {
	if (condition) console.log(`  ok  ${label}`);
	else { failures += 1; console.error(`FAIL  ${label} ${detail}`); }
}

const dir = mkdtempSync(join(tmpdir(), "kpmh-install-guard-"));
const profileDir = join(dir, "profiles", "test");
mkdirSync(join(profileDir, "node_modules", "dsh-emoji"), { recursive: true });
const manifestPath = join(profileDir, "package.json");
const ORIGINAL = {
	name: "dsh-profile-test",
	private: true,
	dependencies: { "dsh-config-manager": "^0.1.28" },
	dsh: { profile: { bundles: ["@deepseek-ai/dsh-base"] } }
};
writeFileSync(manifestPath, JSON.stringify(ORIGINAL, null, 2));

function makeGateway({ loadable, colliding = false, missingEntry = false, localLinkName = false, oldPeer = false }) {
	const ctx = {
		reflect: { provide: () => {}, props: {} },
		baseUrl: "file:///" + profileDir.replace(/\\/g, "/") + "/",
		get: () => void 0,
		logger: { warn() {}, info() {}, debug() {} },
		// Simulate the composed loader tree so the duplicate-id guard sees rows.
		loader: colliding ? { entries: () => [{ id: "storage" }, { id: "workspace" }, { id: "agent-presets" }] } : void 0
	};
	const gateway = new PluginMarketGateway(ctx);
	gateway.resolvePnpm = () => ({ kind: "file", path: "C:/fake/pnpm.mjs" });
	gateway.runChild = async (_command, args) => {
		const op = args[1];
		const spec = args[2];
		if (op === "add") {
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			m.dependencies[spec] = loadable ? "^1.0.0" : "github:fake/fake";
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			const pkgDir = join(profileDir, "node_modules", spec);
			mkdirSync(pkgDir, { recursive: true });
			const manifest = { name: spec, version: "1.0.0", dsh: loadable ? { bundle: { patch: "./cordis.patch.yml" } } : {} };
			if (missingEntry) {
				// A TypeScript source-only subpackage: declares main -> lib/index.js
				// that does not exist until built (the AI-Novel-Writer failure mode).
				manifest.main = "lib/index.js";
				manifest.exports = { ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" } };
			}
			if (oldPeer) {
				// Built against DSH rc.6 while the runtime is rc.7 (the keyed-slot
				// incompatibility): peer range pins the older rc series.
				manifest.peerDependencies = { "@deepseek-ai/dsh-client-runtime": "0.1.0-rc.6" };
			}
			writeFileSync(join(pkgDir, "package.json"), JSON.stringify(manifest));
			// A loadable bundle needs a real importable entry (the loader resolves
			// main/exports, falling back to index.js) — provide one unless the
			// case deliberately ships a missing entry (missingEntry).
			if (loadable && !missingEntry) {
				writeFileSync(join(pkgDir, "index.js"), "module.exports = {};\n");
			}
			if (loadable) {
				const inserted = colliding
					? "- insert:\n    - id: storage\n      name: '@deepseek-ai/dsh-storage'\n    - id: agent-presets\n      name: '@deepseek-ai/dsh-agent-presets'\n      config:\n        default: standard\n    - id: dsh-tui-scenes\n      name: x/scenes\n- id: sandbox-policy\n  config:\n    mode: !!js process.env.X ?? 1\n"
					: localLinkName
						? "- insert:\n    - id: tavern\n      name: '@local/dsh-tavern'\n"
						: "- insert:\n    - id: dsh-emoji\n      name: dsh-emoji\n";
				writeFileSync(join(pkgDir, "cordis.patch.yml"), inserted);
			}
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		if (op === "remove") {
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			delete m.dependencies[spec];
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			rmSync(join(profileDir, "node_modules", spec), { recursive: true, force: true });
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
	};
	return gateway;
}

function resetManifest() {
	writeFileSync(manifestPath, JSON.stringify(ORIGINAL, null, 2));
	rmSync(join(profileDir, "node_modules", "dsh-emoji"), { recursive: true, force: true });
	rmSync(join(profileDir, "node_modules", "dsh-tavern"), { recursive: true, force: true });
	rmSync(join(profileDir, "node_modules", "@local"), { recursive: true, force: true });
	rmSync(join(profileDir, ".kidai-backups"), { recursive: true, force: true });
}

// Case A: a plugin that declares dsh.bundle.patch → install succeeds, promoted.
{
	const gateway = makeGateway({ loadable: true });
	const result = await gateway.installPlugin("dsh-emoji", { allowRisky: true });
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("loadable install reports ok", result.ok === true, JSON.stringify(result));
	check("loadable install added the dependency", m.dependencies["dsh-emoji"] !== void 0);
	check("loadable install promoted into bundles", Array.isArray(m.dsh.profile.bundles) && m.dsh.profile.bundles.includes("dsh-emoji"), m.dsh.profile.bundles?.join(","));
	check("loadable install keeps existing bundles", m.dsh.profile.bundles.includes("@deepseek-ai/dsh-base"));
}

// Case B: a package without dsh.bundle.patch → install fails, rolled back.
{
	resetManifest();
	const gateway = makeGateway({ loadable: false });
	const result = await gateway.installPlugin("dsh-emoji", { allowRisky: true });
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("non-loadable install fails", result.ok === false, JSON.stringify(result));
	check("failure message explains the reason", typeof result.message === "string" && result.message.includes("dsh.bundle.patch"), result.message);
	check("rollback removed the dependency", m.dependencies["dsh-emoji"] === void 0);
	check("rollback left bundles untouched", !(m.dsh.profile.bundles ?? []).includes("dsh-emoji"));
	check("rollback removed node_modules copy", !existsSync(join(profileDir, "node_modules", "dsh-emoji")));
	check("rollback restored original manifest", JSON.stringify(m) === JSON.stringify(ORIGINAL), JSON.stringify(m));
}

// Case C: favorites persistence round-trip through the profile file.
{
	const gateway = makeGateway({ loadable: true });
	const before = await gateway.favoritesGet();
	check("favorites start empty", before.ok === true && before.names.length === 0, JSON.stringify(before));
	const write = await gateway.favoritesSet(["a", "b", "a"]);
	check("favoritesSet dedups names", write.ok === true && write.count === 2, JSON.stringify(write));
	const after = await gateway.favoritesGet();
	check("favorites round-trip survives", after.ok === true && JSON.stringify(after.names) === JSON.stringify(["a", "b"]), JSON.stringify(after));
	check("favorites file written into the profile", existsSync(join(profileDir, ".kidai-favorites.json")));
	// A second gateway instance (simulating a restart) still reads the file.
	const gateway2 = makeGateway({ loadable: true });
	const afterRestart = await gateway2.favoritesGet();
	check("favorites survive a gateway restart", afterRestart.ok === true && JSON.stringify(afterRestart.names) === JSON.stringify(["a", "b"]), JSON.stringify(afterRestart));
	rmSync(join(profileDir, ".kidai-favorites.json"), { force: true });
}

// Case D: audit severity reclassification — common benign patterns must be
// warnings, only genuinely suspicious patterns may block the install.
{
	const auditDir = mkdtempSync(join(tmpdir(), "kpmh-audit-"));
	const src = join(auditDir, "src");
	mkdirSync(src, { recursive: true });
	writeFileSync(join(src, "package.json"), JSON.stringify({ name: "x", version: "1.0.0", scripts: { postinstall: "node build.js" } }));
	writeFileSync(join(src, "index.js"), 'const key = process.env.DEEPSEEK_API_KEY;\nrequire("dotenv").config();\nfetch("https://api.example.com");\n');
	writeFileSync(join(src, "bad.js"), "eval(userInput);\n");
	// Property access must NOT look like a credential path / shell-config file.
	writeFileSync(join(src, "property.js"), 'const profile = scanResult.profile || "web";\nconst rc = config.npmrc;\n');
	// Real file paths must still be flagged.
	writeFileSync(join(src, "paths.js"), 'const home = "~/.bashrc";\nconst npmrc = "/.npmrc";\n');
	const gateway = makeGateway({ loadable: true });
	const view = gateway.scanAuditDir(src, "x");
	const kinds = view.findings.map((f) => `${f.severity}:${f.kind}`);
	check("lifecycle script is a warning", kinds.includes("warn:生命周期脚本"), kinds.join(","));
	check("API-key env read is a warning", kinds.includes("warn:读取密钥环境变量"), kinds.join(","));
	check("network usage is a warning", kinds.includes("warn:网络请求"), kinds.join(","));
	check("dynamic execution is still a block", kinds.includes("block:动态执行"), kinds.join(","));
	check("property access `scanResult.profile` is not shell-config tampering", view.findings.filter((f) => f.kind === "改 shell 配置").length === 1, JSON.stringify(view.findings.map((f) => f.kind)));
	check("property access `config.npmrc` is not a credential file", view.findings.filter((f) => f.kind === "凭据文件访问").length === 1, JSON.stringify(view.findings.map((f) => f.kind)));
	check("real `~/.bashrc` path is still flagged", kinds.includes("block:改 shell 配置"), kinds.join(","));
	check("real `/.npmrc` path is still flagged", kinds.includes("block:凭据文件访问"), kinds.join(","));
	check("blocked flag reflects the real block", view.blocked === true);
	rmSync(auditDir, { recursive: true, force: true });
}

// Case E: a loadable bundle whose patch INSERTs rows colliding with existing
// loader entry ids → the scan detects the conflict, the install is CANCELLED
// and rolled back, and the plugin's files are never modified.
{
	resetManifest();
	const gateway = makeGateway({ loadable: true, colliding: true });
	const result = await gateway.installPlugin("dsh-emoji", { allowRisky: true });
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("conflicting install cancelled", result.ok === false, JSON.stringify(result));
	check("result carries conflictIds", Array.isArray(result.conflictIds) && result.conflictIds.includes("storage"), JSON.stringify(result.conflictIds));
	check("message explains the conflict and that files were not modified", typeof result.message === "string" && result.message.includes("storage") && result.message.includes("未修改插件文件"), result.message);
	check("rollback removed the dependency", m.dependencies["dsh-emoji"] === void 0);
	check("rollback left bundles untouched", !(m.dsh.profile.bundles ?? []).includes("dsh-emoji"));
	check("rollback removed node_modules copy", !existsSync(join(profileDir, "node_modules", "dsh-emoji")));
	check("rollback restored original manifest", JSON.stringify(m) === JSON.stringify(ORIGINAL), JSON.stringify(m));
}

// Case F: monorepo subpackage install (`owner/repo#sub`) — spec resolution
// carries the sub name, the tarball locator finds the subpackage dir, and the
// install prepares a stable vendor copy that pnpm consumes via a `file:` spec.
{
	const { resolveInstallSpec, locateSubpackageDir } = await import("../lib/index.js");
	const resolved = await resolveInstallSpec("EthanYoQ/AI-Novel-Writer#dsh-ai-novel-writer");
	check("sub spec resolves as git", resolved !== null && resolved.kind === "git", JSON.stringify(resolved));
	check("sub spec carries owner/repo/sub", resolved !== null && resolved.owner === "EthanYoQ" && resolved.repoName === "AI-Novel-Writer" && resolved.sub === "dsh-ai-novel-writer", JSON.stringify(resolved));

	const tree = mkdtempSync(join(tmpdir(), "kpmh-subtree-"));
	const repoRoot = join(tree, "AI-Novel-Writer-main");
	mkdirSync(join(repoRoot, "plugins", "dsh-ai-novel-writer", "lib"), { recursive: true });
	writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ name: "ai-novel-writer", private: true }));
	writeFileSync(join(repoRoot, "plugins", "dsh-ai-novel-writer", "package.json"), JSON.stringify({ name: "@ethanyoq/dsh-ai-novel-writer", version: "0.1.0", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
	writeFileSync(join(repoRoot, "plugins", "dsh-ai-novel-writer", "cordis.patch.yml"), "- insert:\n    - id: ai-novel-writer\n      name: '@ethanyoq/dsh-ai-novel-writer'\n");
	writeFileSync(join(repoRoot, "plugins", "dsh-ai-novel-writer", "lib", "index.js"), "module.exports = {};\n");
	const found = locateSubpackageDir(tree, "dsh-ai-novel-writer");
	check("subpackage locator finds the scoped package dir", found !== null && found.endsWith(join("plugins", "dsh-ai-novel-writer")), String(found));
	check("subpackage locator ignores the repo-root package", found !== null && !found.endsWith("AI-Novel-Writer-main"), String(found));
	const missing = locateSubpackageDir(tree, "no-such-sub");
	check("subpackage locator returns null for a missing sub", missing === null, String(missing));

	// Vendor-copy install through the gateway: stub runChild so `add file:…`
	// records the dependency and creates the node_modules copy, mirroring what
	// pnpm does for a `file:` spec.
	resetManifest();
	const gateway = makeGateway({ loadable: true });
	gateway.prepareGitSubpackage = async (_resolved, _profileDir) => {
		const vendorDir = join(profileDir, ".kidai-vendor", "EthanYoQ-AI-Novel-Writer-dsh-ai-novel-writer");
		mkdirSync(join(vendorDir, "lib"), { recursive: true });
		writeFileSync(join(vendorDir, "package.json"), JSON.stringify({ name: "@ethanyoq/dsh-ai-novel-writer", version: "0.1.0", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
		writeFileSync(join(vendorDir, "cordis.patch.yml"), "- insert:\n    - id: ai-novel-writer\n      name: '@ethanyoq/dsh-ai-novel-writer'\n");
		writeFileSync(join(vendorDir, "lib", "index.js"), "module.exports = {};\n");
		return { ok: true, dir: vendorDir, usedMirror: true };
	};
	gateway.runChild = async (_command, args) => {
		const op = args[1];
		const spec = args[2];
		if (op === "add") {
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			m.dependencies["@ethanyoq/dsh-ai-novel-writer"] = spec;
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			const pkgDir = join(profileDir, "node_modules", "@ethanyoq", "dsh-ai-novel-writer");
			mkdirSync(pkgDir, { recursive: true });
			writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "@ethanyoq/dsh-ai-novel-writer", version: "0.1.0", main: "lib/index.js", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
			mkdirSync(join(pkgDir, "lib"), { recursive: true });
			writeFileSync(join(pkgDir, "lib", "index.js"), "module.exports = {};\n");
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
	};
	const subResult = await gateway.installPlugin("EthanYoQ/AI-Novel-Writer#dsh-ai-novel-writer", { allowRisky: true });
	const subManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("subpackage install reports ok", subResult.ok === true, JSON.stringify(subResult));
	check("subpackage install shows the human spec in the message", typeof subResult.message === "string" && subResult.message.includes("EthanYoQ/AI-Novel-Writer#dsh-ai-novel-writer"), subResult.message);
	check("subpackage install notes the mirror", typeof subResult.message === "string" && subResult.message.includes("镜像"), subResult.message);
	check("subpackage dependency recorded by its own name", subManifest.dependencies["@ethanyoq/dsh-ai-novel-writer"] !== void 0);
	check("subpackage promoted into bundles", (subManifest.dsh.profile.bundles ?? []).includes("@ethanyoq/dsh-ai-novel-writer"));
	check("subpackage channel labelled git(子包)", subResult.channel === "git(子包)", subResult.channel);
	rmSync(tree, { recursive: true, force: true });
}

// Case F2: when github.com is UNREACHABLE, a whole-repo install (`owner/repo`
// without #sub) must fall back to the mirror tarball path instead of stalling
// on the git protocol — the deepseek-manners failure mode.
{
	resetManifest();
	const gateway = makeGateway({ loadable: true });
	gateway.prepareGitSubpackage = async (_resolved, _profileDir) => {
		const vendorDir = join(profileDir, ".kidai-vendor", "Moeblack-deepseek-manners");
		mkdirSync(vendorDir, { recursive: true });
		writeFileSync(join(vendorDir, "package.json"), JSON.stringify({ name: "deepseek-manners", version: "0.1.0", main: "index.js", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
		writeFileSync(join(vendorDir, "index.js"), "module.exports = {};\n");
		writeFileSync(join(vendorDir, "cordis.patch.yml"), "- insert:\n    - id: manners\n      name: 'deepseek-manners'\n");
		return { ok: true, dir: vendorDir, usedMirror: true };
	};
	gateway.runChild = async (_command, args) => {
		const op = args[1];
		const spec = args[2];
		if (op === "add") {
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			m.dependencies["deepseek-manners"] = spec;
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			const pkgDir = join(profileDir, "node_modules", "deepseek-manners");
			mkdirSync(pkgDir, { recursive: true });
			writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "deepseek-manners", version: "0.1.0", main: "index.js", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
			writeFileSync(join(pkgDir, "index.js"), "module.exports = {};\n");
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
	};
	const { githubReachable } = await import("../lib/index.js");
	// Force the "unreachable" branch regardless of the real network.
	gateway.githubReachableOverride = () => false;
	const result = await gateway.installPlugin("Moeblack/deepseek-manners", { allowRisky: true });
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("whole-repo install via tarball reports ok", result.ok === true, JSON.stringify(result));
	check("whole-repo dependency recorded", m.dependencies["deepseek-manners"] !== void 0);
	check("whole-repo promoted into bundles", (m.dsh.profile.bundles ?? []).includes("deepseek-manners"));
	check("vendor dir created", existsSync(join(profileDir, ".kidai-vendor", "Moeblack-deepseek-manners")));
}

// Case G: a bundle that declares `main`/`exports` pointing at a file that does
// not exist (TypeScript source-only subpackage, e.g. the AI-Novel-Writer
// failure mode) → the install must be rejected and rolled back instead of
// letting DSH fail at boot with ERR_MODULE_NOT_FOUND.
{
	resetManifest();
	const gateway = makeGateway({ loadable: true, missingEntry: true });
	const result = await gateway.installPlugin("dsh-emoji", { allowRisky: true });
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("missing-entry install fails", result.ok === false, JSON.stringify(result));
	check("failure message explains the missing entry", typeof result.message === "string" && result.message.includes("入口文件") && result.message.includes("lib/"), result.message);
	check("rollback removed the dependency", m.dependencies["dsh-emoji"] === void 0);
	check("rollback left bundles untouched", !(m.dsh.profile.bundles ?? []).includes("dsh-emoji"));
	check("rollback restored original manifest", JSON.stringify(m) === JSON.stringify(ORIGINAL), JSON.stringify(m));

	// A bundle whose main/exports point at an EXISTING file still installs.
	resetManifest();
	const gatewayOk = makeGateway({ loadable: true });
	gatewayOk.runChild = async (_command, args) => {
		const op = args[1];
		const spec = args[2];
		if (op === "add") {
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			m.dependencies[spec] = "^1.0.0";
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			const pkgDir = join(profileDir, "node_modules", spec);
			mkdirSync(join(pkgDir, "lib"), { recursive: true });
			writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: spec, version: "1.0.0", main: "lib/index.js", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
			writeFileSync(join(pkgDir, "lib", "index.js"), "module.exports = {};\n");
			writeFileSync(join(pkgDir, "cordis.patch.yml"), "- insert:\n    - id: dsh-emoji\n      name: dsh-emoji\n");
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
	};
	const okResult = await gatewayOk.installPlugin("dsh-emoji", { allowRisky: true });
	check("existing-entry install succeeds", okResult.ok === true, JSON.stringify(okResult));
	check("existing-entry package promoted into bundles", (JSON.parse(readFileSync(manifestPath, "utf8")).dsh.profile.bundles ?? []).includes("dsh-emoji"));
}

// Case M: a "plugin" that declares `dsh.bundle.patch` but ships NO entry at
// all (no main, no exports, no index.js) must be rejected — the misakanet
// failure mode. The loader falls back to `<pkgDir>/index.js`, which does not
// exist, and the WHOLE plugin tree fails at boot.
{
	resetManifest();
	const gateway = makeGateway({ loadable: true });
	gateway.runChild = async (_command, args) => {
		const op = args[1];
		const spec = args[2];
		if (op === "add") {
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			m.dependencies[spec] = "^1.0.0";
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			const pkgDir = join(profileDir, "node_modules", spec);
			mkdirSync(pkgDir, { recursive: true });
			// No main, no exports, no index.js — just dsh.bundle + a patch.
			writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: spec, version: "1.0.0", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
			writeFileSync(join(pkgDir, "cordis.patch.yml"), "- insert:\n    - id: " + spec + "\n      name: " + spec + "\n");
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
	};
	const result = await gateway.installPlugin("misakanet", { allowRisky: true });
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("no-entry pseudo-plugin install is rejected", result.ok === false, JSON.stringify(result));
	check("failure message mentions the missing entry", typeof result.message === "string" && result.message.includes("无法作为 DSH 插件加载") && result.message.includes("入口文件"), result.message);
	check("rollback removed the dependency", m.dependencies["misakanet"] === void 0);
	check("rollback left bundles untouched", !(m.dsh.profile.bundles ?? []).includes("misakanet"));

	// A package with no declared entry but a present index.js IS loadable.
	resetManifest();
	const gateway2 = makeGateway({ loadable: true });
	gateway2.runChild = async (_command, args) => {
		const op = args[1];
		const spec = args[2];
		if (op === "add") {
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			m.dependencies[spec] = "^1.0.0";
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			const pkgDir = join(profileDir, "node_modules", spec);
			mkdirSync(pkgDir, { recursive: true });
			writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: spec, version: "1.0.0", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
			writeFileSync(join(pkgDir, "index.js"), "module.exports = {};\n");
			writeFileSync(join(pkgDir, "cordis.patch.yml"), "- insert:\n    - id: " + spec + "\n      name: " + spec + "\n");
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
	};
	const okResult = await gateway2.installPlugin("legacy-index", { allowRisky: true });
	check("index.js fallback install succeeds", okResult.ok === true, JSON.stringify(okResult));
	check("index.js fallback promoted into bundles", (JSON.parse(readFileSync(manifestPath, "utf8")).dsh.profile.bundles ?? []).includes("legacy-index"));
}

// Case H: a source-only subpackage whose declared entry is missing must be
// BUILT before install (the AI-Novel-Writer failure mode), and a failed build
// must reject the install instead of shipping a bundle that breaks DSH at boot.
{
	// H1: entry missing + buildVendorSubpackage produces lib/ → install ok.
	resetManifest();
	const gatewayH1 = makeGateway({ loadable: true });
	gatewayH1.prepareGitSubpackage = async (_resolved, _profileDir) => {
		const vendorDir = join(profileDir, ".kidai-vendor", "EthanYoQ-AI-Novel-Writer-dsh-ai-novel-writer");
		mkdirSync(vendorDir, { recursive: true });
		// Source-only: no lib/ yet, but declares main + a build script.
		writeFileSync(join(vendorDir, "package.json"), JSON.stringify({ name: "@ethanyoq/dsh-ai-novel-writer", version: "0.1.0", main: "lib/index.js", scripts: { build: "tsc" }, dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
		writeFileSync(join(vendorDir, "cordis.patch.yml"), "- insert:\n    - id: ai-novel-writer\n      name: '@ethanyoq/dsh-ai-novel-writer'\n");
		return { ok: true, dir: vendorDir, usedMirror: true };
	};
	gatewayH1.buildVendorSubpackage = async (vendorDir) => {
		mkdirSync(join(vendorDir, "lib"), { recursive: true });
		writeFileSync(join(vendorDir, "lib", "index.js"), "module.exports = {};\n");
		return { ok: true };
	};
	gatewayH1.runChild = async (_command, args) => {
		const op = args[1];
		if (op === "add") {
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			m.dependencies["@ethanyoq/dsh-ai-novel-writer"] = args[2];
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			const pkgDir = join(profileDir, "node_modules", "@ethanyoq", "dsh-ai-novel-writer");
			mkdirSync(join(pkgDir, "lib"), { recursive: true });
			writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "@ethanyoq/dsh-ai-novel-writer", version: "0.1.0", main: "lib/index.js", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
			writeFileSync(join(pkgDir, "lib", "index.js"), "module.exports = {};\n");
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
	};
	const h1 = await gatewayH1.installPlugin("EthanYoQ/AI-Novel-Writer#dsh-ai-novel-writer", { allowRisky: true });
	check("built subpackage install succeeds", h1.ok === true, JSON.stringify(h1));
	check("built subpackage promoted into bundles", (JSON.parse(readFileSync(manifestPath, "utf8")).dsh.profile.bundles ?? []).includes("@ethanyoq/dsh-ai-novel-writer"));

	// H2: entry missing + build FAILS → install rejected, no broken bundle.
	resetManifest();
	const gatewayH2 = makeGateway({ loadable: true });
	gatewayH2.prepareGitSubpackage = async (_resolved, _profileDir) => {
		const vendorDir = join(profileDir, ".kidai-vendor", "EthanYoQ-AI-Novel-Writer-dsh-ai-novel-writer");
		mkdirSync(vendorDir, { recursive: true });
		writeFileSync(join(vendorDir, "package.json"), JSON.stringify({ name: "@ethanyoq/dsh-ai-novel-writer", version: "0.1.0", main: "lib/index.js", scripts: { build: "tsc" }, dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
		writeFileSync(join(vendorDir, "cordis.patch.yml"), "- insert:\n    - id: ai-novel-writer\n      name: '@ethanyoq/dsh-ai-novel-writer'\n");
		// Mirror the real flow: an entry-missing subpackage is built first, and
		// a failed build must surface as a rejected prepare (never reaching the
		// pnpm add loop that would record a broken dependency).
		const built = await gatewayH2.buildVendorSubpackage(vendorDir);
		if (!built.ok) return { ok: false, message: built.message };
		return { ok: true, dir: vendorDir, usedMirror: true };
	};
	gatewayH2.buildVendorSubpackage = async () => ({ ok: false, message: "kidai-plugin-market-hub: 子包构建失败: tsc: error TS2322" });
	const h2 = await gatewayH2.installPlugin("EthanYoQ/AI-Novel-Writer#dsh-ai-novel-writer", { allowRisky: true });
	const m2 = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("build-failed subpackage install is rejected", h2.ok === false, JSON.stringify(h2));
	check("build failure message is user-facing", typeof h2.message === "string" && h2.message.includes("构建"), h2.message);
	check("build-failed install left no dependency", m2.dependencies["@ethanyoq/dsh-ai-novel-writer"] === void 0);
	check("build-failed install left bundles untouched", !(m2.dsh.profile.bundles ?? []).includes("@ethanyoq/dsh-ai-novel-writer"));
}

// Case I: a patch whose insert row references `@local/<real>` (the dsh-tavern
// failure mode) is now auto-satisfied by creating the `@local` junction when
// `<real>` is installed — no more manual install.cmd. Only a name with no
// installable target is rejected.
{
	resetManifest();
	const gateway = makeGateway({ loadable: true, localLinkName: true });
	const result = await gateway.installPlugin("dsh-tavern", { allowRisky: true });
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("local-linked install succeeds (junction auto-created)", result.ok === true, JSON.stringify(result));
	check("dependency recorded", m.dependencies["dsh-tavern"] !== void 0);
	check("promoted into bundles", (m.dsh.profile.bundles ?? []).includes("dsh-tavern"));
	check("@local junction exists after install", existsSync(join(profileDir, "node_modules", "@local", "dsh-tavern")));
}

// Case J: a plugin built against an older DSH runtime (peer `@deepseek-ai/dsh-*:
// 0.1.0-rc.6`) is NOT hard-rejected — without allowRisky the install stops for
// an explicit risk acknowledgement (and rolls back); with allowRisky it
// proceeds, applies the generic repairs, and carries the warning.
{
	const { versionSatisfies } = await import("../lib/index.js");
	check("rc.6 peer does not satisfy rc.7 runtime", versionSatisfies("0.1.0-rc.7", "0.1.0-rc.6") === false);
	check("rc.7 peer satisfies rc.7 runtime", versionSatisfies("0.1.0-rc.7", "0.1.0-rc.7") === true);
	check("rc.7 peer caret satisfies rc.7 runtime", versionSatisfies("0.1.0-rc.7", "^0.1.0-rc.7") === true);

	// Without allowRisky: risk confirmation required, install rolled back.
	resetManifest();
	const gateway = makeGateway({ loadable: true, oldPeer: true });
	gateway.runtimeVersionOverride = "0.1.0-rc.7";
	const result = await gateway.installPlugin("dsh-emoji");
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("older-peer install asks for risk confirmation", result.ok === false && result.riskConfirmRequired === true, JSON.stringify(result));
	check("result carries runtimeIncompatible", Array.isArray(result.runtimeIncompatible) && result.runtimeIncompatible.some((v) => String(v).includes("rc.6")), JSON.stringify(result.runtimeIncompatible));
	check("message explains the runtime mismatch", typeof result.message === "string" && result.message.includes("旧版 DSH 运行时") && result.message.includes("rc.7"), result.message);
	check("rollback removed the dependency", m.dependencies["dsh-emoji"] === void 0);
	check("rollback left bundles untouched", !(m.dsh.profile.bundles ?? []).includes("dsh-emoji"));
	check("rollback restored original manifest", JSON.stringify(m) === JSON.stringify(ORIGINAL), JSON.stringify(m));

	// With allowRisky: install proceeds and the success payload carries the
	// runtime warnings (the generic repairs apply to the client bundle).
	resetManifest();
	const gateway2 = makeGateway({ loadable: true, oldPeer: true });
	gateway2.runtimeVersionOverride = "0.1.0-rc.7";
	const result2 = await gateway2.installPlugin("dsh-emoji", { allowRisky: true });
	const m2 = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("older-peer install proceeds with allowRisky", result2.ok === true, JSON.stringify(result2));
	check("success payload carries runtimeIncompatible", Array.isArray(result2.runtimeIncompatible) && result2.runtimeIncompatible.some((v) => String(v).includes("rc.6")), JSON.stringify(result2.runtimeIncompatible));
	check("success message warns about the legacy runtime", typeof result2.message === "string" && result2.message.includes("风险提示"), result2.message);
	check("dependency recorded", m2.dependencies["dsh-emoji"] !== void 0);
	check("promoted into bundles", (m2.dsh.profile.bundles ?? []).includes("dsh-emoji"));
}

// Case K: uninstalling a `@local/*`-linked plugin (e.g. tavern) must resolve
// the real dependency name (`dsh-tavern`), run pnpm remove on it, drop the
// `@local/...` junction, remove it from bundles, and clean the patch row —
// including the row whose id is the loader entry's plain id (`tavern`), which
// is neither the real name nor the @local name.
{
	resetManifest();
	const gateway = makeGateway({ loadable: true });
	// Home patch layer: a `tavern` row (plain loader id) plus an unrelated row.
	const homeDir = join(dir, "home");
	mkdirSync(homeDir, { recursive: true });
	const patchPath = join(homeDir, "cordis.patch.yml");
	writeFileSync(patchPath, "- id: tavern\n  disabled: true\n- id: plugin-market-hub\n  disabled: false\n");
	process.env.DSH_HOME = homeDir;
	// Simulate the loader entry mounted under the @local name with plain id `tavern`.
	gateway.ctx.loader = { entries: () => [{ id: "tavern", options: { name: "@local/dsh-tavern" } }] };
	// Set up: manifest has dsh-tavern, bundles has dsh-tavern, @local junction exists.
	{
		const m = JSON.parse(readFileSync(manifestPath, "utf8"));
		m.dependencies["dsh-tavern"] = "^1.5.0";
		m.dsh.profile.bundles.push("dsh-tavern");
		writeFileSync(manifestPath, JSON.stringify(m, null, 2));
		const localDir = join(profileDir, "node_modules", "@local", "dsh-tavern");
		rmSync(localDir, { recursive: true, force: true });
		const realDir = join(profileDir, "node_modules", "dsh-tavern");
		mkdirSync(realDir, { recursive: true });
		writeFileSync(join(realDir, "package.json"), JSON.stringify({ name: "dsh-tavern", version: "1.5.0" }));
		// A REAL junction (not a plain dir) pointing at the real package — after
		// pnpm remove deletes the target the junction goes DANGLING, which is
		// exactly the residue case from the tavern uninstall.
		mkdirSync(join(profileDir, "node_modules", "@local"), { recursive: true });
		symlinkSync(realDir, localDir, "junction");
	}
	// Stub pnpm remove: delete the real dep from manifest + node_modules
	// (the junction is left dangling, like real pnpm does).
	const realPnpm = gateway.runChild;
	gateway.runChild = async (_command, args) => {
		const op = args[1];
		if (op === "remove") {
			const spec = args[2];
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			delete m.dependencies[spec];
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			rmSync(join(profileDir, "node_modules", spec), { recursive: true, force: true });
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		return realPnpm(_command, args);
	};
	const result = await gateway.uninstallPlugin("@local/dsh-tavern");
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	const patchAfter = readFileSync(patchPath, "utf8");
	check("local-linked uninstall reports ok", result.ok === true, JSON.stringify(result));
	check("real dependency removed from manifest", m.dependencies["dsh-tavern"] === void 0);
	check("removed from bundles", !(m.dsh.profile.bundles ?? []).includes("dsh-tavern"));
	check("dangling @local junction removed", !existsSync(join(profileDir, "node_modules", "@local", "dsh-tavern")));
	check("real node_modules copy removed", !existsSync(join(profileDir, "node_modules", "dsh-tavern")));
	check("patch row with loader entry id removed", !patchAfter.includes("tavern"), patchAfter);
	check("unrelated patch rows kept", patchAfter.includes("plugin-market-hub"), patchAfter);
}

// Case K2: uninstalling by the PLAIN package name (`dsh-tavern`) must also
// remove a leftover `@local/dsh-tavern` junction (the pre-fix residue).
{
	resetManifest();
	const gateway = makeGateway({ loadable: true });
	{
		const m = JSON.parse(readFileSync(manifestPath, "utf8"));
		m.dependencies["dsh-tavern"] = "^1.5.0";
		m.dsh.profile.bundles.push("dsh-tavern");
		writeFileSync(manifestPath, JSON.stringify(m, null, 2));
		const realDir = join(profileDir, "node_modules", "dsh-tavern");
		mkdirSync(realDir, { recursive: true });
		writeFileSync(join(realDir, "package.json"), JSON.stringify({ name: "dsh-tavern", version: "1.5.0" }));
		mkdirSync(join(profileDir, "node_modules", "@local"), { recursive: true });
		symlinkSync(realDir, join(profileDir, "node_modules", "@local", "dsh-tavern"), "junction");
	}
	const realPnpm = gateway.runChild;
	gateway.runChild = async (_command, args) => {
		const op = args[1];
		if (op === "remove") {
			const spec = args[2];
			const m = JSON.parse(readFileSync(manifestPath, "utf8"));
			delete m.dependencies[spec];
			writeFileSync(manifestPath, JSON.stringify(m, null, 2));
			rmSync(join(profileDir, "node_modules", spec), { recursive: true, force: true });
			return { error: void 0, status: 0, stdout: "", stderr: "", timedOut: false };
		}
		return realPnpm(_command, args);
	};
	const result = await gateway.uninstallPlugin("dsh-tavern");
	const m = JSON.parse(readFileSync(manifestPath, "utf8"));
	check("plain-name uninstall reports ok", result.ok === true, JSON.stringify(result));
	check("plain-name uninstall removed the dependency", m.dependencies["dsh-tavern"] === void 0);
	check("plain-name uninstall removed leftover @local junction", !existsSync(join(profileDir, "node_modules", "@local", "dsh-tavern")));
}

// Case L: orphan management — mountOrphan remounts a declared-but-disabled
// plugin (adds it back to bundles + clears the HOME patch disabled row), and
// removeOrphanFiles deletes residue files of an UNDECLARED orphan.
{
	resetManifest();
	const gateway = makeGateway({ loadable: true });
	const homeDir = join(dir, "homeL");
	mkdirSync(homeDir, { recursive: true });
	const patchPath = join(homeDir, "cordis.patch.yml");
	writeFileSync(patchPath, "- id: dsh-easyrewrite\n  disabled: true\n- id: plugin-market-hub\n  disabled: false\n");
	process.env.DSH_HOME = homeDir;
	// Declared orphan: in deps, NOT in bundles, patch row disabled.
	{
		const m = JSON.parse(readFileSync(manifestPath, "utf8"));
		m.dependencies["dsh-easyrewrite"] = "^1.0.3";
		writeFileSync(manifestPath, JSON.stringify(m, null, 2));
		const pkgDir = join(profileDir, "node_modules", "dsh-easyrewrite");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "dsh-easyrewrite", version: "1.0.3", main: "lib/index.js", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
		mkdirSync(join(pkgDir, "lib"), { recursive: true });
		writeFileSync(join(pkgDir, "lib", "index.js"), "module.exports = {};\n");
	}
	const mountResult = await gateway.mountOrphan("dsh-easyrewrite");
	const mAfterMount = JSON.parse(readFileSync(manifestPath, "utf8"));
	const patchAfterMount = readFileSync(patchPath, "utf8");
	check("mountOrphan reports ok", mountResult.ok === true, JSON.stringify(mountResult));
	check("mountOrphan restarted-flag set", mountResult.restartNeeded === true);
	check("declared orphan added back to bundles", (mAfterMount.dsh.profile.bundles ?? []).includes("dsh-easyrewrite"));
	check("HOME patch disabled row cleared", !patchAfterMount.includes("dsh-easyrewrite"), patchAfterMount);
	check("unrelated patch rows kept", patchAfterMount.includes("plugin-market-hub"), patchAfterMount);

	// Undeclared orphan: files on disk, no dependency entry → removeOrphanFiles.
	{
		const residueDir = join(profileDir, "node_modules", "leftover-plugin");
		mkdirSync(residueDir, { recursive: true });
		writeFileSync(join(residueDir, "package.json"), JSON.stringify({ name: "leftover-plugin", version: "0.1.0", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
	}
	const removeResult = await gateway.removeOrphanFiles("leftover-plugin");
	check("removeOrphanFiles reports ok", removeResult.ok === true, JSON.stringify(removeResult));
	check("undeclared orphan files deleted", !existsSync(join(profileDir, "node_modules", "leftover-plugin")));
	check("manifest untouched by removeOrphanFiles", JSON.parse(readFileSync(manifestPath, "utf8")).dependencies["leftover-plugin"] === void 0);
	// Declared orphan routed through uninstall: also removes the dependency.
	const removeDeclared = await gateway.removeOrphanFiles("dsh-easyrewrite");
	check("removeOrphanFiles on declared orphan routes to uninstall", removeDeclared.ok === true && JSON.parse(readFileSync(manifestPath, "utf8")).dependencies["dsh-easyrewrite"] === void 0, JSON.stringify(removeDeclared));

	// A declared orphan with NO importable entry (misakanet-type) must be
	// refused by mountOrphan — remounting it would crash DSH at boot.
	{
		const m = JSON.parse(readFileSync(manifestPath, "utf8"));
		m.dependencies["misakanet"] = "github:Ikalus1988/MisakaNet";
		writeFileSync(manifestPath, JSON.stringify(m, null, 2));
		const pkgDir = join(profileDir, "node_modules", "misakanet");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "misakanet", version: "0.0.0", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
		writeFileSync(join(pkgDir, "cordis.patch.yml"), "- insert:\n    - id: misakanet\n      name: misakanet\n");
	}
	const mountNoEntry = await gateway.mountOrphan("misakanet");
	check("mountOrphan refuses a no-entry orphan", mountNoEntry.ok === false && typeof mountNoEntry.message === "string" && mountNoEntry.message.includes("入口"), JSON.stringify(mountNoEntry));

	// Mount-without-enable: `{ disabled: true }` adds the package to bundles
	// but WRITES a disabled row in the HOME patch ("挂载但不启用") — the loader
	// creates the entry but does not run it.
	{
		const m = JSON.parse(readFileSync(manifestPath, "utf8"));
		m.dependencies["kidai-plugin-market"] = "file:D:/workspace/kidai-plugin-market";
		writeFileSync(manifestPath, JSON.stringify(m, null, 2));
		const pkgDir = join(profileDir, "node_modules", "kidai-plugin-market");
		mkdirSync(join(pkgDir, "lib"), { recursive: true });
		writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "kidai-plugin-market", version: "1.0.0", main: "lib/index.js", dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
		writeFileSync(join(pkgDir, "lib", "index.js"), "module.exports = {};\n");
		writeFileSync(join(pkgDir, "cordis.patch.yml"), "- insert:\n    - id: plugin-market\n      name: 'kidai-plugin-market'\n");
	}
	const mountDisabled = await gateway.mountOrphan("kidai-plugin-market", { disabled: true });
	const mAfterDisabled = JSON.parse(readFileSync(manifestPath, "utf8"));
	const patchAfterDisabled = readFileSync(patchPath, "utf8");
	check("mount-without-enable reports ok", mountDisabled.ok === true, JSON.stringify(mountDisabled));
	check("mount-without-enable flags disabled", mountDisabled.disabled === true);
	check("mount-without-enable added to bundles", (mAfterDisabled.dsh.profile.bundles ?? []).includes("kidai-plugin-market"));
	check("mount-without-enable wrote a disabled row", patchAfterDisabled.includes("plugin-market") && patchAfterDisabled.includes("disabled: true"), patchAfterDisabled);
}

console.log(failures === 0 ? "\nINSTALL-GUARD CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
