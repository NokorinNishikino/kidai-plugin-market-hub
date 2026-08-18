// Final verification of the installed kidai-plugin-market copy.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import yaml from "yaml";

const require = createRequire(import.meta.url);
const root = "C:/Users/13971/.dsh/profiles/desktop/node_modules/kidai-plugin-market";

let failures = 0;
const check = (label, ok, detail = "") => {
	if (ok) console.log(`  ok  ${label}`);
	else { failures += 1; console.error(`FAIL ${label} ${detail}`); }
};

const patchText = readFileSync(`${root}/cordis.patch.yml`, "utf8");
const patch = yaml.parse(patchText);
check("patch is a top-level insert list", Array.isArray(patch) && patch[0]?.insert);
check("patch inserts plugin-market row", patch[0].insert.some((row) => row.id === "plugin-market" && row.name === "kidai-plugin-market"));

const manifest = JSON.parse(readFileSync("C:/Users/13971/.dsh/profiles/desktop/package.json", "utf8"));
check("profile depends on kidai-plugin-market", Object.hasOwn(manifest.dependencies ?? {}, "kidai-plugin-market"));
check("profile bundles include kidai-plugin-market", (manifest.dsh?.profile?.bundles ?? []).includes("kidai-plugin-market"));
check("bundles start with base then web-app", manifest.dsh?.profile?.bundles?.[0] === "@deepseek-ai/dsh-base" && manifest.dsh?.profile?.bundles?.[1] === "@deepseek-ai/dsh-web-app");

const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8"));
check("exports ./client -> lib/client.js", pkg.exports?.["./client"]?.default === "./lib/client.js");
check("dsh.client.platform web", pkg.dsh?.client?.platform === "web");
check("dsh.client.inject has 4 edges", Array.isArray(pkg.dsh?.client?.inject) && pkg.dsh.client.inject.length === 4);
check("dsh.bundle.patch present", pkg.dsh?.bundle?.patch === "./cordis.patch.yml");

