<div align="center">

**简体中文** · [**English**](README.en.md)

</div>

# Kidai Plugin Market Hub（纪代插件市场）— DeepSeek Harness 插件市场中心

> **项目 / npm 包名：** `kidai-plugin-market-hub` —— 品牌为 **Kidai Plugin Market Hub / 纪代插件市场**。一个 Hub 启动器：把完整的插件市场放到主页侧边栏一键可达的位置，并提供一个带「立即重启」按钮的独立全屏 Hub 页面。

一个面向 DeepSeek Harness（DSH）的双端（Host + Client）插件：在主页侧边栏**「设置」按钮上方**注入一个启动器（`sidebar.footer.action`），点击后打开**独立的全屏 Hub 页面**（`shell.overlay`），承载双页签的插件市场界面——**「插件市场」** 与 **「已安装」**，页面右上角常驻 **「立即重启」** 按钮。

## 功能

- **侧边栏启动器** — 注入 `sidebar.footer.action`，渲染在主页侧边栏「设置」按钮正上方；一键打开 Hub。
- **独立全屏 Hub 页面** — `shell.overlay` 全屏浮层，头部栏包含：标题、「立即重启」（两步确认，调用 Host 端 `restartApp`）与关闭按钮。
- **双页签合一** — 市场目录与已装插件管理集中在一个全屏页面，无需钻进设置页深层。
- **实时目录** — Host 端合并抓取 GitHub 上带 `dsh-plugin` 话题的仓库（`topic:dsh-plugin` 搜索接口）、npm 注册表搜索结果与社区精选的 awesome-dsh-plugin 列表，5 分钟内存缓存；浏览器端有直连 GitHub API 的降级路径。
- **搜索与排序** — 按插件名称（含仓库全名）与介绍文字匹配；按最近更新 / 星标最多 / 名称排序。
- **每插件一张卡片** — 仓库所有者的头像作为图标（无头像时显示首字母占位），配名称、简介、话题标签、星标数与更新时间。
- **「查看发布页」** — 新窗口打开该插件的 GitHub 发布页。
- **「安装到本地」** — 经确认后，Host 端在当前 DSH 配置目录中执行 `pnpm add`（优先解析为 npm 包名，失败则回退到 git），并自动把声明了 `dsh.bundle.patch` 的插件追加到 `dsh.profile.bundles`，与 `dsh plugin add` 的收敛逻辑一致；安装成功提示「重启 DSH 后生效」。
- **安装安全防线（通用自动化）** — 安装前执行**静态安全审计**（`auditPackage`，高危风险拦截）；安装后逐项校验：
  - **可加载性校验** — 插件必须声明 `dsh.bundle.patch` 且能解析出真实入口文件（`main` / `exports` / Node 默认 `index.js`），缺入口的伪插件（如部署脚本仓库伪装 `dsh.bundle`）会在安装时被拒绝，避免启动时整个插件树崩溃；
  - **运行时兼容检查** — 针对旧版 DSH（rc.6）插件给出**风险确认**流程：先自动修补已知兼容差异（keyed-slot 注册注入等），用户点「我已知晓」后才放行，并随成功消息附带风险提示；
  - **`@local` 链接自动创建** — 插件 patch 引用 `@local/<包名>` 时自动创建 junction，无需手动执行安装脚本；
  - **重复条目 id 防护** — patch 插入与组合树冲突的 loader id 时取消安装并说明原因；
  - **TypeScript 源码包子包自动构建** — 子包缺构建产物时自动 `pnpm install` + 构建，构建失败即回滚。
- **已安装页管理** — 单插件启用 / 禁用（`setEnabled` / `cancelEnabled`）、在文件管理器中打开插件安装目录（`openLocal`）、检查是否有更新的 npm 版本（`checkUpdates`）、把单个插件更新到最新版（`updatePlugin`）、查看其 README（`fetchReadme`）、卸载（`uninstallPlugin`，含 `@local/*` 链接包）。
- **孤儿插件管理** — 扫描"文件存在但未挂载"的插件（`scanOrphanPlugins`），以灰色行并入已安装列表：可**启用**（`mountOrphan`，重新挂载并清除禁用标记）或**删除**（`removeOrphanFiles`，清理残留文件；已声明依赖的自动转完整卸载）。挂载前同样校验入口，杜绝再次引入启动崩溃。
- **顶部一键重启** — Hub 头部「立即重启」按钮，安装 / 更新 / 启停后即时重启 DSH。

## 安装

### 手动安装到 Desktop / Web 配置

在 DSH 命令行中对当前使用的 profile（Desktop 默认是 `desktop`，Web 默认是 `web`）执行：

```bash
dsh plugin --profile desktop add kidai-plugin-market-hub
```

或使用本地路径/仓库地址：

```bash
dsh plugin --profile desktop add file:D:\path\to\kidai-plugin-market-hub
dsh plugin --profile desktop add git+https://github.com/NokorinNishikino/kidai-plugin-market-hub.git
```

然后重启 DSH。安装脚本 `scripts/install-profile.ps1` 也可完成等价操作（把包复制进配置目录并更新 manifest）。

> 需要本机可用的 `pnpm`（或 DSH 应用自带的 pnpm），并确保网络可访问 `api.github.com`（目录抓取）与 `registry.npmjs.org`（安装校验）。

## 卸载

```bash
dsh plugin --profile desktop remove kidai-plugin-market-hub
```

## 部署环境支持

KPMH 支持两种 DSH 部署形态，**功能完全一致**（浏览 / 安装 / 卸载 / 启停 / 孤儿管理 / 更新 / 安全审计）：

