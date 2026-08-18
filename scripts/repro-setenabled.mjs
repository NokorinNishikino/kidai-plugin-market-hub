// Isolate-test the host setEnabled write against the home-level patch.
// Covers both home resolution paths: DSH_HOME set (writes a throwaway temp
// home, never the real one) and DSH_HOME unset (falls back to ~/.dsh,
// resolution only).
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as cordis from "@deepseek-ai/cordis";
import { PluginMarketGateway } from "../lib/index.js";

let failures = 0;
const check = (label, ok, detail = "") => {
	if (ok) console.log(`  ok  ${label}`);
	else { failures += 1; console.error(`FAIL ${label} ${detail}`); }
};

// --- A: DSH_HOME set — write to a THROWAWAY temp home, not the real one ---
const savedHome = process.env.DSH_HOME;
const testHome = mkdtempSync(join(tmpdir(), "dshm-home-"));
process.env.DSH_HOME = testHome;
const ctxA = new cordis.Context();
ctxA.baseUrl = pathToFileURL(join(testHome, "profiles", "desktop") + "/").href + "/";
const gatewayA = new PluginMarketGateway(ctxA);
try {
	const result = await gatewayA.setEnabled("plugin-market", false);
	check("setEnabled(false) ok (DSH_HOME set)", result.ok === true, JSON.stringify(result));
	const patchPath = join(testHome, "cordis.patch.yml");
	check("writes to $DSH_HOME/cordis.patch.yml", result.path === patchPath, result.path);
	const after = readFileSync(patchPath, "utf8");
	check("patch file contains the override", after.includes("plugin-market") && after.includes("disabled: true"), after.slice(0, 200));
	const re = await gatewayA.setEnabled("plugin-market", true);
	check("re-enable writes disabled: false", re.ok === true);
	const after2 = readFileSync(patchPath, "utf8");
	check("re-enable persisted", after2.includes("disabled: false"));
} finally {
	process.env.DSH_HOME = savedHome;
	rmSync(testHome, { recursive: true, force: true });
}

// --- B: DSH_HOME unset — homeDir must fall back to ~/.dsh (resolution only) ---
delete process.env.DSH_HOME;
const ctxB = new cordis.Context();
ctxB.baseUrl = pathToFileURL(join(tmpdir(), "dshm-nohome") + "/").href + "/";
const gatewayB = new PluginMarketGateway(ctxB);
check("homeDir falls back to ~/.dsh", gatewayB.homeDir() === join(homedir(), ".dsh"), gatewayB.homeDir());

console.log(failures === 0 ? "\nHOME PATCH ISOLATION: ALL CHECKS PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
