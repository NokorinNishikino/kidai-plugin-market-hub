// Render-level smoke test for the hub client bundle (lib/client.js).
// Loads the bundle through __ModuleLoader__, runs apply() against a stub ctx,
// captures the shell.overlay registration, then renders the overlay with
// react-dom/server so every hook and memo inside PluginMarketTab executes.
// Two passes: the default loading state, then a forced "ready" + awesome-view
// state so the meta bar, right-aligned source tabs and the collapsible
// category sections actually render.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const bundlePath = fileURLToPath(new URL("../lib/client.js", import.meta.url));
const source = readFileSync(bundlePath, "utf8");

const react = await import("react");
const jsxRuntime = await import("react/jsx-runtime");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) console.log(`  ok  ${label}`);
  else { failures += 1; console.error(`FAIL  ${label} ${detail}`); }
}

const fakeCatalog = {
  entries: [
    { id: "a/b", name: "b", owner: "a", description: "test plugin", iconUrl: "", url: "https://github.com/a/b", homepage: "", topics: ["dsh-plugin"], stars: 3, updatedAt: "2026-02-01T00:00:00Z", kind: "github" },
    { id: "c/d", name: "d", owner: "c", description: "awesome curated", iconUrl: "", url: "https://github.com/c/d", homepage: "", topics: ["awesome-dsh-plugin"], stars: 120, updatedAt: "2026-04-01T00:00:00Z", kind: "github", sourceTier: "AWESOME", category: "Just for Fun", verified: true },
    { id: "g/h", name: "h", owner: "g", description: "awesome tools", iconUrl: "", url: "https://github.com/g/h", homepage: "", topics: ["awesome-dsh-plugin"], stars: 0, updatedAt: "", kind: "github", sourceTier: "AWESOME", category: "UI Enhancements" },
    { id: "e/f", name: "f", owner: "e", description: "npm plugin", iconUrl: "", url: "https://www.npmjs.com/package/f", homepage: "", topics: [], stars: 0, updatedAt: "2026-01-01T00:00:00Z", kind: "npm" }
  ],
  fetchedAt: "2026-02-01T00:00:00Z",
  source: "github+npm+awesome",
  categories: ["Just for Fun", "UI Enhancements"]
};

/** Build a react look-alike whose useState can force specific calls.
* Call order: MarketHubOverlay uses confirmRestart/restarting/toast/toastLeaving
* (#0-3) and progressOps (#4), then PluginMarketTab's state (#5), view (#6),
* auditingId (#19), installingId (#20), readmeModal (#33), auditState (#34)
* (indices 18/19/20 hold the uninstall confirm/uninstalling/orphans states). */
function makeReact(forceReady, forceAwesome, forceInstalled, forceAudit, forceProgress, forceInstalling, forceAuditing, forceReadme) {
  const copy = { ...react };
  let stateCalls = 0;
  copy.useState = function (initial) {
    const i = stateCalls++;
    if (forceReady && i === 5) return [{ status: "ready", catalog: fakeCatalog, error: "" }, () => {}];
    if (forceInstalled && i === 6) return ["installed", () => {}];
    if (forceAwesome && i === 11) return [true, () => {}];
    if (forceAuditing && i === 19) return ["c/d", () => {}];
    if (forceInstalling && i === 20) return ["c/d", () => {}];
    if (forceReadme && i === 33) return [{ entry: { id: "x/y", name: "dsh-plugin-x", owner: "x" }, text: "# Title\n\n| Name | Desc |\n|---|---|\n| a | b |\n\n- [x] done task\n- [ ] open task\n\n![logo](https://example.com/logo.png)\n\n```js\nconst x = 1;\n```", loading: false }, () => {}];
    if (forceAudit && i === 34) return [{ entry: { id: "x/y", name: "dsh-plugin-x", url: "https://github.com/x/y" }, findings: [
      { file: "lib/exec.js", line: 3, severity: "block", kind: "动态执行", evidence: "eval(userInput)" },
      { file: "lib/net.js", line: 1, severity: "warn", kind: "网络请求", evidence: "fetch(\"https://api.example.com\")" }
    ] }, () => {}];
    if (forceProgress && i === 4) return [[
      { id: "op-done", label: "安装成功 dsh-emoji", pct: 100, startedAt: Date.now() - 3000, done: true, ok: true },
      { id: "op-2", label: "正在安装 dsh-plugin-x", pct: 50, startedAt: Date.now() - 5000 },
      { id: "op-3", label: "拉取插件列表", pct: 80, startedAt: Date.now() - 2000 }
    ], () => {}];
    return react.useState(initial);
  };
  return copy;
}

