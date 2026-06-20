# 产品功能清单

#### 最后更新：2026-06-19

状态说明：

- `complete`：已完成并可在产品中正常使用
- `partial`：已部分完成，但仍存在明确缺口
- `not_started`：已规划、已出现在菜单或设计中，但尚未实现

## 编辑器核心

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| Typora 风格实时 Markdown 编辑 | `complete` | 基于 ProseMirror，实现所见即所得编辑，而不是源码/预览分栏。 |
| 块级输入快捷语法 | `complete` | 已支持标题、无序列表、引用、代码块、任务列表、分隔线。 |
| 行内语法输入与粘贴解析 | `complete` | 已支持粗体、斜体、行内代码、删除线、链接的输入与粘贴解析。 |
| 行内格式快捷键 | `complete` | 粗体、斜体、行内代码、删除线、链接、清除格式已接入编辑器命令。 |
| 标题转换命令 | `complete` | 已实现 1-6 级标题与正文段落互转。 |
| 引用块命令 | `complete` | 引用块包裹转换已完整接入，可通过菜单、快捷键或命令面板快速操作。 |
| 有序列表命令 | `complete` | 有序列表包裹转换已完整接入，可通过菜单、快捷键或命令面板快速操作。 |
| 无序列表命令 | `complete` | 无序列表包裹转换已完整接入，可通过菜单、快捷键或命令面板快速操作。 |
| 标题升级/降级 | `complete` | 已支持通过增加和减少标题层级命令无缝切换 heading/paragraph 的级别，已完整接通。 |
| 代码块语言选择 | `complete` | 输入代码块时可选择语言，已有代码块也可更新语言。 |
| 围栏代码语法高亮 | `complete` | 已支持带语言标记的代码块高亮，并修复了真实文件打开后 `ts`、`json` 等代码块高亮层被编辑器视图回收的问题。 |
| 行内代码启发式着色 | `complete` | 编辑器内已支持行内代码 token 着色。 |
| Mermaid 图表块 | `complete` | 已支持 Mermaid 块渲染，并修复 Mermaid 预览 ready 后未正确替换源码块的显示问题。 |
| 复制 Mermaid 为 PNG | `complete` | 已完整集成右键检测、动态上下文菜单项注入、Clipboard API 写入以及错误提示，并通过充分的单元测试验证。 |
| 表格文档模型与解析 | `complete` | 已支持表格解析与渲染。 |
| 插入表格命令 | `complete` | 已完整接通表格插入命令，作为第一class命令暴露在原生菜单、快捷键及命令面板中。 |
| 表格行列编辑手柄 | `complete` | 实现了完全基于焦点状态的表格行列编辑增强（TableControlsOverlay），在表格获得焦点时于顶部和左侧显示插入/删除行列的浮层控件，完美接通。 |
| 数学公式块 | `not_started` | 已在下一阶段计划中列出，但尚未实现。 |
| 脚注 | `not_started` | 已在下一阶段计划中列出，但尚未实现。 |
| Front matter 编辑 | `not_started` | 已在下一阶段计划中列出，但尚未实现。 |
| TOC 目录支持 | `not_started` | 已在下一阶段计划中列出，但尚未实现。 |
| 高亮 `==text==` | `not_started` | Typora 兼容。行内文本高亮标记。 |
| 下标/上标 `~sub~` / `^sup^` | `not_started` | Typora 兼容。技术文档常用。 |
| Emoji 自动补全 `:smile:` | `not_started` | Typora 兼容。冒号触发 emoji 提示。 |
| 打字机模式 | `not_started` | 光标固定在屏幕垂直中部，适合长文专注写作。 |
| 自动配对标点 | `not_started` | 括号、引号等自动闭合。 |
| HTML 块 | `not_started` | 支持内嵌 HTML 标签渲染（视频、网页嵌入等）。 |
| 粘贴富文本（HTML → Markdown） | `not_started` | 从网页或 Word 粘贴内容时自动转换为 Markdown。 |
| 字数统计 | `complete` | 状态栏实时显示字数/字符数（CJK + 英文混合计数）。 |
| 阅读时间 | `complete` | 状态栏显示预估阅读时间（按 200 词/分钟计算）。 |
| 拼写检查 | `not_started` | 系统级拼写检查与右键拼写建议。 |

## 查找与替换

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 查找栏 | `complete` | 已有文内查找 UI 和状态插件。 |
| 替换栏 | `complete` | 已支持替换一个与全部替换。 |
| 查找下一个 / 上一个命令 | `complete` | 已通过编辑器命令事件驱动前后跳转；已修复搜索跨 inline mark 边界时的命中遗漏与计数偏差问题，回车跳转和 `N/M` 计数现已与实际可见文本一致。 |
| 区分大小写搜索 | `complete` | 查找替换 UI 已支持。 |
| 整词匹配搜索 | `complete` | 查找替换 UI 已支持。 |

