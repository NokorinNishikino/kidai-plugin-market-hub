<div align="center">

# 🐋 Kidai Plugin Market Hub (纪代插件市场)

**Install in one click · Manage everywhere · Stay safe** — the plugin marketplace hub for DeepSeek Harness

[**简体中文**](README.md) · **English**

</div>

---

## ✨ Why use it

The DeepSeek Harness (DSH) plugin ecosystem keeps growing, but finding, installing and managing plugins is scattered across several places. **Kidai Plugin Market Hub** brings it all into one standalone full-screen page, one click away from the sidebar:

- 🗂️ **One place to browse 1700+ plugins** — merges the GitHub `dsh-plugin` topic, npm registry, and the community-curated awesome list; searchable, sortable, categorizable;
- ⚡ **One-click install** — installs straight into your active DSH profile, reconciles `bundles`, activates on restart;
- 🛡️ **Install and it just works — never breaks DSH** — the market auto-runs a security audit, entry-point validation, runtime-compat check, keyed-slot repair, `@local` linking and source-subpackage build at install time. Pseudo-plugins and "guaranteed to crash" packages are blocked before they can touch your profile;
- 🧹 **Manage installed + clean up orphans** — enable / disable / update / uninstall, and even leftover "files exist but not mounted" plugins can be mounted or deleted right from the list;
- 🚀 **Restart on top** — restart DSH in one click after installs, updates and toggles.

> **No technical knowledge needed** — regular users can just open and use it; developers get a full installation safety net too.

---

## 🚀 Quick start

From a DSH terminal (use `desktop` for the Desktop app, `web` for standalone web):

```bash
dsh plugin --profile desktop add kidai-plugin-market-hub
```

Then **restart DSH** — a "纪代市场" launcher appears above the 设置 (Settings) button in the home sidebar. Click it to open the full-screen marketplace.

Uninstall:

```bash
dsh plugin --profile desktop remove kidai-plugin-market-hub
```

> Requires a local `pnpm` (or DSH's bundled one) and network access to `api.github.com` (catalog) and `registry.npmjs.org` (install validation).

---

## 🎯 Features

### Browse

- **Multi-source catalog** — GitHub / npm / awesome merged, live-fetched, 5-min cache + offline fallback;
- **Search & sort** — match by name and description; sort by recently updated / stars / name;
- **Plugin cards** — avatar, description, topics, stars and update time at a glance; jump to the GitHub release page in one click.

### Install

- **One-click local install** — auto-resolves npm names or GitHub repos, `pnpm add` + `bundles` reconciliation;
- **Security audit** — static scan for high-risk patterns (dynamic execution, network calls, secret reads...); blocks on high-risk findings;
- **Loadability validation** — pseudo-plugins with no importable entry (e.g. deployment-script repos faking `dsh.bundle`) are rejected at install time;
- **Runtime compat** — older-runtime plugins get known breaks auto-repaired (keyed-slot injection), acknowledged before install, with a risk note on success;
- **Auto-build** — TypeScript source-only subpackages are compiled automatically; a failed build rolls back.

### Manage

- **Enable / disable / update / uninstall** — all from the installed tab;
- **Orphan plugins** — scan for unmounted leftover files; gray cards can be **mounted** or **deleted** directly;
- **Open local directory** — locate an installed plugin in your file manager in one click.

### Restart

A permanent "Restart now" button on the hub header, two-step confirmed, applies immediately.

---

## 🖥️ Supported deployments

| Deployment | How to start | Status |
| --- | --- | --- |
| **Desktop app** (embedded Web UI) | Launch DSH Desktop | ✅ Fully functional |
| **Standalone Web** | `dsh --profile web --port 8080` | ✅ Fully functional |

Both work identically; the only difference is a standalone Web deployment has no Electron runtime, so "Restart now" degrades to a manual-restart hint.

---

## ⚙️ How it works (technical)

| Part | File | Notes |
| --- | --- | --- |
| Host half | `lib/index.js` | Cordis plugin, `PluginMarketGateway` (`TypertRemoteService`, namespace `pluginMarketHub`), exposing `listPublished` / `installed` / `installPlugin` / `setEnabled` / `openLocal` / `cancelEnabled` / `checkUpdates` / `updatePlugin` / `fetchReadme` / `auditPackage` / `restartApp` / `uninstallPlugin` / `scanOrphanPlugins` / `mountOrphan` / `removeOrphanFiles` via SRC markers. |
| Composition | `cordis.patch.yml` | Inserts the plugin rows; because the package declares `dsh.client`, the same rows feed the browser module manifest. |
| Client half | `lib/client.js` | Browser bundle: sidebar launcher (`sidebar.footer.action`) + full-screen hub page (`shell.overlay`), mounts the Remote descriptors (hand-written strict codecs), renders the two-tab UI. |
| Install channel | Host `installPlugin(spec)` | Validate spec → resolve pnpm → `pnpm add` → reconcile `dsh.profile.bundles`. |
| Restart channel | Host `restartApp()` | Detects the deployment and requests a restart; two-step confirm in the hub header. |

### Catalog sources

Tried in order; the first success wins (the tab shows which source was used):

1. **GitHub API (official)** — `topic:dsh-plugin` search;
2. **GitHub API mirrors** — `ghfast.top` / `ghproxy.net`;
3. **npm official search** — `registry.npmjs.org/-/v1/search`;
4. **npmmirror search** — `registry.npmmirror.com` (fastest from mainland China);
5. **awesome-dsh-plugin curated list** — community-maintained, CDN-first fetch, no API quota.

When `github.com` is unreachable, whole-repo installs automatically switch to the **tarball chain** (codeload → ghproxy → ghfast → gh-proxy) instead of stalling on the git protocol. If everything fails, the offline cache is returned.

---

## 📚 More

- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Develop & publish**: `lib/index.js` (Host) changes apply on restart; `lib/client.js` (browser) on restart or via `dsh-client-hmr`. Syntax check `node --check lib/index.js && node --check lib/client.js`; test suites live under `scripts/`.

## License

MIT
