// Smoke-test for kidai-plugin-market-hub (KPMH) client + host identity.
// Verifies: bundle id, the sidebar launcher + shell overlay registrations
// (and NO settings tab / settings action), launcher label 纪代市场, the
// overlay hosting the two-tab UI with a restart button on top, and the host
// namespace pluginMarketHub with all 11 Remote markers.
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

const react = await import("react");
const jsxRuntime = await import("react/jsx-runtime");
const primitives = new Proxy({}, {
	get: (_target, prop) => (typeof prop === "string" ? () => null : void 0)
});
const clientRuntime = { defineStore: () => ({}) };
const moduleTable = new Map([
	["react", react],
	["react/jsx-runtime", jsxRuntime],
	["@deepseek-ai/dsh-client-ui-primitives", primitives],
	["@deepseek-ai/dsh-client-runtime/client", clientRuntime]
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

new Function("window", "require", source)(globalThis.window, factoryRequire);
check("bundle registered via __ModuleLoader__", registered !== null && registered.id === "kidai-plugin-market-hub");
const exportsOf = registered.factory(factoryRequire);
check("bundle exports apply + inject", typeof exportsOf.apply === "function" && Array.isArray(exportsOf.inject));
check("inject declares slots/locale/remote", ["slots", "locale", "remote"].every((name) => exportsOf.inject.includes(name)));

const contributions = [];
const slotNames = [];
let launcherRegistration = null;
let overlayRegistration = null;
const localeBundles = {};
const fakeNs = {
	listPublished: async ({ force, sort }) => ({ ok: true, value: { entries: [], fetchedAt: new Date().toISOString(), source: "test" } }),
	installed: async () => ({ ok: true, value: { dependencies: [], bundles: [], plugins: [], profileDir: "C:/x", restartSupported: true } }),
	installPlugin: async (spec, options) => ({ ok: true, value: { ok: true, packageName: spec, message: "installed", restartNeeded: true, command: "" } }),
	setEnabled: async () => ({ ok: true, value: { ok: true, message: "toggled", restartNeeded: true, restartSupported: true } }),
	openLocal: async () => ({ ok: true, value: { ok: true, message: "opened", restartNeeded: false } }),
	restartApp: async () => ({ ok: true, value: { ok: true, restartSupported: true, message: "restarting" } }),
	cancelEnabled: async () => ({ ok: true, value: { ok: true, message: "cancelled", restartNeeded: false } }),
	checkUpdates: async () => ({ ok: true, value: { updates: [], skipped: [] } }),
	updatePlugin: async () => ({ ok: true, value: { ok: true, message: "updated", restartNeeded: true } }),
	fetchReadme: async () => ({ ok: true, value: { ok: true, text: "# readme", encoding: "utf-8", url: "" } }),
	auditPackage: async () => ({ ok: true, value: { ok: true, blocked: false, findings: [], detail: "" } })
};
const ctx = {
	get(name) {
		if (name === "remote.pluginMarketHub") return fakeNs;
		return void 0;
	},
	effect(fn) {
		const disposer = fn();
		return typeof disposer === "function" ? disposer : () => {};
	},
	locale: {
		register: (ns, bundles) => { localeBundles[ns] = bundles; },
		bind: (ns) => (key) => localeBundles[ns]?.zh?.[key] ?? localeBundles[ns]?.en?.[key] ?? key
	},
	remote: {
		async $mount(contribution) {
			contributions.push(contribution);
			return () => {};
		}
	},
	slots: {
		inject(name, callback) {
			slotNames.push(name);
			if (name === "sidebar.footer.action") launcherRegistration = callback;
			else if (name === "shell.overlay") overlayRegistration = callback;
		},
		register(options, component) {
			return { options, component };
		}
	}
};

await exportsOf.apply(ctx);

check("no settings.plugins.tab registration in the hub", !slotNames.includes("settings.plugins.tab"), slotNames.join(","));
check("no settings.action registration in the hub", !slotNames.includes("settings.action"), slotNames.join(","));
check("registers sidebar.footer.action + shell.overlay", slotNames.includes("sidebar.footer.action") && slotNames.includes("shell.overlay"), slotNames.join(","));

const launcher = launcherRegistration();
check("launcher id is kidai-plugin-market-hub", launcher.options.id === "kidai-plugin-market-hub");
check("launcher label resolves to 纪代市场", launcher.options.label() === "纪代市场", launcher.options.label());
check("launcher carries the shared store", launcher.options.store !== void 0);
check("launcher component is a function", typeof launcher.component === "function");

const overlay = overlayRegistration();
check("overlay id is kidai-plugin-market-hub", overlay.options.id === "kidai-plugin-market-hub");
check("overlay carries the shared store", overlay.options.store !== void 0);
const overlayInjected = overlay.options.inject();
check("overlay injects all marketplace fns + restartApp", ["listPublished", "installed", "install", "setEnabled", "openLocal", "cancelEnabled", "auditPackage", "checkUpdates", "updatePlugin", "fetchReadme", "restartApp"].every((name) => typeof overlayInjected[name] === "function"));

check("Remote contribution mounts 11 methods under pluginMarketHub", contributions.length === 1 && contributions[0].descriptors.length === 11 && contributions[0].descriptors.every((d) => d.namespace === "pluginMarketHub"), JSON.stringify(contributions[0]?.descriptors?.map((d) => d.method)));

check("launcher source renders a 纪代市场 button", source.includes("hubButton") && source.includes("actions.open()"));
check("overlay hosts the two-tab UI with restart on top", source.includes("PluginMarketTab") && source.includes("dshm_restartBtn") && source.includes("dshm_hubHeader") && source.includes("actions.close()"));

// host identity
const { PluginMarketGateway } = await import("../lib/index.js");
const hostSource = readFileSync(fileURLToPath(new URL("../lib/index.js", import.meta.url)), "utf8");
check("host namespace is pluginMarketHub", hostSource.includes('super(ctx, "pluginMarketHub")'));
check("host identity strings renamed", hostSource.includes("kidai-plugin-market-hub") && !hostSource.includes("super(ctx, \"pluginMarket\")"));
const hubGateway = new PluginMarketGateway({
	reflect: { provide: () => {}, props: {} },
	baseUrl: "file:///C:/x/",
	get: () => void 0,
	logger: { warn() {} }
});
check("hub gateway constructs with namespace pluginMarketHub", hubGateway !== null && hubGateway.typertRemote?.namespace === "pluginMarketHub", hubGateway.typertRemote?.namespace);

console.log(failures === 0 ? "\nHUB CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