## 工作区与文件管理

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 打开单个 Markdown 文件 | `complete` | 文件工作流已实现，并修复新建未命名文档首次保存后因重新解析吞掉空白段落，导致换行/格式丢失的问题。 |
| 打开文件夹工作区 | `complete` | 已支持文件树浏览。 |
| 文件树导航 | `complete` | 侧边栏文件树已实现。 |
| 文件新建 / 重命名 / 删除 / 移动 | `complete` | Phase 2 工作区文件操作已交付。 |
| 文件监听与刷新 | `complete` | Tauri 侧已存在工作区监听能力。 |
| 多标签编辑 | `complete` | 已有标签栏和多文档会话。 |
| 最近文件 | `complete` | 已支持持久化、右键菜单移除/清空、无工作区时从侧边栏 Recent 列表继续打开、Finder 中定位文件，以及原生文件菜单中的"打开最近文件"子菜单（含清除最近文件功能）。 |
| 未保存变更提示 | `complete` | 已实现脏文档提示流程，并修复桌面窗口关闭时因缺少 `core:window:allow-destroy` capability 导致 `onCloseRequested` 无法完成原生关闭的问题；当前仅在用户取消退出时拦截原生关闭。 |
| 复制选区为 Markdown | `complete` | 编辑器复制已改为输出 Markdown 文本，支持全选复制后粘贴保留 Markdown 结构。 |
| 快速打开文件 (Cmd+P) | `not_started` | 模糊搜索当前工作区文件并快速打开。 |
| Wiki 链接 `[[page]]` | `not_started` | 笔记间互链跳转支持。 |

## 大纲与导航

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 文档大纲面板 | `complete` | 大纲侧边栏标签页已交付。 |
| 点击标题跳转 | `complete` | 大纲项可跳转到标题位置。 |
| 侧边栏分区切换 | `complete` | 已有 Files 与 Outline 标签切换。 |
| 大纲滚动同步 | `not_started` | 编辑器滚动时大纲自动高亮当前所在标题。 |

## 图片与资源

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 粘贴图片到文档 | `complete` | 图片会保存到文档旁的本地资源目录，并通过图片 node view 使用解析后的 `displaySrc` 渲染；Tauri 已启用本地 `asset` 协议和对应 `img-src` 放行，避免本地 Markdown 图片因 WebView 拒绝资源而显示失败。 |
| 拖拽图片到文档 | `complete` | 已支持拖放图片资源流程。 |
| 相对资源路径处理 | `complete` | 已统一修复编辑器与导出链路中的 Markdown 图片路径解析，支持绝对路径、相对路径、已编码 `%20` 路径以及包含空格和中文字符的本地图片地址。 |
| 插入图片对话框 / 命令 | `complete` | 已支持通过菜单或命令面板触发图片选择，并复用本地资源复制流程插入图片节点。 |

## 菜单、快捷键与命令

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 原生应用菜单 | `complete` | 已接入 Tauri 原生菜单，含 File/Edit/Paragraph/Format/View/Export。 |
| macOS 系统快捷键保留 | `complete` | 已避免自定义命令占用 `Cmd+Q`、`Cmd+H`、`Cmd+M`、`Cmd+Z` 等系统或原生编辑快捷键，并补齐 App / Window 菜单项。 |
| 命令面板 | `complete` | 命令面板 UI 与命令注册表已存在。 |
| 共享命令目录 | `complete` | 各入口已复用统一的 manifest/registry 命令 ID。 |
| 快捷键自定义 | `complete` | 偏好设置面板已支持录制和重置快捷键。 |
| 原生菜单到运行时桥接 | `complete` | 菜单事件已可转发到前端命令执行。 |
| 常用格式命令菜单覆盖 | `complete` | 粗体、斜体、行内代码、删除线、链接、清除格式、标题、查找前后跳转已接通。 |
| 段落/列表变换菜单覆盖 | `complete` | 引用、有序/无序列表、标题层级调整已完整接通到菜单、快捷键及命令面板。 |
| 下划线命令 | `not_started` | 已列出，但仍为禁用状态。 |

## 视图与效率

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 专注模式 | `complete` | 已交付。 |
| 侧边栏显示切换 | `complete` | 已交付。 |
| 命令面板快捷键 | `complete` | 快捷键与处理逻辑已存在。 |
| Files / Outline 聚焦命令 | `partial` | View 类命令 ID 已存在，但端到端行为仍需继续验证。 |
| 主题切换 | `complete` | 亮色/暗色双主题，通过 `Mod+Shift+L` 切换，持久化到 localStorage。 |
| 主题 CSS 变量系统 | `complete` | 基于 `:root` / `[data-theme="dark"]` 的 CSS 自定义属性体系，覆盖背景、文字、边框、阴影、代码块、高亮色等 40+ 变量。Editorial Paper 亮色主基调。 |
| 代码块/Mermaid 主题跟随 | `complete` | 代码高亮和 Mermaid 图表渲染随亮/暗主题自动切换配色。 |
| 系统主题自动跟随 | `not_started` | 根据系统 `prefers-color-scheme` 自动切换主题。 |
| 自定义主题 | `not_started` | 用户可通过 CSS 文件自定义主题外观，支持导入/导出主题配置。 |

