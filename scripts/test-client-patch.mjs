// Test patchKeyedSlotRegistrations against synthetic + real client bundles.
import { readFileSync } from "node:fs";

const { patchKeyedSlotRegistrations, resolveClientBundlePath } = await import("../lib/index.js");

let failures = 0;
const check = (label, cond, detail = "") => {
	if (cond) console.log("  ok  " + label);
	else { failures++; console.log("FAIL  " + label + " " + detail); }
};

// 1) Pretty-printed register block (rc.6 style, no key)
{
	const src = `ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				id: "ai-novel-writer",
				order: 90,
				inject: workbenchInjected
			}, NovelPluginStatusCard));`;
	const out = patchKeyedSlotRegistrations(src);
	check("pretty block patched", out.patched === true);
	check("pretty block got key", out.source.includes('key: "ai-novel-writer"'), out.source);
	check("pretty block keeps id", out.source.includes('id: "ai-novel-writer"'));
	const orderOk = out.source.indexOf('name: "settings.plugin.item"') < out.source.indexOf('key: "ai-novel-writer"') && out.source.indexOf('key: "ai-novel-writer"') < out.source.indexOf('id: "ai-novel-writer"');
	check("pretty block valid", out.source.includes('name: "settings.plugin.item"') && out.source.includes('key: "ai-novel-writer"') && out.source.includes('id: "ai-novel-writer"') && orderOk, out.source);}

// 2) Minified one-line register block
{
	const src = `ctx.slots.inject("settings.plugin.item",()=>ctx.slots.register({name:"settings.plugin.item",id:"ai-novel-writer",order:90,inject:workbenchInjected},NovelPluginStatusCard));`;
	const out = patchKeyedSlotRegistrations(src);
	check("minified block patched", out.patched === true);
	check("minified block got key", /key:\s*"ai-novel-writer"/.test(out.source), out.source);
}

// 3) Already-patched block is untouched (idempotent)
{
	const src = `ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				id: "ai-novel-writer",
				key: "ai-novel-writer",
				order: 90,
				inject: workbenchInjected
			}, NovelPluginStatusCard));`;
	const out = patchKeyedSlotRegistrations(src);
	check("already-keyed block untouched", out.patched === false, JSON.stringify(out).slice(0, 120));
}

// 4) Non-keyed slots (list) are not touched
{
	const src = `ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "ai-novel-workbench",
				order: 90,
				label: "小说工作台",
				inject: workbenchInjected
			}, NovelWorkbenchTrigger));`;
	const out = patchKeyedSlotRegistrations(src);
	check("list slot untouched", out.patched === false, out.source);
}

// 4b) rc.8 keyed slots beyond settings.plugin.item get patched too:
// conversation.chat.node / conversation.chat.commandview / tool.view.cordis.
{
	const src = `ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				id: "legacy-node",
				order: 0
			}, LegacyNodeView));`;
	const out = patchKeyedSlotRegistrations(src);
	check("conversation.chat.node patched (rc.8 keyed slot)", out.patched === true);
	check("conversation.chat.node got key", out.source.includes('key: "legacy-node"'), out.source);

	const src2 = `ctx.slots.inject("tool.view.cordis", () => ctx.slots.register({name:"tool.view.cordis",id:"cordis-run",order:0},CordisRun));`;
	const out2 = patchKeyedSlotRegistrations(src2);
	check("tool.view.cordis patched (rc.8 keyed slot)", out2.patched === true);
	check("tool.view.cordis got key", /key:\s*"cordis-run"/.test(out2.source), out2.source);
}

// 5) Real AI-Novel-Writer client (workspace copy — currently has manual key)
{
	const real = readFileSync("D:/Deepseek Harness Desktop Workshop/ethanyoq-dsh-ai-novel-writer/lib/client.js", "utf8");
	const out = patchKeyedSlotRegistrations(real);
	// Since the workspace copy already has the manual key, it should be idempotent.
	check("real client idempotent (already keyed)", out.patched === false, "patched=" + out.patched);
	check("real client register intact", out.source.includes('name: "settings.plugin.item"'));
}

// 6) resolveClientBundlePath finds lib/client.js
{
	const p = resolveClientBundlePath("C:/Users/13971/.dsh/profiles/desktop/node_modules/@ethanyoq/dsh-ai-novel-writer");
	check("resolves client bundle path", p !== null && /client\.js$/.test(p.replace(/\\/g, "/")), String(p));
}

console.log(failures === 0 ? "\nPATCH CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
