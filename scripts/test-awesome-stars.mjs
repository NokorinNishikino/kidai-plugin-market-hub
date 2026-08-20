// Unit test for the host-side awesome-star enrichment: the curated
// awesome-dsh-plugin entries that match a repo already fetched from GitHub/npm
// must keep the richer source data (stars, updatedAt, icon, url) and be stamped
// with their awesome category + tier, so the awesome tab can sort by real star
// counts. GitHub/npm/README fetches are stubbed; nothing hits the network.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { PluginMarketGateway } = await import("../lib/index.js");

let failures = 0;
function check(label, condition, detail = "") {
	if (condition) console.log(`  ok  ${label}`);
	else { failures += 1; console.error(`FAIL  ${label} ${detail}`); }
}

const githubRepo = {
	id: 1,
	full_name: "owner/dsh-plugin-foo",
	name: "dsh-plugin-foo",
	owner: { login: "owner", avatar_url: "https://avatars.example/o.png" },
	description: "github description for foo",
	html_url: "https://github.com/owner/dsh-plugin-foo",
	homepage: "",
	topics: ["dsh-plugin", "memory"],
	stargazers_count: 500,
	updated_at: "2026-05-01T00:00:00Z"
};

const awesomeReadme = [
	"## 插件目录",
	"",
	"### Memory",
	"",
	"- [owner/dsh-plugin-foo](https://github.com/owner/dsh-plugin-foo) - curated foo",
	"- [awesomeowner/dsh-plugin-bar](https://github.com/awesomeowner/dsh-plugin-bar) - curated bar",
	"",
	"### Just for Fun",
	"",
	"- [fun/dsh-plugin-game](https://github.com/fun/dsh-plugin-game) - a game"
].join("\n");

// --- stub every network read ---
globalThis.fetch = async (url) => {
	const u = String(url);
	const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
	if (u.includes("/search/repositories")) {
		const page = /[?&]page=(\d+)/.exec(u);
		if (u.includes("in%3Aname")) return json({ items: [] });
		if (page !== null && Number(page[1]) > 1) return json({ items: [] });
		return json({ items: [githubRepo] });
	}
	if (u.includes("-/v1/search")) {
		return json({ objects: [{ package: { name: "dsh-plugin-npmx", description: "npm desc", links: { repository: "https://github.com/npmowner/dsh-plugin-npmx" }, date: "2026-03-01T00:00:00Z" } }] });
	}
	if (u.includes("awesome-dsh-plugin") && u.includes("README.md")) {
		return new Response(awesomeReadme, { status: 200, headers: { "content-type": "text/plain" } });
	}
	return new Response("not found", { status: 404 });
};

const dir = mkdtempSync(join(tmpdir(), "kpmh-stars-test-"));
const ctx = {
	reflect: { provide: () => {}, props: {} },
	baseUrl: `file:///${dir.replace(/\\/g, "/")}/`,
	get: () => void 0,
	logger: { warn() {}, info() {}, debug() {} }
};
const gateway = new PluginMarketGateway(ctx);
check("gateway constructs", gateway !== null);

const view = await gateway.fetchMergedCatalog("stars");
check("catalog has entries", view.entries.length >= 4, String(view.entries.length));

const foo = view.entries.find((entry) => entry.name === "dsh-plugin-foo");
check("foo carries the GitHub star count", foo !== void 0 && foo.stars === 500, JSON.stringify(foo));
check("foo stamped AWESOME + category", foo.sourceTier === "AWESOME" && foo.category === "Memory", JSON.stringify(foo));
check("foo verified (curated list)", foo.verified === true);
check("no duplicate foo entry", view.entries.filter((entry) => entry.name === "dsh-plugin-foo").length === 1);

const bar = view.entries.find((entry) => entry.name === "dsh-plugin-bar");
check("bar (awesome-only) keeps category + tier, stars 0", bar !== void 0 && bar.sourceTier === "AWESOME" && bar.category === "Memory" && bar.stars === 0, JSON.stringify(bar));

const game = view.entries.find((entry) => entry.name === "dsh-plugin-game");
check("game category preserved", game !== void 0 && game.category === "Just for Fun", JSON.stringify(game));

const npmx = view.entries.find((entry) => entry.name === "dsh-plugin-npmx");
check("npm entry untouched", npmx !== void 0 && npmx.sourceTier === "NPM" && npmx.kind === "npm" && npmx.verified === true, JSON.stringify(npmx));

check("categories keep README order", JSON.stringify(view.categories) === JSON.stringify(["Memory", "Just for Fun"]), JSON.stringify(view.categories));

// The same enrichment must hold for the "updated" sort feed.
const viewUpdated = await gateway.fetchMergedCatalog("updated");
const fooUpdated = viewUpdated.entries.find((entry) => entry.name === "dsh-plugin-foo");
check("updated feed also enriched", fooUpdated !== void 0 && fooUpdated.stars === 500 && fooUpdated.sourceTier === "AWESOME" && fooUpdated.category === "Memory", JSON.stringify(fooUpdated));

console.log(failures === 0 ? "\nAWESOME-STARS CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
