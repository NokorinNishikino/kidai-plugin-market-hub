// Host-side dispatch repro for the HUB gateway: real cordis Context +
// TypertRegistry + TypertGatewayService + the hub's PluginMarketGateway.
// Verifies the gateway claims every pluginMarketHub/* endpoint (the client
// mount depends on the host exposing them).
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import * as cordis from "@deepseek-ai/cordis";
import { TypertRegistry } from "@deepseek-ai/dsh-typert-registry";
import { TypertGatewayService } from "@deepseek-ai/dsh-api-gateway";
import { PluginMarketGateway } from "../lib/index.js";

let failures = 0;
const check = (label, ok, detail = "") => {
	if (ok) console.log(`  ok  ${label}`);
	else { failures += 1; console.error(`FAIL ${label} ${detail}`); }
};

const profileDir = mkdtempSync(join(tmpdir(), "kpmh-dispatch-"));
const savedHome = process.env.DSH_HOME;
process.env.DSH_HOME = profileDir;
const ctx = new cordis.Context();
ctx.baseUrl = pathToFileURL(profileDir).href + "/";
writeFileSync(join(profileDir, "package.json"), JSON.stringify({ name: "repro", dependencies: { "kidai-plugin-market-hub": "0.1.0" }, dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "kidai-plugin-market-hub"] } } }));

new TypertRegistry(ctx);
new TypertGatewayService(ctx);
new PluginMarketGateway(ctx);

const gateway = ctx.typertGateway;
const methods = ["installed", "listPublished", "installPlugin", "setEnabled", "openLocal", "restartApp", "cancelEnabled", "checkUpdates", "updatePlugin", "fetchReadme", "auditPackage"];
for (const method of methods) {
	check(`claims pluginMarketHub/${method}`, gateway.claimsEndpoint(`pluginMarketHub/${method}`) === true);
}
check("does not claim unknown endpoint", gateway.claimsEndpoint("pluginMarketHub/nope") === false);

const installed = await gateway.invoke({ namespace: "pluginMarketHub", method: "installed", args: {} });
check("installed() via hub gateway", Array.isArray(installed.dependencies) && typeof installed.restartSupported === "boolean", JSON.stringify(installed).slice(0, 140));

process.env.DSH_HOME = savedHome;
rmSync(profileDir, { recursive: true, force: true });
console.log(failures === 0 ? "\nHUB DISPATCH: ALL CHECKS PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
