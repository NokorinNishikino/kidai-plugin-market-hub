# Kidai Plugin Market (纪代插件市场) — Plugin Marketplace for DeepSeek Harness

> **Project / package name:** `kidai-plugin-market` — the brand is **Kidai Plugin Market / 纪代插件市场**, used to distinguish this project from others with the same feature (the marketplace itself, 插件市场, is the shared feature name, like fries at different fast-food chains).
> The old name `dsh-plugin-market` was already taken, so this project no longer uses it.

A dual-face (Host + Client) plugin for DeepSeek Harness (DSH) that adds a **"Plugin marketplace" (插件市场) tab** to **Settings → Plugins**, next to "Plugin configuration" (插件配置) and "Plugin list" (插件列表). It lists published DSH plugins live from GitHub (topic `dsh-plugin`), npm, and the community-curated awesome-dsh-plugin list, with a scrollable card grid, search, sorting, release-page links, and one-click local install.

## Features

- **Live catalog** — the Host merges GitHub repos tagged `dsh-plugin` (`topic:dsh-plugin` search API), npm registry search results, and the community-curated awesome-dsh-plugin list, cached in memory for 5 minutes; the browser bundle has a direct-fetch fallback path.
- **Scrollable plugin list** — card grid inside a scroll container (`max-height` + `overflow-y`).
- **Search** — matches plugin name (including full repo name) and description text.
- **Sorting** — recently updated / most starred / name.
- **One card per plugin** — the repository owner's avatar as the icon (initial-letter fallback), plus name, description, topic tags, star count, and update date.
- **"Release page" button** — opens the plugin's GitHub page in a new window.
- **"Install locally" button** — after confirmation, the Host runs `pnpm add` in the active DSH profile directory (resolving an npm package name first, falling back to `git+https`), then appends any new `dsh.bundle.patch`-declaring dependency to `dsh.profile.bundles` — the same reconciliation `dsh plugin add` performs. Success reports "restart DSH to activate".

## Install

### Through the marketplace itself (recommended)

1. Install this plugin once (below), restart DSH;
2. Open Settings → Plugins → Plugin marketplace, find this or any plugin, click "Install locally";
3. Restart DSH so the new plugin activates.

### Manual install into a Desktop / Web profile

From a DSH terminal, target the profile you use (Desktop defaults to `desktop`, Web to `web`):

```bash
dsh plugin --profile desktop add kidai-plugin-market
```

Local path or git spec works too:

```bash
dsh plugin --profile desktop add file:D:\path\to\kidai-plugin-market
dsh plugin --profile desktop add git+https://github.com/<owner>/kidai-plugin-market.git
```

Then restart DSH. The `scripts/install-profile.ps1` helper performs the equivalent local install (copies the package into the profile tree and updates the manifest).

> Requires `pnpm` on PATH (or the pnpm bundled with DSH), plus network access to `api.github.com` (catalog) and `registry.npmjs.org` (install validation).

## Uninstall

```bash
dsh plugin --profile desktop remove kidai-plugin-market
```

## How it works

| Part | File | Notes |
| --- | --- | --- |
| Host half | `lib/index.js` | Cordis plugin whose default export is `PluginMarketGateway` (a `TypertRemoteService`, namespace `pluginMarket`) exposing `listPublished` / `installed` / `installPlugin` via SRC Remote markers. |
| Composition | `cordis.patch.yml` | Inserts the `plugin-market` loader row; because the package also declares `dsh.client`, the same row feeds the browser module manifest. |
| Client half | `lib/client.js` | Browser bundle registering the `market` tab (order 20) into `settings.plugins.tab`, mounting the `pluginMarket` Remote descriptors (hand-written strict codecs, no zod), and rendering the UI. |
| Install channel | Host `installPlugin(spec)` | Validates the spec (npm name / GitHub repo), resolves pnpm, runs `pnpm add` in the profile directory, reconciles `dsh.profile.bundles`. |

## Catalog sources & network notes

Sources are tried in order; the first success wins (the tab shows which source was used below its heading):

1. **GitHub API (official)** — `api.github.com` `topic:dsh-plugin` repository search;
2. **GitHub API mirrors** — `ghfast.top` / `ghproxy.net` prefix proxies (used when the official API is unreachable);
3. **npm official search** — `registry.npmjs.org/-/v1/search?text=dsh-plugin`, filtered to `dsh-plugin-*` / `dsh-*` names;
4. **npmmirror search** — `registry.npmmirror.com/-/v1/search` (usually the fastest/most reliable from mainland China);
5. **awesome-dsh-plugin curated list** — the community-maintained [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) README, parsed for `- [owner/repo](url) - description` bullets (including monorepo `#subpackage` entries) and merged into the catalog under an "AWESOME" source badge. Fetched through the same CDN-first chain as repo files, so it consumes no GitHub API quota.

If every source fails, the last successfully fetched catalog persisted at `.plugin-market-cache.json` inside the profile directory is returned (marked "offline cache"); only a never-succeeded run reports an error.

**If the list still fails to load**, try any of:

- Set the environment variable `DSH_PLUGIN_MARKET_GITHUB_API` to a working GitHub API mirror base (tried first), then restart DSH, e.g.:

  ```powershell
  setx DSH_PLUGIN_MARKET_GITHUB_API "https://ghfast.top/https://api.github.com"
  ```

  (`setx` takes effect for newly started processes only.)
- Make sure at least one of `registry.npmjs.org` / `registry.npmmirror.com` is reachable — either npm source is enough for the catalog to load.
- The "Refresh" button bypasses the 5-minute cache and forces a refetch.

## Develop & publish

- Follow the community `dsh-plugin-*` naming convention and publish to npm; tag the GitHub repo with the `dsh-plugin` topic to appear in this marketplace.
- Host changes (`lib/index.js`) take effect on restart; browser-bundle changes (`lib/client.js`) take effect on restart (or through the `dsh-client-hmr` dev chain).
- Local syntax check: `node --check lib/index.js && node --check lib/client.js`.

## License

MIT