/** Load the bundle with a given react module, run apply(), and return the
* overlay registration entry plus the locale binder. */
async function loadBundle(reactModule) {
  let registered = null;
  const window = {
    __ModuleLoader__: { load(handoff) { registered = handoff; } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      querySelector: () => null,
      createElement: () => ({ dataset: {}, set textContent(v) {}, appendChild() {} }),
      head: { appendChild() {} }
    }
  };
  const primitives = new Proxy({}, {
    get: (_t, prop) => (typeof prop === "string" ? () => createElement("span", null, null) : void 0)
  });
  const runtimeStub = {
    defineStore(decl) {
      return {
        spec: decl,
        create() {
          let snapshot = decl.init();
          const listeners = new Set();
          return {
            actions: Object.fromEntries(Object.entries(decl.actions ?? {}).map(([k, fn]) => [k, (...args) => {
              const next = { ...snapshot };
              fn(next, ...args);
              snapshot = next;
              listeners.forEach((l) => l(snapshot));
            }])),
            getSnapshot: () => snapshot,
            subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
            store: { getState: () => snapshot, setState: (u) => { snapshot = typeof u === "function" ? u(snapshot) : u; listeners.forEach((l) => l(snapshot)); } },
            clearPersisted() {}
          };
        }
      };
    }
  };
  const moduleTable = new Map([
    ["react", reactModule],
    ["react/jsx-runtime", jsxRuntime],
    ["@deepseek-ai/dsh-client-ui-primitives", primitives],
    ["@deepseek-ai/dsh-client-runtime/client", runtimeStub]
  ]);
  const factoryRequire = (spec) => {
    if (!moduleTable.has(spec)) throw new Error(`test require missed: ${spec}`);
    return moduleTable.get(spec);
  };
  new Function("window", "require", source)(window, factoryRequire);
  if (registered === null || registered.id !== "kidai-plugin-market-hub") throw new Error("bundle did not register");
  const exportsOf = registered.factory(factoryRequire);
  const registrations = {};
  const ctx = {
    get: () => void 0,
    effect: (fn) => { const d = fn(); return typeof d === "function" ? d : () => {}; },
    locale: {
      register: (ns, bundles) => { ctx._locales ??= {}; ctx._locales[ns] = bundles; },
      bind: (ns) => (key) => ctx._locales?.[ns]?.zh?.[key] ?? key
    },
    remote: { async $mount(c) { ctx._remote = c; return () => {}; } },
    slots: {
      inject(name, callback) { registrations[name] = callback; },
      register(options, component) { return { options, component }; }
    }
  };
  let applyError = null;
  let disposer = null;
  try {
    disposer = await exportsOf.apply(ctx);
  } catch (error) {
    applyError = error;
  }
  return { registrations, ctx, applyError, disposer };
}

function overlayPropsOf(overlayEntry, t) {
  const inject = overlayEntry.options.inject();
  return {
    useStore: (selector) => selector({ open: true }),
    actions: { open() {}, close() {} },
    t,
    restartApp: async () => ({ ok: false, restartSupported: false, message: "n/a" }),
    installed: async () => ({ dependencies: [], bundles: [], plugins: [], profileDir: "C:/x", restartSupported: false }),
    listPublished: async () => fakeCatalog,
    install: async () => ({ ok: true, packageName: "x", message: "ok", restartNeeded: true, command: "" }),
    setEnabled: async () => ({ ok: true, entryId: "x", enabled: true, message: "ok", restartNeeded: true, restartSupported: false }),
    openLocal: async () => ({ ok: true, packageName: "x", path: "C:/x", message: "ok", restartNeeded: false }),
    cancelEnabled: async () => ({ ok: true, entryId: "x", message: "ok", restartNeeded: false }),
    auditPackage: async () => ({ ok: true, blocked: false, findings: [], detail: "" }),
    checkUpdates: async () => ({ updates: [], skipped: [] }),
    updatePlugin: async () => ({ ok: true, packageName: "x", message: "ok", restartNeeded: true }),
    fetchReadme: async () => ({ ok: true, text: "# readme", encoding: "utf-8", url: "" }),
    favoritesGet: async () => ({ names: ["d"] }),
    favoritesSet: async (names) => ({ ok: true, count: names.length })
  };
}

