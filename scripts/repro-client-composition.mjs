// Reproduce the client-modules composition checks the desktop runs at boot:
// for every bundle in the profile manifest, resolve its package.json from the
// profile, validate the dsh.client declaration, resolve every inject edge via
// createRequire, and confirm exports["./client"] is a valid client path. Any
// failure here is what makes ClientModuleRegistry construction throw and the
// app refuse to boot.
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const profileDir = "C:/Users/13971/.dsh/profiles/desktop";
const require = createRequire(pathToFileURL(join(profileDir, "package.json")).href);

let failures = 0;
const check = (label, ok, detail = "") => {
	if (ok) console.log(`  ok  ${label}`);
	else { failures += 1; console.error(`FAIL ${label} ${detail}`); }
};

const manifest = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"));
const bundles = manifest.dsh?.profile?.bundles ?? [];
for (const name of bundles) {
	let pkgPath = null;
	try { pkgPath = require.resolve(`${name}/package.json`); }
	catch (error) { check(`bundle ${name} resolves`, false, error.message); continue; }
	let pkg = null;
	try { pkg = JSON.parse(readFileSync(pkgPath, "utf8")); }
	catch (error) { check(`bundle ${name} parses`, false, error.message); continue; }
	const decl = pkg.dsh?.client;
	if (decl === void 0) { check(`bundle ${name} (no dsh.client)`, true); continue; }
	check(`bundle ${name} platform web`, decl.platform === "web", String(decl.platform));
	check(`bundle ${name} exports ./client`, typeof pkg.exports?.["./client"]?.default === "string", JSON.stringify(pkg.exports?.["./client"]));
	const clientPath = join(join(pkgPath, ".."), pkg.exports?.["./client"]?.default ?? "");
	check(`bundle ${name} client file exists`, existsSync(clientPath), clientPath);
	for (const edge of decl.inject ?? []) {
		try {
			const resolved = require.resolve(`${edge}/package.json`);
			const edgePkg = JSON.parse(readFileSync(resolved, "utf8"));
			check(`inject edge ${name} -> ${edge} (client present)`, typeof edgePkg.exports?.["./client"]?.default === "string" || typeof edgePkg.exports?.["./client"] === "string", `${edge} exports ./client`);
		} catch (error) {
			check(`inject edge ${name} -> ${edge} resolves`, false, error.message);
		}
	}
}

console.log(failures === 0 ? "\nCLIENT COMPOSITION CHECKS PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
