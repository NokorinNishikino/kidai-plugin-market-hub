// Live end-to-end: install EthanYoQ/AI-Novel-Writer#dsh-ai-novel-writer into a
// throwaway profile through the REAL gateway + REAL bundled pnpm + REAL mirror
// download (gh-proxy.com tarball → extract → vendor copy → pnpm add file:).
// Writes its own log file (D:/Deepseek Harness Desktop Workshop/live-sub-log.txt).
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOG = "D:/Deepseek Harness Desktop Workshop/live-sub-log.txt";
writeFileSync(LOG, "");
const log = (line) => { appendFileSync(LOG, line + "\n"); console.log(line); };

const { PluginMarketGateway } = await import("../lib/index.js");

const dir = mkdtempSync(join(tmpdir(), "kpmh-live-sub-"));
const profileDir = join(dir, "profiles", "live");
mkdirSync(profileDir, { recursive: true });
writeFileSync(join(profileDir, "package.json"), JSON.stringify({ name: "dsh-profile-live", private: true, dsh: { profile: { bundles: ["@deepseek-ai/dsh-base"] } } }, null, 2));

const ctx = {
	reflect: { provide: () => {}, props: {} },
	baseUrl: "file:///" + profileDir.replace(/\\/g, "/") + "/",
	get: () => void 0,
	logger: { warn: (m) => log("[warn] " + m), info() {}, debug() {} },
	loader: { entries: () => [{ id: "storage" }, { id: "workspace" }] }
};
const gateway = new PluginMarketGateway(ctx);

const origPrepare = gateway.prepareGitSubpackage.bind(gateway);
gateway.prepareGitSubpackage = async (resolved, pdir) => {
	log("[step] downloading repo tarball via mirror chain…");
	const t0 = Date.now();
	const out = await origPrepare(resolved, pdir);
	log("[step] prepare done in " + ((Date.now() - t0) / 1000).toFixed(1) + "s ok=" + out.ok);
	return out;
};

log("[step] installPlugin start");
const t0 = Date.now();
const result = await gateway.installPlugin("EthanYoQ/AI-Novel-Writer#dsh-ai-novel-writer", { allowRisky: true });
log("[step] installPlugin returned after " + ((Date.now() - t0) / 1000).toFixed(1) + "s");
log("=== RESULT ===");
log(JSON.stringify(result, null, 2));

const m = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"));
log("=== MANIFEST deps ===");
log(JSON.stringify(m.dependencies, null, 2));
log("=== MANIFEST bundles ===");
log(JSON.stringify(m.dsh.profile.bundles, null, 2));
log("vendor dir exists: " + existsSync(join(profileDir, ".kidai-vendor")));

rmSync(dir, { recursive: true, force: true });
log("cleanup done; ok=" + result.ok);
process.exit(result.ok ? 0 : 1);