| 部署形态 | 启动方式 | 状态 |
| --- | --- | --- |
| **Desktop 应用**（内嵌 Web 界面） | 启动 DSH Desktop | ✅ 完整可用 |
| **独立 Web 部署** | `dsh --profile web --port 8080`（或 `dsh web --port 8080`） | ✅ 完整可用 |

**唯一差异**：独立 Web 部署没有 Electron 运行时，Hub 顶部的「立即重启」按钮会降级为提示"请手动重启 DSH"（`restartSupported=false`）；其余所有功能通过 RPC 通道与 Desktop 一致。

> **注意**：独立 Web 部署必须通过 `dsh` 命令启动（该命令自带 `--expose-internals`，加载器才能从 profile 的 `node_modules` 解析第三方 bundle）。直接用 `node .../bin.js web` 启动会因缺少该参数而无法加载第三方插件。

## 工作原理

| 组成部分 | 文件 | 说明 |
| --- | --- | --- |
| Host 半 | `lib/index.js` | Cordis 插件，默认导出 `PluginMarketGateway`（`TypertRemoteService`，命名空间 `pluginMarketHub`），通过 SRC 标记暴露 `listPublished` / `installed` / `installPlugin` / `setEnabled` / `openLocal` / `cancelEnabled` / `checkUpdates` / `updatePlugin` / `fetchReadme` / `auditPackage` / `restartApp` / `uninstallPlugin` / `scanOrphanPlugins` / `mountOrphan` / `removeOrphanFiles` 等 Remote 方法。 |
| 组合层 | `cordis.patch.yml` | 插入插件行；同一行因包声明 `dsh.client` 而同时进入浏览器模块清单。 |
| Client 半 | `lib/client.js` | 浏览器 bundle：注册侧边栏启动器（`sidebar.footer.action`）与全屏 Hub 页面（`shell.overlay`），挂载 `pluginMarketHub` Remote 描述符（手写严格 codec，无需 zod），渲染双页签 UI。 |
| 安装通道 | Host `installPlugin(spec)` | 校验 spec（npm 包名 / GitHub 仓库），解析 pnpm，在 profile 目录执行 `pnpm add`，收敛 `dsh.profile.bundles`。 |
| 重启通道 | Host `restartApp()` | 检测正在运行的 DSH 部署并请求重启；Hub 头部展示两步确认的「立即重启」按钮。 |

## 目录数据源与网络问题

目录按顺序尝试以下数据源，**第一个成功即采用**（页签标题下方会显示本次的数据来源）：

1. **GitHub API（官方）** — `api.github.com` 的 `topic:dsh-plugin` 仓库搜索；
2. **GitHub API 镜像** — `ghfast.top`、`ghproxy.net` 前缀代理（官方接口不可达时使用）；
3. **npm 官方搜索** — `registry.npmjs.org/-/v1/search?text=dsh-plugin`，按 `dsh-plugin-*` / `dsh-*` 命名惯例过滤；
4. **npmmirror 搜索** — `registry.npmmirror.com/-/v1/search`（国内网络通常最快、最稳）；
5. **awesome-dsh-plugin 精选列表** — 社区维护的 [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) README，解析 `- [owner/repo](url) - 描述` 条目（含 monorepo 的 `#子包` 条目）并合并进目录，来源标记为「AWESOME」徽标；通过与仓库文件相同的 CDN 优先链路抓取，不消耗 GitHub API 配额。

**GitHub 安装的镜像回退** — 当 `github.com` 不可达时，普通 GitHub 仓库安装自动改用 **tarball 下载链**（codeload → ghproxy → ghfast → gh-proxy），避免 `pnpm` 的 git 协议在不可达网络上挂起数分钟。

全部失败时回退到**上次成功抓取并落盘的缓存**（存于 profile 目录 `.plugin-market-cache.json`，页面标注"离线缓存"）；从未成功过才显示错误。

**如果列表仍然拉取失败**，可选办法（任选其一）：

- 设置环境变量 `DSH_PLUGIN_MARKET_GITHUB_API` 为可用的 GitHub API 镜像/代理基址（会被最先尝试），然后重启 DSH，例如：

  ```powershell
  setx DSH_PLUGIN_MARKET_GITHUB_API "https://ghfast.top/https://api.github.com"
  ```

  （`setx` 后需从新的终端/重新登录启动 DSH 才会生效。）
- 在机器上确认 `registry.npmjs.org` 或 `registry.npmmirror.com` 至少一个可达；只要任一 npm 源可达，目录即可加载。
- 页面「刷新」按钮会绕过 5 分钟缓存强制重新抓取。

## 更新记录

详见 [CHANGELOG.md](CHANGELOG.md)。

## 开发与发布

- 包名遵循社区惯例 `dsh-plugin-*`，发布到 npm；GitHub 仓库打上 `dsh-plugin` 话题即可被本插件收录。
- 修改 `lib/index.js`（Host）后直接生效于重启；修改 `lib/client.js`（浏览器 bundle）后重启 DSH（或依赖 `dsh-client-hmr` 的开发热更链路）。
- 本地验证语法：`node --check lib/index.js && node --check lib/client.js`。
- 测试套件：`node scripts/test-install-guard.mjs`（安装防线）、`node scripts/smoke-test-hub.mjs`（Remote 挂载）、`node scripts/render-test-hub.mjs`（客户端渲染）、`node scripts/test-client-patch.mjs`（客户端修补）、`node scripts/test-awesome-stars.mjs`（目录增强）。

## License

MIT
