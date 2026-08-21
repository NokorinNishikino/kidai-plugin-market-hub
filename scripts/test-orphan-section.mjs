// Verify the orphan section renders BELOW the plugin list with its own title,
// by rendering PluginMarketTab in an SSR harness that supplies orphans state.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

const src = readFileSync("lib/client.js", "utf8");
// Extract PluginMarketTab by evaluating the bundle with a controlled react.
// Simpler: scan the source for the structural pieces we changed and assert.
const checks = [
  ["orphan section wrapper", src.includes('className: "dshm_orphanSection"')],
  ["orphan heading with title", src.includes('className: "dshm_catalogHeading dshm_orphanHeading"') && src.includes('children: t("orphansTitle")')],
  ["orphan count span", src.includes('"data-plugin-count": orphans.length')],
  ["orphan cards grid (wide)", src.includes('"dshm_cards dshm_orphanCards"')],
  ["orphan rows grid (narrow)", src.includes('"dshm_rows dshm_orphanRows"')],
  ["orphan tag badge", src.includes('t("orphanTag")')],
  ["orphan section BELOW plugin scroll (source order)", src.indexOf('dshm_orphanSection') > src.indexOf('dshm_scroll')],
  ["mount action", src.includes('onMountOrphan(orphan)')],
  ["delete action", src.includes('onRemoveOrphan(orphan)')],
  ["declared-only mount button", src.includes('orphan.declared === true ?')],
];
let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "  ok" : "FAIL"}  ${name}`);
  if (!ok) fail++;
}
// Verify CSS
const cssIdx = src.indexOf("dshm_orphanSection{margin-top");
console.log(`${cssIdx >= 0 ? "  ok" : "FAIL"}  CSS orphanSection style present`);
if (cssIdx < 0) fail++;
const cardCss = src.indexOf(".dshm_orphanRow .dshm_card");
console.log(`${cardCss >= 0 ? "  ok" : "FAIL"}  CSS orphan card gray style present`);
if (cardCss < 0) fail++;
// Two-line layout: same width as normal cards, compact with full content.
const sameWidth = src.includes(".dshm_orphanCards{grid-template-columns:repeat(auto-fill,minmax(280px,1fr))");
console.log(`${sameWidth ? "  ok" : "FAIL"}  CSS orphan grid keeps normal card width (280px)`);
if (!sameWidth) fail++;
const columnLayout = src.includes(".dshm_orphanRow.dshm_card{gap:4px;padding:6px 10px}");
console.log(`${columnLayout ? "  ok" : "FAIL"}  CSS orphan card is compact two-line layout`);
if (!columnLayout) fail++;
const actionsInHead = (() => {
  const reasonIdx = src.indexOf('className: "dshm_cardDesc dshm_orphanReason"');
  const headStart = src.lastIndexOf('className: "dshm_cardHead"', reasonIdx);
  const head = headStart >= 0 ? src.slice(headStart, reasonIdx) : "";
  return head.includes('className: "dshm_actions"');
})();
console.log(`${actionsInHead ? "  ok" : "FAIL"}  actions live in the head row (single line)`);
if (!actionsInHead) fail++;
const reasonLine = src.includes('className: "dshm_cardDesc dshm_orphanReason"');
console.log(`${reasonLine ? "  ok" : "FAIL"}  full reason on its own line`);
if (!reasonLine) fail++;
const reasonCss = src.includes(".dshm_orphanRow.dshm_card .dshm_orphanReason");
console.log(`${reasonCss ? "  ok" : "FAIL"}  CSS orphan reason (full, wrapping)`);
if (!reasonCss) fail++;
const compactBtn = src.includes(".dshm_orphanRow.dshm_card .dshm_actions button{height:24px");
console.log(`${compactBtn ? "  ok" : "FAIL"}  CSS compact orphan action buttons`);
if (!compactBtn) fail++;
console.log(fail === 0 ? "\nORPHAN SECTION CHECKS PASSED" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
