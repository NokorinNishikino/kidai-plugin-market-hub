# Kidai Plugin Market（纪代插件市场）— DeepSeek Harness 插件市场

> **项目 / npm 包名：** `kidai-plugin-market` —— 品牌为 **Kidai Plugin Market / 纪代插件市场**,用于与功能相同、但品牌不同的其他项目区分(「插件市场」是功能名,就像不同快餐品牌的薯条)。
> 旧名 `dsh-plugin-market` 已被占用,本项目不再使用。

一个面向 DeepSeek Harness（DSH）的双端（Host + Client）插件：在 **设置 → 插件** 页面中，与「插件配置」「插件列表」并列新增一个 **「插件市场」** 页签，实时联网展示社区已发布的 DSH 插件（GitHub `dsh-plugin` 话题、npm、以及社区精选的 awesome-dsh-plugin 列表），支持滚动列表、搜索、排序、跳转发布页与一键安装到本地。

![功能位置] 设置 → 插件 → 插件市场（与「插件配置」「插件列表」并列）

## 功能

- **实时目录**：Host 端合并抓取 GitHub 上带 `dsh-plugin` 话题的仓库（`topic:dsh-plugin` 搜索接口）、npm 注册表搜索结果与社区精选的 awesome-dsh-plugin 列表，5 分钟内存缓存；浏览器端有直连 GitHub API 的降级路径。
- **上下滑动的插件列表**：卡片网格，容器内滚动（`max-height + overflow-y`）。
- **搜索**：按插件名称（含仓库全名）与介绍文字匹配。
- **排序**：最近更新 / 星标最多 / 名称。
- **每插件一张卡片**：仓库所有者的头像作为图标（无头像时显示首字母占位），配名称、简介、话题标签、星标数与更新时间。
- **「查看发布页」**：新窗口打开该插件的 GitHub 发布页。
- **「安装到本地」**：经确认后，Host 端在当前 DSH 配置目录中执行 `pnpm add`（优先解析为 npm 包名，失败则回退到 `git+https`），并自动把声明了 `dsh.bundle.patch` 的插件追加到 `dsh.profile.bundles`，与 `dsh plugin add` 的收敛逻辑一致；安装成功提示「重启 DSH 后生效」。

## 安装

### 通过插件市场自身（推荐）

1. 先安装本插件（见下），重启 DSH；
2. 打开 设置 → 插件 → 插件市场，找到本插件或任意插件，点击「安装到本地」；
3. 重启 DSH 使新插件生效。

### 手动安装到 Desktop / Web 配置

在 DSH 命令行中对当前使用的 profile（Desktop 默认是 `desktop`，Web 默认是 `web`）执行：

```bash
dsh plugin --profile desktop add kidai-plugin-market
```

或使用本地路径/仓库地址：

```bash
dsh plugin --profile desktop add file:D:\path\to\kidai-plugin-market
dsh plugin --profile desktop add git+https://github.com/<owner>/kidai-plugin-market.git
```

然后重启 DSH。安装脚本 `scripts/install-profile.ps1` 也可完成等价操作（把包复制进配置目录并更新 manifest）。

> 需要本机可用的 `pnpm`（或 DSH 应用自带的 pnpm），并确保网络可访问 `api.github.com`（目录抓取）与 `registry.npmjs.org`（安装校验）。

## 卸载

```bash
dsh plugin --profile desktop remove kidai-plugin-market
```

## 工作原理

| 组成部分 | 文件 | 说明 |
| --- | --- | --- |
| Host 半 | `lib/index.js` | Cordis 插件，默认导出 `PluginMarketGateway`（`TypertRemoteService`，命名空间 `pluginMarket`），通过 SRC 标记暴露 `listPublished` / `installed` / `installPlugin` 三个 Remote 方法。 |
| 组合层 | `cordis.patch.yml` | 向 loader 插入 `plugin-market` 行；同一行因包声明 `dsh.client` 而同时进入浏览器模块清单。 |
| Client 半 | `lib/client.js` | 浏览器 bundle：向 `settings.plugins.tab` 注册 `market` 页签（order 20），挂载 `pluginMarket` Remote 描述符（手写严格 codec，无需 zod），渲染插件市场 UI。 |
| 安装通道 | Host `installPlugin(spec)` | 校验 spec（npm 包名 / GitHub 仓库），解析 pnpm，在 profile 目录执行 `pnpm add`，收敛 `dsh.profile.bundles`。 |

## 目录数据源与网络问题

目录按顺序尝试以下数据源，**第一个成功即采用**（页签标题下方会显示本次的数据来源）：

1. **GitHub API（官方）** — `api.github.com` 的 `topic:dsh-plugin` 仓库搜索；
2. **GitHub API 镜像** — `ghfast.top`、`ghproxy.net` 前缀代理（官方接口不可达时使用）；
3. **npm 官方搜索** — `registry.npmjs.org/-/v1/search?text=dsh-plugin`，按 `dsh-plugin-*` / `dsh-*` 命名惯例过滤；
4. **npmmirror 搜索** — `registry.npmmirror.com/-/v1/search`（国内网络通常最快、最稳）；
5. **awesome-dsh-plugin 精选列表** — 社区维护的 [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) README，解析 `- [owner/repo](url) - 描述` 条目（含 monorepo 的 `#子包` 条目）并合并进目录，来源标记为「AWESOME」徽标；通过与仓库文件相同的 CDN 优先链路抓取，不消耗 GitHub API 配额。

全部失败时回退到**上次成功抓取并落盘的缓存**（存于 profile 目录 `.plugin-market-cache.json`，页面标注"离线缓存"）；从未成功过才显示错误。

**如果列表仍然拉取失败**，可选办法（任选其一）：

- 设置环境变量 `DSH_PLUGIN_MARKET_GITHUB_API` 为可用的 GitHub API 镜像/代理基址（会被最先尝试），然后重启 DSH，例如：

  ```powershell
  setx DSH_PLUGIN_MARKET_GITHUB_API "https://ghfast.top/https://api.github.com"
  ```

  （`setx` 后需从新的终端/重新登录启动 DSH 才会生效。）
- 在机器上确认 `registry.npmjs.org` 或 `registry.npmmirror.com` 至少一个可达；只要任一 npm 源可达，目录即可加载。
- 页面「刷新」按钮会绕过 5 分钟缓存强制重新抓取。

## 开发与发布

- 包名遵循社区惯例 `dsh-plugin-*`，发布到 npm；GitHub 仓库打上 `dsh-plugin` 话题即可被本插件收录。
- 修改 `lib/index.js`（Host）后直接生效于重启；修改 `lib/client.js`（浏览器 bundle）后重启 DSH（或依赖 `dsh-client-hmr` 的开发热更链路）。
- 本地验证语法：`node --check lib/index.js && node --check lib/client.js`。

## License

MIT