function commonChecks(applyError, registrations) {
  check("apply ran", applyError === null, applyError instanceof Error ? applyError.message : String(applyError));
  check("shell.overlay registered", typeof registrations["shell.overlay"] === "function");
  check("sidebar.footer.action registered", typeof registrations["sidebar.footer.action"] === "function");
}

// ---- Pass 1: default loading state (real react) ----
{
  const { registrations, ctx, applyError } = await loadBundle(react);
  commonChecks(applyError, registrations);
  const t = ctx.locale.bind("settings.pluginMarketHub");
  const overlayEntry = registrations["shell.overlay"]();
  check("overlay entry shape", overlayEntry.options.id === "kidai-plugin-market-hub" && typeof overlayEntry.component === "function");
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(overlayEntry.component, overlayPropsOf(overlayEntry, t)));
    check("overlay renders without throwing", html.length > 0);
  } catch (error) {
    check("overlay renders without throwing", false, error instanceof Error ? error.stack ?? error.message : String(error));
  }
  check("hub overlay shell present", html.includes("dshm_hubOverlay") && html.includes("dshm_hubPanel"));
  check("restart button present", html.includes("dshm_restartBtn"));
  check("close button present", html.includes("dshm_hubClose"));
  check("toolbar present", html.includes("dshm_toolbar"));
  check("filters row present", html.includes("dshm_filters"));
  check("loading status present", html.includes("正在获取插件列表"));
  check("loading text sits BELOW the toolbar+filters rows (no upper-row jumping)", html.indexOf("dshm_filters") !== -1 && html.indexOf("正在获取插件列表") > html.indexOf("dshm_filters") && html.indexOf("正在获取插件列表") > html.indexOf("dshm_toolbar"));
  check("loading text not above the toolbar", html.indexOf("正在获取插件列表") > html.indexOf("dshm_views"));
  check("source buttons fixed while loading (outside ready fragment)", html.includes("dshm_metaTabs") && html.includes(">全部<"));
  check("meta bar hidden while loading", !html.includes("dshm_metaBar"));
}

// ---- Pass 2: forced ready + awesome view ----
{
  const reactReady = makeReact(true, true);
  const { registrations, ctx, applyError } = await loadBundle(reactReady);
  commonChecks(applyError, registrations);
  const t = ctx.locale.bind("settings.pluginMarketHub");
  const overlayEntry = registrations["shell.overlay"]();
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(overlayEntry.component, overlayPropsOf(overlayEntry, t)));
    check("ready+awesome renders without throwing", html.length > 0);
  } catch (error) {
    check("ready+awesome renders without throwing", false, error instanceof Error ? error.stack ?? error.message : String(error));
  }
  check("meta bar present", html.includes("dshm_metaBar"));
  check("meta info present (heading + count + source on one line)", html.includes("dshm_metaInfo") && html.includes("dshm_catalogHeading") && html.includes("dshm_sourceLine"));
  check("meta tabs present (right-aligned group in the filters row)", html.includes("dshm_metaTabs"));
  check("source tabs 全部/GitHub/npm present", html.includes(">全部<") && html.includes(">GitHub<") && html.includes(">npm<"));
  check("awesome colored button present", html.includes("dshm_sourceTabAwesome") && html.includes(">awesome-dsh-plugin<"));
  check("awesome button is the active tab", html.includes('dshm_sourceTab dshm_sourceTabAwesome" data-active="true"'));
  check("scroll container marked awesome (padding removed for flush sticky headers)", html.includes('dshm_scroll" data-awesome="true"'));
  check("collapsible category sections present", html.includes("dshm_catHead"));
  check("categories start collapsed (no card list rendered)", !html.includes("dshm_catCards"));
  check("collapsed headers carry aria-expanded=false (no sticky freeze)", html.includes('dshm_catHead" aria-expanded="false"'));
  check("category header shows an icon", html.includes("dshm_catIcon"));
  check("category header shows Chinese titles", html.includes(">界面增强<") && html.includes(">趣味娱乐<"));
  check("category order preserved (Just for Fun before UI Enhancements)", html.indexOf(">趣味娱乐<") !== -1 && html.indexOf(">界面增强<") !== -1 && html.indexOf(">趣味娱乐<") < html.indexOf(">界面增强<"));
}