const host = readFileSync(`${root}/lib/index.js`, "utf8");
const client = readFileSync(`${root}/lib/client.js`, "utf8");
check("host: ELECTRON_RUN_AS_NODE fix", host.includes("ELECTRON_RUN_AS_NODE"));
check("host: pluginMarket gateway", host.includes('super(ctx, "pluginMarket")'));
check("host: five Remote markers", ["listPublished", "installed", "installPlugin", "setEnabled", "openLocal"].every((m) => host.includes(`Remote("${m}")`)));
check("host: eleven Remote markers total", ["checkUpdates", "updatePlugin", "fetchReadme", "auditPackage"].every((m) => host.includes(`Remote("${m}")`)));
check("host: no bare install Remote marker", !/Remote\("install"\)/.test(host));
check("host: yaml patch writing", host.includes("YAML.stringify") && host.includes("cordis.patch.yml"));
check("host: loader inject for tools+commands", host.includes('static inject = ["loader", "tools", "commands"]'));
check("host: agent tools + slash command", host.includes("kidai_market_search") && host.includes('name: "kidai-market"'));
check("host: real-plugin verification", host.includes("verifyRepoPlugin") && host.includes("dsh.bundle") && host.includes("verified"));
check("host: anti-squat repository check", host.includes("githubRepoOf") && host.includes("squat"));
check("host: rolling backups + restore", host.includes("backupProfileFiles") && host.includes("restoreBackup") && host.includes("pruneBackups") && host.includes(".kidai-backups"));
check("host: fail-closed static audit", host.includes("scanAuditDir") && host.includes("AUDIT_BLOCK_PATTERNS") && host.includes("生命周期脚本"));
check("host: update check/apply", host.includes("checkUpdates") && host.includes("npmRegistryLatest") && host.includes("updatePlugin"));
check("host: readme fetch + mojibake repair", host.includes("fetchReadme") && host.includes("decodeBytesBest") && host.includes("gb18030"));
check("host: rate-limit cooldown", host.includes("GITHUB_COOLDOWN_MS") && host.includes("githubCooldownUntil") && host.includes("isGitHubCooling"));
check("host: source tiers", host.includes("sourceTier") && host.includes('"TOPIC"') && host.includes('"NAME"') && host.includes('"NPM"'));
check("host: GitHub topic URL", host.includes("topic:dsh-plugin"));
check("host: mirror sources", host.includes("ghfast.top") && host.includes("ghproxy.net"));
check("host: npm fallback sources", host.includes("registry.npmmirror.com") && host.includes("registry.npmjs.org/-/v1/search"));
check("host: expanded catalog (name query + multi npm queries + merge)", host.includes("dsh-plugin in:name") && host.includes("deepseek-harness") && host.includes("NPM_SEARCH_SIZE") && host.includes("seen.has(entry.name)"));
check("host: disk cache", host.includes(".plugin-market-cache.json") && host.includes("bySort"));
check("host: per-sort server-side fetch", host.includes("fetchMergedCatalog") && host.includes('sort === "stars" ? "stars" : "updated"') && host.includes("normalizeSort"));
check("host: per-sort in-memory cache map", host.includes("this.catalogCache.get(key)") && host.includes("this.catalogCache.set(key, view)"));
check("host: env override", host.includes("DSH_PLUGIN_MARKET_GITHUB_API"));
check("host: home-level patch write", host.includes("homeDir()") && host.includes("process.env.DSH_HOME") && host.includes('join(homedir(), ".dsh")'));
check("host: launcher-internal rows excluded", host.includes('name === "cordis:include"') && host.includes("dsh-plugin-desktop/"));
check("host: loader prefix strip in setEnabled", host.includes('entryId.split(":").pop()'));
check("host: restartApp + restartSupported", host.includes('Remote("restartApp")') && host.includes("restartSupported()") && host.includes('app.relaunch()'));
check("host: cancelEnabled (no openConfig)", host.includes('Remote("cancelEnabled")') && host.includes("lastOverrides") && !host.includes('Remote("openConfig")'));
check("client: cancel-submit button", client.includes("dshm_submitted") && client.includes("cancelSubmit"));
check("client: settings header action is restart-only (order -10)", client.includes('id: "plugin-market-actions"') && client.includes('order: -10') && !client.includes("dshm_configBtn"));
check("client: restart button", client.includes("dshm_restartBtn") && client.includes("restartConfirm"));
check("client: __ModuleLoader__.load", client.includes("__ModuleLoader__.load"));
check("client: tab id market", client.includes('id: "market"'));
check("client: mount contribution", client.includes("$mount"));
check("client: zh label", client.includes("插件市场"));
check("client: release-page button", client.includes("releasePage"));
check("client: install button", client.includes("install"));
check("client: browser npm fallback", client.includes("registry.npmjs.org/-/v1/search"));
check("client: source line", client.includes("dshm_sourceLine"));
check("client: sort refetches from source", client.includes("{ force: false, sort }") && client.includes("[listPublished, sort, request]"));
check("client: fetchDirectCatalog server sort", client.includes("fetchDirectCatalog(sort)") && client.includes('sort === "stars" ? "stars" : "updated"'));
check("client: sort descriptor param", client.includes('name: "sort"') && client.includes('wire: "sort"'));
check("client: view toggle", client.includes("viewMarket") && client.includes("viewInstalled"));
check("client: status/source filters", client.includes("filterStatus") && client.includes("filterSource"));
check("client: toggle busy/done gating", client.includes("doneId") && client.includes("submitted"));
check("client: toast feedback", client.includes("dshm_toast"));
check("client: readme/audit modals (content + confirm, feedback stays toast)", client.includes("dshm_overlay") && client.includes("dshm_readme") && client.includes("stillInstall") && client.includes("auditBlocked"));
check("client: zh names + keyword expansion", client.includes("ZH_NAMES") && client.includes("expandQueryZh") && client.includes("zhOf"));
check("client: favorites + verified filter", client.includes("favorites") && client.includes("favoritesOnly") && client.includes("onlyVerified") && client.includes("verifyFilter"));
check("client: update UI", client.includes("checkUpdates") && client.includes("runUpdate") && client.includes("updatable"));
check("client: readme details button", client.includes("readmeOpen") && client.includes("openReadme"));
check("client: new descriptors", client.includes('method: "checkUpdates"') && client.includes('method: "fetchReadme"') && client.includes('method: "auditPackage"') && client.includes('method: "updatePlugin"'));
check("client: settings header actions slot", client.includes('id: "plugin-market-actions"') && client.includes('name: "settings.action"') && client.includes("SettingsActions"));
check("client: third-party count badge", client.includes("thirdPartyCount"));
check("client: installed sort/origin/rowView", client.includes("installedSort") && client.includes("originFilter") && client.includes("rowView"));
check("client: wide/narrow rows", client.includes("viewWide") && client.includes("viewNarrow") && client.includes("dshm_rowNarrow"));
check("client: row icon + description", client.includes("RowIcon") && client.includes("dshm_rowDesc"));
check("client: colored action buttons", client.includes("dshm_danger") && client.includes("dshm_primary"));
check("client: setEnabled descriptor", client.includes('method: "setEnabled"'));
check("client: openLocal descriptor", client.includes('method: "openLocal"'));
check("host: installed row metadata", host.includes("installedAtOf") && host.includes("readPackageDescription") && host.includes('origin: name.startsWith("@deepseek-ai/")'));

console.log(failures === 0 ? "\nALL INSTALLED-COPY CHECKS PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
