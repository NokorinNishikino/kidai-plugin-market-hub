<div align="center">

[**简体中文**](README.md) · **English**

</div>

# Kidai Plugin Market Hub (纪代插件市场) — Marketplace Hub for DeepSeek Harness

> **Project / package name:** `kidai-plugin-market-hub` — the brand is **Kidai Plugin Market Hub / 纪代插件市场**. A hub launcher that puts the full plugin marketplace one click away from the home sidebar, plus a standalone full-screen hub page with an immediate-restart button on top.

A dual-face (Host + Client) plugin for DeepSeek Harness (DSH) that adds a **launcher above the 设置 (Settings) button on the home sidebar**. Clicking it opens a **standalone full-screen hub page** (`shell.overlay`) hosting the two-tab marketplace UI — **插件市场 (marketplace)** and **已安装 (installed)** — with **restart DSH** pinned at the top-right.

## Features

- **Sidebar launcher** — injected into `sidebar.footer.action`, rendered right above the home sidebar's 设置 button; one click opens the hub.
- **Standalone full-screen hub page** — `shell.overlay` overlay with a header bar: title, **"Restart now"** (two-step confirm, calls the Host `restartApp`), and a close button.
- **Two tabs, one place** — the marketplace catalog and installed-plugin management live in a single full-screen page instead of deep inside Settings.
- **Live catalog** — merges GitHub repos tagged `dsh-plugin` (`topic:dsh-plugin` search API), npm registry search results, and the community-curated awesome-dsh-plugin list, cached in memory for 5 minutes; the browser bundle has a direct-fetch fallback path.
- **Search & sorting** — matches plugin name (including full repo name) and description; sort by recently updated / most starred / name.
- **One card per plugin** — the repository owner's avatar as the icon (initial-letter fallback), plus name, description, topic tags, star count, and update date.
- **"Release page" button** — opens the plugin's GitHub page in a new window.
- **"Install locally" button** — after confirmation, the Host runs `pnpm add` in the active DSH profile directory (resolving an npm package name first, falling back to git), then appends any new `dsh.bundle.patch`-declaring dependency to `dsh.profile.bundles` — the same reconciliation `dsh plugin add` performs. Success reports "restart DSH to activate".
- **Generic install hardening (automation, not per-plugin fixes)** — a fail-closed static security audit (`auditPackage`, blocks high-risk findings) plus post-install validation that rejects anything that would break DSH at boot:
  - **Loadability check** — a plugin must declare `dsh.bundle.patch` AND resolve to a real entry file (`main` / `exports` / Node's implicit `index.js`); pseudo-plugins (e.g. deployment-script repos that fake `dsh.bundle`) are rejected at install time so the whole plugin tree cannot fail to load;
  - **Runtime-compat guard** — older-runtime (rc.6) plugins get a **risk-confirmation** flow: known breaks (keyed-slot registration injection) are auto-repaired, the user acknowledges, the install proceeds, and the success message carries the warning;
  - **`@local` link auto-creation** — patches referencing `@local/<pkg>` get a junction created automatically; no manual install script needed;
  - **Duplicate-entry-id guard** — patches INSERTing loader ids that collide with the composed tree cancel the install with an explanation;
  - **TypeScript source-only subpackages auto-build** — missing build output triggers `pnpm install` + build automatically; a failed build rolls back.
- **Installed-tab management** — enable / disable per plugin (`setEnabled` / `cancelEnabled`), open the plugin's install directory in the file manager (`openLocal`), check for newer npm versions (`checkUpdates`), update one plugin to latest (`updatePlugin`), view its README (`fetchReadme`), and uninstall (`uninstallPlugin`, including `@local/*`-linked packages).
- **Orphan-plugin management** — scans "files exist but not mounted" plugins (`scanOrphanPlugins`) and lists them as gray rows in the installed tab: **Mount** (`mountOrphan`, remounts and clears the disabled marker) or **Delete files** (`removeOrphanFiles`, removes residue; declared dependencies route to a full uninstall). Mounting re-validates the entry point so a broken plugin can never be reintroduced.
- **Restart on top** — the hub header's "Restart now" button restarts DSH immediately after installs, updates, or toggles.

## Install

### Manual install into a Desktop / Web profile

From a DSH terminal, target the profile you use (Desktop defaults to `desktop`, Web to `web`):

```bash
dsh plugin --profile desktop add kidai-plugin-market-hub
```

Local path or git spec works too:

```bash
dsh plugin --profile desktop add file:D:\path\to\kidai-plugin-market-hub
dsh plugin --profile desktop add git+https://github.com/NokorinNishikino/kidai-plugin-market-hub.git
```

Then restart DSH. The `scripts/install-profile.ps1` helper performs the equivalent local install (copies the package into the profile tree and updates the manifest).

> Requires `pnpm` on PATH (or the pnpm bundled with DSH), plus network access to `api.github.com` (catalog) and `registry.npmjs.org` (install validation).

## Uninstall

```bash
dsh plugin --profile desktop remove kidai-plugin-market-hub
```

## How it works

| Part | File | Notes |
| --- | --- | --- |
| Host half | `lib/index.js` | Cordis plugin whose default export is `PluginMarketGateway` (a `TypertRemoteService`, namespace `pluginMarketHub`) exposing `listPublished` / `installed` / `installPlugin` / `setEnabled` / `openLocal` / `cancelEnabled` / `checkUpdates` / `updatePlugin` / `fetchReadme` / `auditPackage` / `restartApp` / `uninstallPlugin` / `scanOrphanPlugins` / `mountOrphan` / `removeOrphanFiles` via SRC Remote markers. |
| Composition | `cordis.patch.yml` | Inserts the plugin rows; because the package also declares `dsh.client`, the same rows feed the browser module manifest. |
| Client half | `lib/client.js` | Browser bundle registering the sidebar launcher (`sidebar.footer.action`) and the full-screen hub page (`shell.overlay`), mounting the `pluginMarketHub` Remote descriptors (hand-written strict codecs, no zod), and rendering the two-tab UI. |
| Install channel | Host `installPlugin(spec)` | Validates the spec (npm name / GitHub repo), resolves pnpm, runs `pnpm add` in the profile directory, reconciles `dsh.profile.bundles`. |
| Restart channel | Host `restartApp()` | Detects the running DSH deployment and requests a restart; the hub header shows the two-step "Restart now" button. |

## Catalog sources & network notes

Sources are tried in order; the first success wins (the tab shows which source was used below its heading):

1. **GitHub API (official)** — `api.github.com` `topic:dsh-plugin` repository search;
2. **GitHub API mirrors** — `ghfast.top` / `ghproxy.net` prefix proxies (used when the official API is unreachable);
3. **npm official search** — `registry.npmjs.org/-/v1/search?text=dsh-plugin`, filtered to `dsh-plugin-*` / `dsh-*` names;
4. **npmmirror search** — `registry.npmmirror.com/-/v1/search` (usually the fastest/most reliable from mainland China);
5. **awesome-dsh-plugin curated list** — the community-maintained [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) README, parsed for `- [owner/repo](url) - description` bullets (including monorepo `#subpackage` entries) and merged into the catalog under an "AWESOME" source badge. Fetched through the same CDN-first chain as repo files, so it consumes no GitHub API quota.

**GitHub install mirror fallback** — when `github.com` is unreachable, whole-repo installs automatically switch to the **tarball download chain** (codeload → ghproxy → ghfast → gh-proxy) instead of stalling for minutes on the git protocol.

If every source fails, the last successfully fetched catalog persisted at `.plugin-market-cache.json` inside the profile directory is returned (marked "offline cache"); only a never-succeeded run reports an error.

**If the list still fails to load**, try any of:

- Set the environment variable `DSH_PLUGIN_MARKET_GITHUB_API` to a working GitHub API mirror base (tried first), then restart DSH, e.g.:

  ```powershell
  setx DSH_PLUGIN_MARKET_GITHUB_API "https://ghfast.top/https://api.github.com"
  ```

  (`setx` takes effect for newly started processes only.)
- Make sure at least one of `registry.npmjs.org` / `registry.npmmirror.com` is reachable — either npm source is enough for the catalog to load.
- The "Refresh" button bypasses the 5-minute cache and forces a refetch.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Develop & publish

- Follow the community `dsh-plugin-*` naming convention and publish to npm; tag the GitHub repo with the `dsh-plugin` topic to appear in this marketplace.
- Host changes (`lib/index.js`) take effect on restart; browser-bundle changes (`lib/client.js`) take effect on restart (or through the `dsh-client-hmr` dev chain).
- Local syntax check: `node --check lib/index.js && node --check lib/client.js`.
- Test suites: `node scripts/test-install-guard.mjs` (install hardening), `node scripts/smoke-test-hub.mjs` (Remote mounting), `node scripts/render-test-hub.mjs` (client render), `node scripts/test-client-patch.mjs` (client repair), `node scripts/test-awesome-stars.mjs` (catalog enrichment).

## License

MIT