// ---- Pass 3: forced ready + browse view (flat cards) — star counts and the
// ★推荐 recommendation badge must render on high-star cards. ----
{
  const reactBrowse = makeReact(true, false);
  const { registrations, ctx, applyError } = await loadBundle(reactBrowse);
  commonChecks(applyError, registrations);
  const t = ctx.locale.bind("settings.pluginMarketHub");
  const overlayEntry = registrations["shell.overlay"]();
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(overlayEntry.component, overlayPropsOf(overlayEntry, t)));
    check("ready+browse renders without throwing", html.length > 0);
  } catch (error) {
    check("ready+browse renders without throwing", false, error instanceof Error ? error.stack ?? error.message : String(error));
  }
  check("flat card list rendered", html.includes("dshm_cards"));
  check("star count shown on the high-star card", html.includes("120 星标"));
  check("★推荐 recommendation badge shown", html.includes("★ 推荐"));
  check("recommendation badge styled", html.includes("dshm_badgeRec"));
  check("no awesome grouping in browse view", !html.includes("dshm_catHead"));
  check("no progress bar while idle", !html.includes("dshm_progress"));
}

// ---- Pass 3b: forced ready + browse + a running install — the install button
// becomes 已提交 while the operation is in flight. ----
{
  const reactInstalling = makeReact(true, false, false, false, false, true);
  const { registrations, ctx, applyError } = await loadBundle(reactInstalling);
  commonChecks(applyError, registrations);
  const t = ctx.locale.bind("settings.pluginMarketHub");
  const overlayEntry = registrations["shell.overlay"]();
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(overlayEntry.component, overlayPropsOf(overlayEntry, t)));
    check("installing view renders without throwing", html.length > 0);
  } catch (error) {
    check("installing view renders without throwing", false, error instanceof Error ? error.stack ?? error.message : String(error));
  }
  check("install button shows 已提交 while installing", html.includes(">已提交<"));
}

// ---- Pass 3c: forced ready + browse + an in-flight audit — the install button
// shows 审查中… during the security review. ----
{
  const reactAuditing = makeReact(true, false, false, false, false, false, true);
  const { registrations, ctx, applyError } = await loadBundle(reactAuditing);
  commonChecks(applyError, registrations);
  const t = ctx.locale.bind("settings.pluginMarketHub");
  const overlayEntry = registrations["shell.overlay"]();
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(overlayEntry.component, overlayPropsOf(overlayEntry, t)));
    check("auditing view renders without throwing", html.length > 0);
  } catch (error) {
    check("auditing view renders without throwing", false, error instanceof Error ? error.stack ?? error.message : String(error));
  }
  check("install button shows 审查中 while auditing", html.includes(">审查中…<"));
}

// ---- Pass 4: installed view — the 检查更新 button must sit in the filters
// row (right-aligned), not on its own updatesBar row. ----
{
  const reactInstalled = makeReact(true, false, true);
  const { registrations, ctx, applyError } = await loadBundle(reactInstalled);
  commonChecks(applyError, registrations);
  const t = ctx.locale.bind("settings.pluginMarketHub");
  const overlayEntry = registrations["shell.overlay"]();
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(overlayEntry.component, overlayPropsOf(overlayEntry, t)));
    check("installed view renders without throwing", html.length > 0);
  } catch (error) {
    check("installed view renders without throwing", false, error instanceof Error ? error.stack ?? error.message : String(error));
  }
  check("installed filters row present", html.includes("dshm_filters"));
  check("检查更新 button present", html.includes("检查更新"));
  check("检查更新 moved into the filters row (right-aligned wrapper)", html.includes("dshm_filtersRight"));
  check("检查更新 sits inside the filters row", html.indexOf("dshm_filtersRight") > html.indexOf("dshm_filters") && html.indexOf("检查更新") > html.indexOf("dshm_filtersRight"));
  check("updates hints bar kept separately", html.includes("dshm_updatesBar"));
}

