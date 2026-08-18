// Client-side RPC chain repro for the HUB: real cordis + real
// dsh-typert-registry client + real dsh-api-gateway client + the hub's client
// bundle, with a fake connection that captures every /api request. Verifies
// that the hub really issues `pluginMarketHub/<method>` with the right args.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as cordis from "@deepseek-ai/cordis";
import * as react from "react";
import * as jsxRuntime from "react/jsx-runtime";

const app = "D:/Deepseek Harness/DSH Desktop/resources/app.asar.unpacked/node_modules/@deepseek-ai";
const fakeDocument = { querySelector: () => null, createElement: () => ({ dataset: {}, textContent: "", appendChild() {} }), head: { appendChild() {} } };
const primitives = new Proxy({}, { get: (_t, p) => (typeof p === "string" ? () => null : void 0) });
const clientRuntime = { defineStore: () => ({}) };

function evaluateBundle(path) {
	let handoff = null;
	const win = { __ModuleLoader__: { load: (h) => { handoff = h; } }, document: fakeDocument };
	const requireShim = (spec) => {
		if (spec === "@deepseek-ai/cordis") return cordis;
		if (spec === "react") return react;
		if (spec === "react/jsx-runtime") return jsxRuntime;
		if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
		if (spec === "@deepseek-ai/dsh-client-runtime/client") return clientRuntime;
		throw new Error(`unexpected require: ${spec}`);
	};
	new Function("window", "require", readFileSync(path, "utf8"))(win, requireShim);
	return handoff.factory(requireShim);
}

const typertMod = evaluateBundle(`${app}/dsh-typert-registry/lib/client.js`);
const gatewayMod = evaluateBundle(`${app}/dsh-api-gateway/lib/client.js`);
const marketMod = evaluateBundle(fileURLToPath(new URL("../lib/client.js", import.meta.url)));

const ctx = new cordis.Context();
const requests = [];
// Fake connection: capture every RPC, answer with a canned host result.
ctx.provide("connection", {
	rpc: {
		async call(path, endpoint, payload) {
			requests.push({ path, endpoint, payload });
			const canned = {
				"pluginMarketHub/setEnabled": { ok: true, entryId: "plugin-market-hub", enabled: false, path: "C:/h/cordis.patch.yml", message: "toggled", restartNeeded: true, restartSupported: false },
				"pluginMarketHub/installPlugin": { ok: true, packageName: "a/b", message: "installed", restartNeeded: true, command: "" },
				"pluginMarketHub/listPublished": { entries: [], fetchedAt: "2026-01-01T00:00:00Z", source: "test" },
				"pluginMarketHub/restartApp": { ok: true, restartSupported: false, message: "unsupported here" },
				"pluginMarketHub/cancelEnabled": { ok: true, entryId: "plugin-market-hub", message: "cancelled", restartNeeded: false }
			}[endpoint];
			if (canned === void 0) return { ok: false, error: { code: "internal", message: `no canned ${endpoint}`, details: {} } };
			return { ok: true, value: canned };
		}
	}
});
ctx.provide("slots", { inject() {}, register() { return { options: {}, component: null }; } });
ctx.provide("locale", { register() {}, bind: () => () => "x" });

let failures = 0;
const check = (label, ok, detail = "") => {
	if (ok) console.log(`  ok  ${label}`);
	else { failures += 1; console.error(`FAIL ${label} ${detail}`); }
};

typertMod.apply(ctx);
gatewayMod.apply(ctx);
await marketMod.apply(ctx);

const ns = ctx.remote?.pluginMarketHub;
check("namespace resolves", ns !== void 0);
check("setEnabled is callable", typeof ns?.setEnabled === "function");

// 1. the toggle call
const toggleResult = await ns.setEnabled("plugin-market-hub", false);
check("setEnabled returns the host result", toggleResult.ok === true && toggleResult.value.enabled === false, JSON.stringify(toggleResult));
const toggleReq = requests.find((r) => r.endpoint === "pluginMarketHub/setEnabled");
check("setEnabled RPC was issued", toggleReq !== void 0);
check("setEnabled payload args", toggleReq?.payload?.args?.entryId === "plugin-market-hub" && toggleReq?.payload?.args?.enabled === false, JSON.stringify(toggleReq?.payload?.args));
check("setEnabled route", toggleReq?.path === "/api");

// 2. installPlugin for comparison (known to work in the app)
await ns.installPlugin("a/b", {});
const installReq = requests.find((r) => r.endpoint === "pluginMarketHub/installPlugin");
check("installPlugin RPC was issued", installReq !== void 0 && installReq.payload.args.spec === "a/b" && installReq.payload.args.options !== void 0);

// 3. restartApp (no params)
const restartResult = await ns.restartApp();
check("restartApp returns the host result", restartResult.ok === true && restartResult.value.restartSupported === false);
const restartReq = requests.find((r) => r.endpoint === "pluginMarketHub/restartApp");
check("restartApp RPC was issued with empty args", restartReq !== void 0 && JSON.stringify(restartReq.payload.args) === "{}");

// 4. cancelEnabled
await ns.cancelEnabled("plugin-market-hub");
const cancelReq = requests.find((r) => r.endpoint === "pluginMarketHub/cancelEnabled");
check("cancelEnabled RPC args", cancelReq?.payload?.args?.entryId === "plugin-market-hub");

console.log(failures === 0 ? "\nCLIENT RPC: ALL CHECKS PASSED" : `\nCLIENT RPC: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