## 导出

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 导出 HTML | `complete` | 已支持独立 HTML 导出。 |
| 导出 PDF | `complete` | 已支持 PDF 导出，README 中注明 macOS 浏览器依赖。已通过 Web Worker 将 PDF 渲染与序列化移到主线程外，避免导出大文档时冻结 UI；已修复表格、项目符号、序号列表和引用块的缩进渲染错位问题。 |
| 导出 Word | `complete` | 已支持导出 `.docx`；Mermaid 默认导出为 PNG 图片，可在导出保存面板中勾选是否额外导出 Mermaid 代码；Markdown 图片会解析为嵌入图片导出，表格会导出为带边框的 Word 表格，而不是保留 Markdown 文本；并已补齐 `word/numbering.xml` 的 content type 声明，避免 Word 打开时提示修复文档。本地 PNG/JPG/GIF/WebP 图片现已优先走文件系统字节读取并直接嵌入，不再依赖浏览器 `fetch` 或图片解码成功后才导出。 |
| 带语法高亮的 HTML 导出 | `partial` | 设计期望与编辑器高亮保持一致，当前仍需持续核对实现对齐情况。 |
| 导出图片 (PNG/JPEG) | `not_started` | 将当前文档渲染导出为图片。 |
| 导出 ePub | `not_started` | 电子书格式导出。 |
| 导出 LaTeX | `not_started` | LaTeX 源文件导出。 |
| Pandoc 集成 | `not_started` | 通过 Pandoc 扩展支持更多导出/导入格式。 |
| 复制为 HTML | `not_started` | 将编辑器选区复制为 HTML 格式到剪贴板。 |

## 稳定性与恢复

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 自动保存 | `complete` | 已有 autosave 模块。 |
| 崩溃恢复快照 | `complete` | 已有 Rust 侧恢复能力。 |
| 会话恢复流程 | `complete` | 前端与 Tauri 层均已接入恢复支持。 |

## 偏好设置

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 偏好设置对话框 | `complete` | 当前 `master` 已有基础设置面板。 |
| 统一 Settings Center | `complete` | 成功将 General、Shortcuts、AI 偏好设置合并到单一的统一设置中心（SettingsPanel），支持侧边栏切页及多语言本土化，并彻底清除了遗留的独立 AI 偏好设置面板及用例。 |
| 快捷键录制 UI | `complete` | 用户可录制与重置快捷键。 |
| 设置接入原生菜单 | `complete` | 可从原生菜单打开偏好设置。 |
| 国际化 | `complete` | 已支持 `en` / `zh-CN` 语言包、系统语言默认、手动切换、设置面板与侧边栏文案、本地命令与命令面板标签，以及 Tauri 原生菜单的即时切换。 |

## 应用外观与品牌

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 应用图标资源 | `complete` | 已修复图标透明圆角像素的白色 matte 污染，重新生成 Tauri 平台图标后，外角透明区域不再在缩放或系统显示中出现白角伪影。 |

## AI 辅助编辑

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| AI 配置与多 Provider 接入 | `partial` | 已有 AI 设置面板、Provider/Model 基础状态。已支持：模型选择（下拉+手动输入）、API Key 测试/保存/反馈（含 toast 提示）、文件持久化回退（keychain + JSON config）、全部 provider 的 key 检测（而非仅 active provider）。 |
| 选区 AI 改写 | `partial` | 已有 preset、context、toolbar、preview state，以及 `applySelectionRewrite` 完整流程；已修复 AI 返回 Markdown 被当作纯文本插入导致格式丢失的问题（改为通过 `parseMarkdown` → `replaceSelection` 插入，保留粗体/斜体/标题/列表等格式）。`keyConfigured` 现检查所有 provider 而不仅是当前激活 provider，设置面板关闭后会自动重检。 |
| 全文 AI 改写 | `partial` | 已有全文模式状态与命令入口，截断逻辑已实现；完整预览和应用流程仍待补齐。 |
| AGENTS.md / Skill 自动注入 | `partial` | 已有 AGENTS merge、skill 解析与匹配基础能力，并已接入 orchestrator 的 system prompt 组装。 |

## 项目工作流与 Skill

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 项目级 Refactor Skill | `complete` | 已新增 `skills/refactor-with-test-guard`，要求在重构前先检查现有测试覆盖，不足时先补测试，重构后再运行相关测试确认行为未破坏。 |

## 维护说明

- 该文档基于 `README.md`、当前已交付 UI/组件、命令清单以及进行中的实现计划整理。
- 某项功能状态变化时，应直接更新对应模块中的条目，而不是在别处追加零散备注。
