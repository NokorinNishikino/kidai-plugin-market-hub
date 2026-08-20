# 更新记录 Changelog

本文件使用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 风格编写，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [1.3.4] - 2026-08-20

### 文档

- README 补充「部署环境支持」章节：确认 **Desktop 应用**与**独立 Web 部署**（`dsh --profile web`）均可完整使用全部功能；Web 部署需通过 `dsh` 命令启动（自带 `--expose-internals`），唯一差异是「立即重启」按钮在无 Electron 环境下降级为手动重启提示。

### 新增

- **孤儿插件管理（未挂载文件）** — 扫描"文件存在但未挂载"的插件（`scanOrphanPlugins`），以灰色行并入「已安装」列表，支持：
  - **启用**（`mountOrphan`）：把已声明依赖但被禁用/未挂载的插件重新挂载——加回 `dsh.profile.bundles` 并清除 HOME 用户补丁层中的 `disabled` 行；
  - **删除**（`removeOrphanFiles`）：删除未声明依赖的残留文件（node_modules 目录 + vendor 副本 + `@local` junction），不修改依赖清单；已声明依赖的自动转完整卸载。
- **入口校验硬化** — 安装与孤儿挂载都会校验插件能解析出**真实入口文件**（`main` / `exports["."]` / Node 默认 `index.js`）。声明 `dsh.bundle.patch` 但没有任何可加载入口的包（例如伪装成插件的部署脚本仓库）会在安装/挂载时被拒绝，杜绝"整个插件树启动失败"（misakanet 故障模式）。
- **GitHub 不可达时自动走 tarball 下载** — 探测 `github.com` 可达性（5 秒），不可达时普通 GitHub 仓库安装自动改用 tarball 下载链（codeload → ghproxy → ghfast → gh-proxy），避免 `pnpm` 的 git 协议在不可达网络上挂起数分钟。
- **`workspace:` 依赖子包识别** — monorepo 内部包（依赖 `workspace:` 协议）无法脱离仓库构建时给出明确中文提示（建议安装已发布的 npm 版本），而非笼统的构建失败。
- **子包构建失败清理** — 构建失败后删除半成品 `.kidai-vendor` 副本，不残留孤儿目录。

### 修复

- **卸载 `@local/*` 链接插件** — 之前卸载 tavern 这类以 `@local/<包名>` 作为加载器名的插件会报"未在依赖清单中,无法卸载"。现在自动归一化为真实包名执行 `pnpm remove`，并清理 `@local` junction。
- **卸载后的悬空 junction 残留** — `pnpm remove` 删除真实目录后，`@local` junction 变为悬空（`existsSync` 对悬空 junction 返回 false 导致清理被跳过）。现在直接用 `rmSync(force)` 清理，按普通包名卸载时也会清理 `@local/<短名>` junction。
- **patch 行清理覆盖加载器 entry id** — 卸载时通过 `ctx.loader.entries()` 反查加载器 entry id（如 tavern 的 patch 行 id 为 `tavern`，既不是真实包名也不是 `@local` 名），确保对应 patch 行被正确移除。

### 变更

- 旧版运行时（rc.6）插件的运行时兼容检查从"直接拒绝"改为**风险确认流程**：无 `allowRisky` 时返回 `riskConfirmRequired` 并弹窗说明；用户点「我已知晓」后放行，自动应用 keyed-slot 修补并安装，成功消息附带风险提示。
- `@local/<包名>` 引用不再要求用户手动创建 junction — 安装时自动创建。

## [1.2.0] - 2026-08-18

### 新增

- 侧边栏启动器（`sidebar.footer.action`）+ 独立全屏 Hub 页面（`shell.overlay`）双页签界面（插件市场 / 已安装）。
- 多源目录：GitHub `topic:dsh-plugin` 搜索、npm 搜索、awesome-dsh-plugin 精选列表，5 分钟内存缓存 + 离线落盘缓存。
- 搜索 / 排序 / 每插件卡片 / 发布页跳转。
- 一键本地安装（`pnpm add` + `dsh.profile.bundles` 收敛）、启用 / 禁用、打开本地目录、检查更新、单插件更新、README 查看。
- 静态安全审计（`auditPackage`，高危拦截）。
- 顶部「立即重启」两步确认。

## [1.1.0] - 2026-08-18

### 新增

- 首个正式发布：Host + Client 双端插件框架、Remote 方法骨架、目录抓取基础链路。
