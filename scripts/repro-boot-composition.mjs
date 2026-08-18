// Autonomous end-to-end test of the disable mechanism using the REAL profile:
// writes `- id: novelweb\n  disabled: true` into $DSH_HOME/cordis.patch.yml,
// rebuilds the desktop's composition stack with the app's own code
// (loadOptionalPatches + composeEntries over every bundle layer + the home
// layer), asserts the novelweb row ends up disabled with its name preserved,
// then restores the home patch file.
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import * as appBoot from "@deepseek-ai/dsh-app-boot";

const home = (process.env.DSH_HOME && process.env.DSH_HOME.trim().length > 0 ? process.env.DSH_HOME : join(homedir(), ".dsh")).replaceAll("\\", "/");
const profileName = "desktop";
const profileDir = join(home, "profiles", profileName);
const installAnchor = "D:/Deepseek Harness/DSH Desktop/resources/app.asar.unpacked/package.json";
const patchPath = join(home, "cordis.patch.yml");

let failures = 0;
const check = (label, ok, detail = "") => {
	if (ok) console.log(`  ok  ${label}`);
	else { failures += 1; console.error(`FAIL ${label} ${detail}`); }
};

// 1. stage the disable override (novelweb's loader row id)
const existed = existsSync(patchPath);
const original = existed ? readFileSync(patchPath, "utf8") : null;
writeFileSync(patchPath, "- id: novelweb\n  disabled: true\n");

try {
	// 2. rebuild the composition exactly like the desktop launcher:
	//    bundle layers (in manifest order) + home-level user patch layer
	const manifest = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"));
	const bundleNames = manifest.dsh?.profile?.bundles ?? [];
	const bundlePatches = [];
	for (const bundle of bundleNames) {
		let patchRel = null;
		try {
			const bundleDir = appBoot.resolveBundleDir("test", bundle, installAnchor, profileDir);
			patchRel = JSON.parse(readFileSync(join(bundleDir, "package.json"), "utf8")).dsh?.bundle?.patch;
			if (patchRel !== void 0) bundlePatches.push(...(appBoot.loadOptionalPatches("test", join(bundleDir, patchRel)) ?? []));
		} catch (error) {
			console.log(`  (skipped bundle ${bundle}: ${error.message})`);
		}
	}
	const homePatches = appBoot.loadOptionalPatches("test", patchPath) ?? [];
	const patches = [...bundlePatches, ...homePatches];
	const rows = appBoot.composeEntries([patches]);
	const novelweb = rows.find((row) => row.id === "novelweb");
	check("composed rows include novelweb", novelweb !== void 0);
	check("novelweb row disabled by home patch", novelweb?.disabled === true, JSON.stringify(novelweb));
	check("novelweb name preserved", novelweb?.name === "dsh-novelweb", JSON.stringify(novelweb));
	check("other rows untouched", rows.find((row) => row.id === "plugin-market")?.name === "kidai-plugin-market");

	// 3. a row without the override stays enabled
	check("plugin-market stays enabled", rows.find((row) => row.id === "plugin-market")?.disabled !== true);
} finally {
	if (existed) writeFileSync(patchPath, original);
	else rmSync(patchPath, { force: true });
}

console.log(failures === 0 ? "\nBOOT COMPOSITION TEST: ALL CHECKS PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
