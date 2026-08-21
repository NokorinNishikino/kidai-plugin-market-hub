<div align="center">

# 🐋 Kidai Plugin Market Hub（纪代插件市场）

**一键安装 · 统一管理 · 安全护航** — DeepSeek Harness 的插件市场中心

**简体中文** · [**English**](README.en.md)

</div>

---

## ✨ 为什么用它

DeepSeek Harness（DSH）的插件生态越来越大,但找插件、装插件、管插件分散在好几个地方。**纪代插件市场**把这些全部收进一个独立的全屏页面,侧边栏一键直达:

- 🗂️ **海量目录,一处逛完** — 聚合 GitHub `dsh-plugin` 话题、npm 注册表与社区精选 awesome 列表,**1700+ 插件**可搜索、可排序、可分类;
- ⚡ **一键安装** — 点一下就在当前 DSH 配置里装好,自动收敛 `bundles`,重启即生效;
- 🛡️ **装上就能用,不会装崩** — 市场在安装时自动做**安全审计、入口校验、运行时兼容检查、keyed-slot 修补、`@local` 链接、源码子包构建**——伪插件和"必崩"插件在安装环节就被拦下;
- 🧹 **已装管理 + 孤儿清理** — 启用 / 禁用 / 更新 / 卸载,连"文件残留但没挂载"的孤儿插件都能在列表里直接启用或删除;
- 🚀 **顶部立即重启** — 装完、更新完、切换完,一键重启 DSH。

> **无需懂任何技术细节** — 普通用户打开即用;开发者也能享受完整的安装安全网。

---

## 🚀 快速开始

在 DSH 命令行中执行(Desktop 用 `desktop`,Web 用 `web`):

```bash
dsh plugin --profile desktop add kidai-plugin-market-hub
```

然后**重启 DSH**,主页侧边栏「设置」按钮上方会出现「纪代市场」入口,点击进入全屏市场页。

卸载:

```bash
dsh plugin --profile desktop remove kidai-plugin-market-hub
```

> 需要本机可用的 `pnpm`(或 DSH 自带的 pnpm),并确保能访问 `api.github.com`(目录)与 `registry.npmjs.org`(安装校验)。

---

## 🎯 功能一览

### 逛市场

- **多源目录** — GitHub / npm / awesome 三个来源合并,实时抓取,5 分钟缓存 + 离线兜底;
- **搜索排序** — 按名称、描述匹配;按最近更新 / 星标 / 名称排序;
- **插件卡片** — 头像、简介、标签、星标、更新时间一目了然,点击直达 GitHub 发布页。

### 装插件

- **一键本地安装** — 自动解析 npm 包名或 GitHub 仓库,`pnpm add` + `bundles` 收敛;
- **安全审计** — 静态扫描高危风险(动态执行、网络请求、密钥读取等),高危拦截;
- **可加载性校验** — 缺入口的伪插件(如把部署脚本伪装成插件)在安装时被拒绝;
- **运行时兼容** — 旧版 DSH 插件自动修补已知差异,确认后安装,成功附带风险提示;
- **自动构建** — TypeScript 源码包子包缺构建产物时自动编译,失败即回滚。

### 管插件

- **启用 / 禁用 / 更新 / 卸载** — 已安装页集中操作;
- **孤儿插件** — 扫描未挂载的残留文件,灰色卡片可直接**启用**或**删除**;
- **打开本地目录** — 一键在文件管理器里定位插件安装位置。

### 立即重启

Hub 顶部常驻「立即重启」,两步确认后即时生效。

---

## 🖥️ 支持的部署形态

| 部署形态 | 启动方式 | 状态 |
| --- | --- | --- |
| **Desktop 应用**(内嵌 Web 界面) | 启动 DSH Desktop | ✅ 完整可用 |
| **独立 Web 部署** | `dsh --profile web --port 8080` | ✅ 完整可用 |

两种形态功能完全一致,唯一差异:独立 Web 部署无 Electron,"立即重启"降级为手动重启提示。

---

## ⚙️ 工作原理(技术细节)

| 组成部分 | 文件 | 说明 |
| --- | --- | --- |
| Host 半 | `lib/index.js` | Cordis 插件,`PluginMarketGateway`(`TypertRemoteService`,命名空间 `pluginMarketHub`),通过 SRC 标记暴露 `listPublished` / `installed` / `installPlugin` / `setEnabled` / `openLocal` / `cancelEnabled` / `checkUpdates` / `updatePlugin` / `fetchReadme` / `auditPackage` / `restartApp` / `uninstallPlugin` / `scanOrphanPlugins` / `mountOrphan` / `removeOrphanFiles`。 |
| 组合层 | `cordis.patch.yml` | 插入插件行;因包声明 `dsh.client`,同一行同时进入浏览器模块清单。 |
| Client 半 | `lib/client.js` | 浏览器 bundle:注册侧边栏启动器(`sidebar.footer.action`)与全屏 Hub 页(`shell.overlay`),挂载 Remote 描述符(手写严格 codec),渲染双页签 UI。 |
| 安装通道 | Host `installPlugin(spec)` | 校验 spec → 解析 pnpm → `pnpm add` → 收敛 `dsh.profile.bundles`。 |
| 重启通道 | Host `restartApp()` | 检测部署形态并请求重启;Hub 头部两步确认。 |

### 目录数据源

按顺序尝试,第一个成功即采用(页签下方显示来源):

1. **GitHub API(官方)** — `topic:dsh-plugin` 仓库搜索;
2. **GitHub API 镜像** — `ghfast.top` / `ghproxy.net`;
3. **npm 官方搜索** — `registry.npmjs.org/-/v1/search`;
4. **npmmirror 搜索** — `registry.npmmirror.com`(国内最快最稳);
5. **awesome-dsh-plugin 精选** — 社区维护列表,CDN 优先链路抓取,不耗 API 配额。

**GitHub 不可达时**自动走 **tarball 下载链**(codeload → ghproxy → ghfast → gh-proxy),避免 git 协议挂起数分钟。全部失败回退离线缓存。

---

## 📚 更多

- **更新记录**:[CHANGELOG.md](CHANGELOG.md)
- **开发与发布**:修改 `lib/index.js`(Host)重启生效;`lib/client.js`(浏览器)重启或走 `dsh-client-hmr` 热更。语法检查 `node --check lib/index.js && node --check lib/client.js`;测试套件见 `scripts/`。

## License

MIT
