// Smoke-test for kidai-plugin-market client bundle (lib/client.js).
// Loads the bundle through a minimal window.__ModuleLoader__ stand-in with a
// seed-module require map, runs apply() against a stub cordis ctx, and checks
// that the 插件市场 tab registers into settings.plugins.tab with working
// listPublished / installed / install injections.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bundlePath = fileURLToPath(new URL("../lib/client.js", import.meta.url));
const source = readFileSync(bundlePath, "utf8");

let registered = null;
globalThis.window = {
	__ModuleLoader__: {
		load(handoff) {
			registered = handoff;
		}
	},
	document: {
		querySelector: () => null,
		createElement: () => ({ dataset: {}, set textContent(value) {}, appendChild() {} }),
		head: { appendChild() {} }
	}
};
globalThis.document = globalThis.window.document;

// seed-module stand-ins
const react = await import("react");
const jsxRuntime = await import("react/jsx-runtime");
const primitives = new Proxy({}, {
	get: (_target, prop) => (typeof prop === "string" ? () => null : void 0)
});
const moduleTable = new Map([
	["react", react],
	["react/jsx-runtime", jsxRuntime],
	["@deepseek-ai/dsh-client-ui-primitives", primitives]
]);

const factoryRequire = (spec) => {
	if (!moduleTable.has(spec)) throw new Error(`test require missed: ${spec}`);
	return moduleTable.get(spec);
};

let failures = 0;
function check(label, condition, detail = "") {
	if (condition) console.log(`  ok  ${label}`);
	else {
		failures += 1;
		console.error(`FAIL  ${label} ${detail}`);
	}
}

// 1. bundle registers through __ModuleLoader__
// The bundle body is `window.__ModuleLoader__.load({...})`; evaluate it.
new Function("window", "require", source)(globalThis.window, factoryRequire);
check("bundle registered via __ModuleLoader__", registered !== null && registered.id === "kidai-plugin-market");
const exportsOf = registered.factory(factoryRequire);
check("bundle exports apply + inject", typeof exportsOf.apply === "function" && Array.isArray(exportsOf.inject));
check("inject declares slots/locale/remote", ["slots", "locale", "remote"].every((name) => exportsOf.inject.includes(name)));

// 2. run apply() against a stub ctx
const contributions = [];
let tabRegistration = null;
let actionRegistration = null;
const fakeCatalog = {
	entries: [
		{ id: "a/b", name: "b", owner: "a", description: "test plugin", iconUrl: "", url: "https://github.com/a/b", homepage: "", topics: ["dsh-plugin"], stars: 3, updatedAt: "2026-02-01T00:00:00Z" }
	],
	fetchedAt: "2026-02-01T00:00:00Z",
	source: "test"
};
const fakeInstalled = { dependencies: ["b"], bundles: ["b"], plugins: [{ name: "dsh-plugin-cc", entryId: "cc", enabled: true, path: "C:/x/node_modules/dsh-plugin-cc" }], profileDir: "C:/x" };
const fakeNs = {
	listPublished: async ({ force, sort }) => ({ ok: true, value: { ...fakeCatalog, forced: force, sort } }),
	installed: async () => ({ ok: true, value: fakeInstalled }),
	installPlugin: async (spec, options) => ({ ok: true, value: { ok: true, packageName: spec, options, message: "installed", restartNeeded: true, command: "" } }),
	setEnabled: async (entryId, enabled) => ({ ok: true, value: { ok: true, entryId, enabled, message: "toggled", restartNeeded: true, restartSupported: false } }),
	openLocal: async (packageName) => ({ ok: true, value: { ok: true, packageName, path: "C:/x", message: "opened", restartNeeded: false } }),
	restartApp: async () => ({ ok: true, value: { ok: true, restartSupported: false, message: "unsupported here" } }),
	cancelEnabled: async (entryId) => ({ ok: true, value: { ok: true, entryId, message: "cancelled", restartNeeded: false } }),
	checkUpdates: async () => ({ ok: true, value: { updates: [{ packageName: "dsh-plugin-cc", current: "1.0.0", latest: "2.0.0", updatable: true }], skipped: [] } }),
	updatePlugin: async (packageName) => ({ ok: true, value: { ok: true, packageName, message: "updated", restartNeeded: true } }),
	fetchReadme: async (owner, repo) => ({ ok: true, value: { ok: true, text: `# readme of ${repo}`, encoding: "utf-8", url: "" } }),
	auditPackage: async (spec) => ({ ok: true, value: { ok: true, blocked: false, findings: [], detail: spec } }),
	openConfig: async () => ({ ok: true, value: { ok: true, path: "C:/x", message: "opened config", restartNeeded: false } })
};
const localeBundles = {};
const ctx = {
	get(name) {
		if (name === "remote.pluginMarket") return fakeNs;
		return void 0;
	},
	effect(fn, label) {
		const disposer = fn();
		return typeof disposer === "function" ? disposer : () => {};
	},
	locale: {
		register: (ns, bundles) => { localeBundles[ns] = bundles; },
		bind: (ns) => (key) => localeBundles[ns]?.en?.[key] ?? localeBundles[ns]?.zh?.[key] ?? key
	},
	remote: {
		async $mount(contribution) {
			contributions.push(contribution);
			return () => {};
		}
	},
	slots: {
		inject(name, callback) {
			check("slots.inject targets settings.plugins.tab or settings.action", name === "settings.plugins.tab" || name === "settings.action", name);
			if (name === "settings.plugins.tab") tabRegistration = callback;
			else actionRegistration = callback;
		},
		register(options, component) {
			return { options, component };
		}
	}
};
const disposer = await exportsOf.apply(ctx);
check("apply mounts pluginMarket remote contribution", contributions.length === 1 && contributions[0].package === "kidai-plugin-market");
check("apply registers a tab", tabRegistration !== null);
check("apply registers settings actions", actionRegistration !== null);
const tab = tabRegistration();
check("tab id is market", tab.options.id === "market");
check("tab order after plugin list", tab.options.order >= 10);
check("tab label resolves", typeof tab.options.label() === "string" && tab.options.label().length > 0);
check("tab component is a function", typeof tab.component === "function");
const injected = tab.options.inject();
check("inject provides listPublished", typeof injected.listPublished === "function");
check("inject provides installed", typeof injected.installed === "function");
check("inject provides install", typeof injected.install === "function");
check("inject provides setEnabled", typeof injected.setEnabled === "function");
check("inject provides openLocal", typeof injected.openLocal === "function");
check("inject provides cancelEnabled", typeof injected.cancelEnabled === "function");
check("inject provides auditPackage/checkUpdates/updatePlugin/fetchReadme", typeof injected.auditPackage === "function" && typeof injected.checkUpdates === "function" && typeof injected.updatePlugin === "function" && typeof injected.fetchReadme === "function");
const actions = actionRegistration();
check("settings.action id is plugin-market-actions (order -10, left of core)", actions.options.id === "plugin-market-actions" && actions.options.order === -10);
check("settings.action component is a function", typeof actions.component === "function");
const actionInjected = actions.options.inject();
check("actions inject provides restartApp", typeof actionInjected.restartApp === "function");
check("actions inject provides installed", typeof actionInjected.installed === "function");
check("actions inject has no openConfig", typeof actionInjected.openConfig !== "function");
check("Remote contribution mounts 11 methods", contributions[0].descriptors.length === 11, `got ${contributions[0].descriptors.length}`);
check("descriptors include setEnabled/openLocal/restartApp/cancelEnabled", contributions[0].descriptors.some((d) => d.method === "setEnabled") && contributions[0].descriptors.some((d) => d.method === "openLocal") && contributions[0].descriptors.some((d) => d.method === "restartApp") && contributions[0].descriptors.some((d) => d.method === "cancelEnabled"));
check("descriptors include checkUpdates/updatePlugin/fetchReadme/auditPackage", contributions[0].descriptors.some((d) => d.method === "checkUpdates") && contributions[0].descriptors.some((d) => d.method === "updatePlugin") && contributions[0].descriptors.some((d) => d.method === "fetchReadme") && contributions[0].descriptors.some((d) => d.method === "auditPackage"));
check("installPlugin descriptor carries options param", contributions[0].descriptors.find((d) => d.method === "installPlugin")?.parameters?.some((p) => p.name === "options"));
check("no openConfig descriptor", !contributions[0].descriptors.some((d) => d.method === "openConfig"));
check("no bare install descriptor", !contributions[0].descriptors.some((d) => d.method === "install"));

