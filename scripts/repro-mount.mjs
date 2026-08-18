// Repro: run the REAL client-side Remote mount path (dsh-typert-registry +
// dsh-api-gateway + this plugin's client bundle) on a REAL cordis Context in
// Node, to surface why ctx.remote.pluginMarket may be unavailable in the app.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as cordis from "@deepseek-ai/cordis";
import * as react from "react";
import * as jsxRuntime from "react/jsx-runtime";

const app = "D:/Deepseek Harness/DSH Desktop/resources/app.asar.unpacked/node_modules/@deepseek-ai";

const fakeDocument = {
	querySelector: () => null,
	createElement: () => ({ dataset: {}, textContent: "", appendChild() {} }),
	head: { appendChild() {} }
};
const primitives = new Proxy({}, { get: (_t, p) => (typeof p === "string" ? () => null : void 0) });

function evaluateBundle(path) {
	let handoff = null;
	const win = { __ModuleLoader__: { load: (h) => { handoff = h; } }, document: fakeDocument };
	const requireShim = (spec) => {
		if (spec === "@deepseek-ai/cordis") return cordis;
		if (spec === "react") return react;
		if (spec === "react/jsx-runtime") return jsxRuntime;
		if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
		throw new Error(`unexpected require: ${spec}`);
	};
	new Function("window", "require", readFileSync(path, "utf8"))(win, requireShim);
	if (handoff === null) throw new Error(`no registration from ${path}`);
	return handoff.factory(requireShim);
}

const typertMod = evaluateBundle(`${app}/dsh-typert-registry/lib/client.js`);
const gatewayMod = evaluateBundle(`${app}/dsh-api-gateway/lib/client.js`);
const marketMod = evaluateBundle(fileURLToPath(new URL("../lib/client.js", import.meta.url)));

const ctx = new cordis.Context();
// stub the two services this plugin's apply() touches outside the Remote path
const localeBundles = {};
ctx.provide("slots", {
	inject(name, callback) { /* captured below if needed */ },
	register() { return { options: {}, component: null }; }
});
ctx.provide("locale", {
	register(ns, bundles) { localeBundles[ns] = bundles; },
	bind: () => (key) => "x"
});

let failures = 0;
const check = (label, ok, detail = "") => {
	if (ok) console.log(`  ok  ${label}`);
	else { failures += 1; console.error(`FAIL ${label} ${detail}`); }
};

console.log("mounting dsh-typert-registry client...");
typertMod.apply(ctx);
console.log("mounting dsh-api-gateway client...");
gatewayMod.apply(ctx);
console.log("running Kidai Plugin Market (kidai-plugin-market) client apply()...");
try {
	await marketMod.apply(ctx);
	check("apply() settled without throwing", true);
} catch (error) {
	check("apply() settled without throwing", false, `THREW: ${error?.stack ?? error}`);
	process.exit(failures === 0 ? 0 : 1);
}

// After a successful mount the namespace service must resolve via ctx.
const direct = ctx.get("remote.pluginMarket");
check("ctx.get('remote.pluginMarket') resolves", direct !== void 0);
const viaDot = ctx.remote?.pluginMarket;
check("ctx.remote.pluginMarket resolves", viaDot !== void 0);
const listFn = typeof viaDot?.listPublished === "function";
const installedFn = typeof viaDot?.installed === "function";
const installFn = typeof viaDot?.installPlugin === "function";
const bareInstallIsInternal = typeof viaDot?.install === "function" && !Object.hasOwn(viaDot, "install");
check("namespace exposes listPublished/installed/installPlugin", listFn && installedFn && installFn, `got ${Object.keys(viaDot ?? {}).join(",")}`);
check("bare 'install' is only the internal prototype method, not a Remote", bareInstallIsInternal);

// And a full call round-trips through the gateway's RPC layer is NOT possible
// here (no connection), but at least the mount + resolution must work.
console.log(failures === 0 ? "\nMOUNT REPRO: ALL CHECKS PASSED" : `\nMOUNT REPRO: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