// ---- Pass 5: audit risk modal — softened copy, severity counts, block-first
// ordering, and the 我已知晓 / 取消安装 action buttons. ----
{
  const reactAudit = makeReact(true, false, false, true);
  const { registrations, ctx, applyError } = await loadBundle(reactAudit);
  commonChecks(applyError, registrations);
  const t = ctx.locale.bind("settings.pluginMarketHub");
  const overlayEntry = registrations["shell.overlay"]();
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(overlayEntry.component, overlayPropsOf(overlayEntry, t)));
    check("audit modal renders without throwing", html.length > 0);
  } catch (error) {
    check("audit modal renders without throwing", false, error instanceof Error ? error.stack ?? error.message : String(error));
  }
  check("softened modal title 安装安全提示", html.includes("安装安全提示"));
  check("neutral lead copy (no scary 已拦截)", html.includes("安装前请查看以下风险项") && !html.includes("已拦截安装"));
  check("severity count line present", html.includes("风险项 2") && html.includes("高危 1") && html.includes("提示 1"));
  check("高危 badge rendered for block finding", html.includes("dshm_auditSeverityBlock"));
  check("提示 badge rendered for warn finding", html.includes("dshm_auditSeverityWarn"));
  check("block finding listed before warn finding", html.indexOf("动态执行") !== -1 && html.indexOf("网络请求") !== -1 && html.indexOf("动态执行") < html.indexOf("网络请求"));
  check("我已知晓 button present", html.includes("我已知晓"));
  check("取消安装 button present", html.includes("取消安装"));
  check("acknowledge hint present", html.includes("确认后将立即安装，重启 DSH 后生效。"));
}

// ---- Pass 6: in-window bottom status row — a running operation shows label,
// elapsed time, queue/overall progress, and a completed op flashes success. ----
{
  const reactProgress = makeReact(true, false, false, false, true);
  const { registrations, ctx, applyError } = await loadBundle(reactProgress);
  commonChecks(applyError, registrations);
  const t = ctx.locale.bind("settings.pluginMarketHub");
  const overlayEntry = registrations["shell.overlay"]();
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(overlayEntry.component, overlayPropsOf(overlayEntry, t)));
    check("progress view renders without throwing", html.length > 0);
  } catch (error) {
    check("progress view renders without throwing", false, error instanceof Error ? error.stack ?? error.message : String(error));
  }
  check("reserved bottom status row inside the hub panel", html.includes("dshm_hubStatus") && html.includes("dshm_hubPanel"));
  check("status row active while operations run", html.includes('dshm_hubStatus" data-active="true"'));
  check("in-window progress bar present (not fixed)", html.includes("dshm_progress"));
  check("running op label shown", html.includes("正在安装 dsh-plugin-x"));
  check("elapsed time shown for the running op", html.includes(">5s<"));
  check("queue count shown for the queued op", html.includes("1项排队"));
  check("overall percentage shown", html.includes("65%"));
  check("completed op flashes success (green)", html.includes("dshm_progressDoneOk") && html.includes("安装成功 dsh-emoji"));
}

// ---- Pass 7: README modal — markdown renders images/tables/task lists and
// the close button is a round ×. ----
{
  const reactReadme = makeReact(true, false, false, false, false, false, false, true);
  const { registrations, ctx, applyError } = await loadBundle(reactReadme);
  commonChecks(applyError, registrations);
  const t = ctx.locale.bind("settings.pluginMarketHub");
  const overlayEntry = registrations["shell.overlay"]();
  let html = "";
  try {
    html = renderToStaticMarkup(createElement(overlayEntry.component, overlayPropsOf(overlayEntry, t)));
    check("readme modal renders without throwing", html.length > 0);
  } catch (error) {
    check("readme modal renders without throwing", false, error instanceof Error ? error.stack ?? error.message : String(error));
  }
  check("round × close button on the readme modal", html.includes("dshm_readmeClose") && html.includes(">×<"));
  check("markdown image rendered as <img>", html.includes("dshm_readmeImg") && html.includes("https://example.com/logo.png"));
  check("markdown table rendered", html.includes("dshm_readmeTable") && html.includes("<th>"));
  check("task list rendered with checkboxes", html.includes("dshm_readmeTask") && html.includes("dshm_readmeCheckOn"));
  check("code fence rendered", html.includes("dshm_readmePre"));
  check("heading rendered", html.includes("dshm_readmeH1"));
}

console.log(failures === 0 ? "\nRENDER CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