// 3. injected methods call the fake Remote namespace
const catalog = await injected.listPublished({ force: false });
check("listPublished returns the catalog", catalog.entries.length === 1 && catalog.entries[0].name === "b");
const catalogStars = await injected.listPublished({ force: false, sort: "stars" });
check("listPublished forwards the sort to the namespace", catalogStars.sort === "stars", JSON.stringify(catalogStars));
const installedView = await injected.installed();
check("installed returns the installed view", installedView.dependencies.includes("b"));
const installResult = await injected.install("a/b");
check("install returns the install result", installResult.ok === true && installResult.restartNeeded === true);
const installRisky = await injected.install("a/b", { allowRisky: true });
check("install forwards allowRisky to the namespace", installRisky.options?.allowRisky === true, JSON.stringify(installRisky));
const auditResult = await injected.auditPackage("a/b");
check("auditPackage returns an audit view", auditResult.ok === true && auditResult.blocked === false && Array.isArray(auditResult.findings));
const updatesView = await injected.checkUpdates();
check("checkUpdates returns updates", updatesView.updates.length === 1 && updatesView.updates[0].latest === "2.0.0");
const updateResult = await injected.updatePlugin("dsh-plugin-cc");
check("updatePlugin returns the update result", updateResult.ok === true && updateResult.restartNeeded === true);
const readmeView = await injected.fetchReadme("a", "b");
check("fetchReadme returns readme text", readmeView.ok === true && readmeView.text.includes("readme of b"));
const installedView2 = await injected.installed();
check("installed view includes third-party plugins", Array.isArray(installedView2.plugins) && installedView2.plugins[0]?.name === "dsh-plugin-cc");
const toggleResult = await injected.setEnabled("cc", false);
check("setEnabled calls the remote namespace", toggleResult.ok === true && toggleResult.enabled === false && toggleResult.restartSupported === false);
const openResult = await injected.openLocal("dsh-plugin-cc");
check("openLocal calls the remote namespace", openResult.ok === true && openResult.path === "C:/x");
const cancelResult = await injected.cancelEnabled("cc");
check("cancelEnabled calls the remote namespace", cancelResult.ok === true && cancelResult.message === "cancelled");
const restartResult = await actionInjected.restartApp();
check("restartApp (settings action) calls the remote namespace", restartResult.ok === true);

// 4. description/name copy present in both locales
const zhTab = localeBundles["settings.pluginMarket"].zh.tab;
const enTab = localeBundles["settings.pluginMarket"].en.tab;
check("zh tab label is 插件市场", zhTab === "插件市场");
check("en tab label present", typeof enTab === "string" && enTab.length > 0);

if (typeof disposer === "function") disposer();
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
