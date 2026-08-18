// Full host-boot reproduction for the desktop profile: calls the app's own
// boot() (Loader mount + root include + activation audit) against the REAL
// profile so any plugin activation failure surfaces with its cause chain —
// the exact failure that makes DSH refuse to open.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as appBoot from "@deepseek-ai/dsh-app-boot";

const home = (process.env.DSH_HOME && process.env.DSH_HOME.trim().length > 0 ? process.env.DSH_HOME : join(process.env.USERPROFILE ?? process.env.HOME ?? ".", ".dsh")).replaceAll("\\", "/");
const profileName = "desktop";
const profileDir = join(home, "profiles", profileName);
const installAnchor = "D:/Deepseek Harness/DSH Desktop/resources/app.asar.unpacked/package.json";
// The root include's config is the profile's own patch list (top-level array).
const configPath = join(profileDir, "cordis.patch.yml");

console.log(`booting ${profileDir} ...`);
const manifest = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"));
const bundleNames = manifest.dsh?.profile?.bundles ?? [];
const patches = [];
for (const bundle of bundleNames) {
	let patchRel = null;
	try {
		const bundleDir = appBoot.resolveBundleDir("test", bundle, installAnchor, profileDir);
		patchRel = JSON.parse(readFileSync(join(bundleDir, "package.json"), "utf8")).dsh?.bundle?.patch;
		if (patchRel !== void 0) patches.push(...(appBoot.loadOptionalPatches("test", join(bundleDir, patchRel)) ?? []));
	} catch (error) {
		console.log(`  (bundle ${bundle}: ${error.message})`);
	}
}
const homePatch = join(home, "cordis.patch.yml");
if (existsSync(homePatch)) patches.push(...(appBoot.loadOptionalPatches("test", homePatch) ?? []));

try {
	const ctx = await appBoot.boot("test", configPath, patches, void 0, pathToFileURL(profileDir).href + "/");
	const loader = ctx.get("loader");
	const entries = loader?.entries() ?? [];
	console.log("boot OK — activated entries:");
	for (const entry of entries) console.log(`  - ${entry.id} (${entry.options?.name ?? "?"})${entry.disabled ? " [disabled]" : ""}`);
	await ctx.fiber.dispose();
	console.log("\nFULL BOOT REPRO: PASSED");
	process.exit(0);
} catch (error) {
	console.error("\nBOOT FAILED:");
	const seen = new Set();
	const visit = (err, depth) => {
		if (depth > 10 || err === void 0 || seen.has(err)) return;
		seen.add(err);
		console.error(`  [${depth}] ${err.message ?? String(err)}`);
		if (err.stack !== void 0) console.error(err.stack.split("\n").slice(0, 3).join("\n"));
		if (Array.isArray(err.errors)) for (const sub of err.errors) visit(sub, depth + 1);
		else visit(err.cause, depth + 1);
	};
	visit(error, 0);
	process.exit(1);
}
