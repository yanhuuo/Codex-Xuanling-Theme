# Windows Changelog

## Unreleased

- Split theme package loading, validation, library catalogs, local theme creation, and pet binding from `scripts/injector.mjs` into `scripts/theme-package.mjs`; the injector now focuses on CDP connection, runtime injection, watch/reload, screenshots, and verification.
- Theme and pet cards now show sprite previews directly; duplicate installed theme directories with the same theme ID are deleted from the local store, preferring current bundled packages over legacy presets.
- Pet previews now follow Codex's 192×208 frame atlas layout (`1536×1872` v1 / `1536×2288` v2) instead of guessing a cropped grid.
- Pet selection now retries short-lived `config.toml` write races caused by Codex updating the same file.
- Theme cards now show the bound pet as an image-only control; clicking it opens a pet picker and writes the selected pet back to that theme package configuration.
- The theme manager no longer shows GitHub repository or external theme-library install forms; the page focuses on bundled themes, local custom themes, and pet bindings.
- Local custom themes can now set theme colors, which are written into the generated theme's own `theme.css`.
- Installed theme pet previews can fall back to `~/.codex/pets/<pet-id>` when an older global Dream Skin pet cache is missing or corrupt.
- Local custom colors now use preset swatches, transparent choices, and native color pickers instead of plain code fields.
- Local custom icons can be picked from a bundled default icon library or added manually by key with an SVG file.
- Background images now also accept GIF files through the manager, tray picker, and shared validation path.
- Shared runtime styles now theme Codex floating review/status pills, model menus, attachment/source pickers, and task hover cards through the common `--dream-*` variables.
- Token-based Codex review and summary surfaces (`bg-token-dropdown-background`, rounded token panels, thread summary slots) now inherit the shared floating surface palette.
- The right-side thread summary panel now has dedicated shared styles for its container, sticky headers, separators, item groups, and hoverable source/output rows.
- The Codex right app-shell sidebar (`right-panel`) now shares the chat page's immersive palette for its toolbar, sticky launcher header, quick-action option rows, hover states, text tokens, and shortcut key badges.
- Theme-store initialization now refreshes materialized bundled themes with the latest shared framework CSS/runtime instead of leaving an old active `theme.css` cached.
- Auto-heal Guard now restarts a normally launched Codex once per cooldown window to reopen it with the Dream Skin CDP endpoint; use `-NoRestartExisting` to keep the old manual-launch behavior.
- Tray status now shows the current endpoint/injector state plus recent Guard, injector, and error log lines instead of an empty status-only menu.
- Theme manager pet badges are smaller, and close controls now use a higher-layer full-button hit area with a decorative-only X so the whole tile hovers and closes.
- Theme manager close controls now also use coordinate-based hit testing so the whole button rectangle hovers/closes even if the SVG or inner layers receive the event target.
- Task main-surface side panels now treat large `bg-token-main-surface-*` regions as transparent/themed containers so right-side tool panes do not remain flat gray.
- Fixed the split theme-package module by importing `execFile`, preventing the injector from exiting when it installs or selects a bundled pet.
- Theme manager theme and pet previews are now lazy-loaded by ID, reducing initial page load size; the loading screen can be closed, and file-picker rows now keep labels/status on the left with actions on the right.
- Theme packages now use v4 single-manifest metadata: `theme.json` contains icons and install metadata; newly written themes no longer create separate `icons.json` or `install.json` files, while old v3 packages remain readable.

## 1.4.0 — 2026-07-23

- 修复主题渲染器版本与注入器版本强绑定导致的验证失败和反复重启；验证改用框架自有协议标记。
- 自动修复守护不再传递强制重启权限；普通 Codex 会话只提示手动启动，连续三次修复失败后自动熔断。
- 主题包升级到 v3：每个主题拥有声明式 `install.json` 和独立 `icons.json`，公共引擎不再内置主题图标。
- 宠物包移动到项目根目录 `pets/`，主题只通过 ID 绑定；稳定运行目录安装器同步复制根目录宠物库。
- 默认主题由各主题的安装清单声明并自动发现，移除 PowerShell 与 Node 加载器中的玄翎目录硬编码。
- 修复新版 Codex 使用 `div.animate-spin` 时父级透明度把主题执行动画一起隐藏的问题。
- 新增本地自定义主题另存：可选择背景图片并用本机 `icons.json` 覆盖图标，生成主题标记为仅本地。
- 新增 TypeScript 构建，主题管理器以 `windows/src/theme-manager.ts` 维护并编译为运行时 JS。
- 本地自定义入口改为主题卡片与弹窗，支持选择背景、逐项选择 SVG 图标或导入 `icons.json`。
- 重构本地主题弹窗为固定头尾、内容滚动的分区布局；全部图标改为带真实预览、名称、键名和覆盖来源的独立表单项。
- 将玄翎与蕾米埃尔重复的设置页适配、布局、动画和渲染逻辑提取到公共框架；主题目录只保留色板和资源配置。
- Codex 全部设置页面现在继承当前主题的背景、半透明面板、边框、输入框和强调色。

## 1.3.4 — 2026-07-17

- 重绘玄鸟小图标：移除容易被看成双腿的分叉线条，改为向后收束的三片实心尾羽，并补充头翎轮廓。
- 修复 GitHub 初始发布中的中文根目录文件名编码，仓库改用真实中文安装与说明文件名。

## 1.3.3 — 2026-07-17

- 新任务插入侧栏后延迟到路由稳定窗口再刷新图标，避免与页面创建争用主线程；侧栏文字读取改用不触发布局的 `textContent`。
- 缓存未变化的主题颜色与构图变量，移除周期性的全页 SVG 兜底扫描，并把低频维护周期从 10 秒降至 30 秒。
- 任务背景移除大面积实时蒙版，旋转玄鸟移除逐帧阴影滤镜并独立合成，降低拖动窗口时的 GPU 重绘负担。

## 1.3.2 — 2026-07-17

- 输入区主操作按钮统一为玄鸟状态图标：可发送时显示静止玄鸟，任务进行中显示玄鸟沿中心圆环飞行；按钮仍保留原生发送与停止语义。

## 1.3.1 — 2026-07-17

- 将侧栏、输入框和加载动画拆分为独立更新区，输入或消息流更新不再扫描全部侧栏按钮。
- MutationObserver 只响应结构变化，忽略输入文本和消息正文的深层变化，降低任务页与返回主页时的主线程占用。
- 修复拆分扫描区后输入框主题图标函数的作用域错误，并验证文件监听可直接热重载修复版。

## 1.3.0 — 2026-07-17

- 主题改为完整 v2 文件夹代码包，CSS、渲染脚本、图标、动画和图片随主题一起切换并在切换前清理旧实例。
- 新增独立 `设置 → 主题` 页面、公开 GitHub 仓库安装、HTTPS/本地主题库、官方外观暂停恢复和稳定运行目录一键安装器。
- 新增活动主题与主题管理页文件监听热重载；保存后等待约 120 ms 稳定窗口再校验注入，失败时保留最后一个可用主题。
- 新增 Codex 原生 v2 宠物发现和按主题关联，不复制或覆盖 `~/.codex/pets` 中的用户宠物。
- 输入区的添加、权限、听写和发送控件加入玄鸟/苍羽主题图标与交互色。
- 首页切换不再使用全窗口关系选择器；路由状态改由渲染器 class 驱动，DOM 调度改为 48 ms 节流并按脏标记更新图标，减少返回主页卡顿。
- 新增 Store 更新自动恢复守护、一键官方外观还原、完整恢复与主题工具原位升级流程。

## 1.2.0 — 2026-07-17

### 新增

- 渲染层支持通用自适应图像主题：本地 Canvas 采样图像亮度、主色、焦点和比例，为壁纸层提供自适应色彩与构图建议；支持 `appearance: auto | light | dark`、`art.focusX/focusY`（`0..1`）、`art.safeArea: auto | left | right | center | none`、`art.taskMode: auto | ambient | banner | off`。外观壳仍由显式主题或原生外观信号决定。
- 显式外观与艺术元数据优先于分析结果；超宽图默认任务横幅，普通比例图默认环境背景，`off` 可关闭任务页图像。分析完全在渲染器本地完成，不上传图片。
- Windows 发行 payload 直接读取受管 `theme.json`，完整支持与 macOS 一致的外观、焦点、安全区和任务页模式契约，不再依赖预先设置的 renderer 全局变量。
- 新增纯 PowerShell/Windows Forms 系统托盘入口，可快速查看状态、应用或暂停皮肤、更换背景、保存和切换主题、打开图片文件夹，以及执行完整恢复；不引入第三方依赖。
- 新增 `%LOCALAPPDATA%\CodexDreamSkin` 主题仓库，用户图片会复制到受管目录，活动主题和已保存主题均保持图片与配置自包含。
- Windows 首次安装会把 UI-free 的 2560 × 1440「桥本有菜」设为活动主题并播种到「已保存主题」，无需再从 macOS 目录手动导入。

### 修复

- 渲染层现在只在检测到完整 Codex 主界面壳层时启用皮肤；宠物等透明辅助窗口会主动清理主题背景与装饰节点，避免出现遮挡宠物的矩形背景框。
- 16:9 及更宽图像现在作为侧栏与主区共享的单张整窗背景；首页、任务、插件、计划任务和 Pull Requests 路由使用同一透明顶栏与连续表面，不再在卡片或任务层重复裁切图片。
- 移除主区原生顶部渐隐和 composer 后方底部渐隐；浅色与深色 composer 均只保留一个可读表面，避免出现双层输入框或不连续底板。
- watcher 可在不重启 Codex 的情况下响应主题文件和暂停标记变化，重载 renderer 后仍保持当前应用或暂停状态。
- watcher 会为已连接的 renderer 注册带 generation 检查的 early payload；后续 reload/navigation 优先在新文档建立皮肤，CDP 不支持时仍保留 load-event 兜底注入。
- watcher 改用主题 JSON 与图片字节的 SHA-256 修订值识别热更新，并以轻量 stat 快速路径配合 30 秒强哈希审计，避免每 1.2 秒重读整张图片；同步读取图片尺寸后再构建首帧 payload，避免宽屏主题先以错误比例闪现。
- 主题导入与注入均拒绝空图片和超过 16 MB 的图片；注入前还会拒绝任一边超过 16384px 或总像素超过 50MP 的声明尺寸，降低压缩炸弹风险。完整恢复会终止托盘进程，暂停菜单使用独立闭包值，避免旧托盘重新应用皮肤或连续点击状态反转错误。
- 托盘导入新背景时会重置为 `auto` 焦点、安全区、任务模式和外观，不再错误继承上一张预设的人物位置；从「已保存主题」切换时仍保留该主题的显式元数据。
- PowerShell 主题仓库除词法路径包含检查外，还会逐级拒绝 junction、符号链接等 reparse point；已保存主题不能借链接逃出受管目录。
- 主题仓库会在创建受管目录以及关键图片复制/移动的前后拒绝 reparse point，暂停标记写入前也会检查路径；状态文件仍写入受管根目录并使用 UTF-8 原子替换。导入在复制前复用 Node 图片元数据解析器拒绝超过 16384px 或 50MP 的图片。
- `appearance: auto` 优先读取原生计算后的 `color-scheme`，只有缺少可信原生信号时才回退到系统 `prefers-color-scheme`；横幅任务页与环境任务页共用连续整窗壁纸，不再单独截一块图。
- 启动会先完成 state 校验和重启确认，再清除暂停标记；取消重启提示或遇到校验失败时，已有的暂停 watcher 会继续保持暂停。
- 原生 `color-scheme` 采样会抑制并排空临时 class 变更产生的 observer 记录，不再每约 180ms 自触发一次完整 renderer ensure。
- 安装不再把用户的 `appearanceTheme` 强制改成 `light`；检测到旧版精确托管的浅色三元组时才按已有备份安全迁移，当前安装的恢复也不会覆盖用户后来选择的外观。
- `--verify`、`--once` 和 `--remove` 现在显式把预期 Browser ID 传入一次性目标发现，不再因引用越域的 CLI 变量而等待超时并导致启动验证回滚。
- 记录中的 injector PID 若仍存活但身份不匹配，启动与恢复会保留 state 并中止，不再归档后继续操作未知进程。
- 安装与 `-RestoreBaseTheme` 现在严格按 UTF-8 读取，保留原换行风格，并以无 BOM、同目录原子替换方式写回 `config.toml`，避免中文项目名称乱码或导致 Codex 无法启动。
- 遇到带 BOM/无 BOM 的 UTF-16、NUL 字符、无效 UTF-8 或写入期间被其他程序改动的配置时停止修改，不再静默转码或覆盖较新的内容。
- 安装会在当前注册包或 state 记录的旧 Codex 仍运行时明确提示先关闭；配置临时文件写完后会在原子替换前再次核对原始字节，进一步缩小并发覆盖窗口。
- 配置恢复只修改 `[desktop]` 内的外观键，不再误碰其他 section 的同名配置；新增 `-RecoverConfigBackup` 用于显式恢复安装前原始文件，并先保存当前文件。
- 完成配置恢复后会归档本轮安装前备份，使下一次安装重新保存当时的配置，避免重复安装使用过期主题值。
- schema 3 记录的旧 injector PID 只有在 Node 精确路径、脚本命令行、端口、Browser ID 和进程启动时间匹配时才会停止；兼容旧 state 时仍要求原 state 含脚本路径和端口，且 PID 仍匹配 `node.exe`、脚本与 watch 参数，无法确认便归档而不结束进程。
- 启动验证失败会停止 injector、清理状态，并把本次新开的 Codex 恢复为无调试口的普通启动。
- Restore 使用状态中记录的端口，先关闭运行态再写配置；失败时保留 state 并尽量正常重开 Codex，不再留下半完成状态或静默报告假成功。
- Store 更新后若旧版本仍持有已保存的 CDP，会按 state 中的精确路径关闭；检测到新旧版本同时运行时安全停止并提示人工处理。
- 支持带注释或引号的 `[desktop]` 表头与目标键；遇到转义同义键、多行字符串/数组、dotted key 或重复目标键时会在写入前明确停止，避免把合法但无法安全行编辑的 TOML 改坏。
- Store 更新后的旧路径只有在 Appx full name、family name、安装目录和可执行文件仍能与系统注册包匹配时才允许自动关闭；无法证明归属时保留状态并要求手动关闭。
- Store 更新时，仍在运行且身份有效的旧版本 CDP 会直接热重应用；旧版本若未开启 CDP，则在获得现有重启授权后关闭并启动当前注册版本，避免并行打开两个 Codex。
- 遇到 `[desktop.*]` 子表时会在写配置前停止，避免外观标量键与 TOML 子表冲突；热重应用验证失败时会尽力移除本次残余样式。
- Restore 不再要求当前环境仍能找到 Node；schema 3 清理会严格匹配安装时记录的 Node 路径，Node 已升级或卸载也不影响安全恢复。

### 安全

- Codex 以 `--remote-debugging-address=127.0.0.1` 启动；同时校验监听 PID 对应精确的官方 Store 可执行文件。
- 说明：loopback 可阻止局域网访问，但 CDP 不验证同一 Windows 用户下的其他本地进程；不用皮肤时建议执行 Restore 关闭调试会话。
- Appx 发现要求 `SignatureKind=Store` 且不是 development mode，同名开发包或侧载包不会被当作官方 Codex 启动或关闭。
- injector 只连接相同端口、page ID 与路径一致的 loopback WebSocket，并在注入前确认真实 Codex shell DOM 标记。
- watcher 绑定启动时的 CDP Browser ID，并持续持有 Browser WebSocket 作为身份锚；原浏览器关闭或端口被复用时直接退出，不会连接到新端点。
- CDP HTTP、WebSocket 建连与命令均加入超时，HTTP 探测拒绝重定向，异常目标不会无限挂起或把探测带离 loopback。
- injector 日志与验证文件不再记录窗口标题、页面路由、页面文本或被拒绝 URL 的内容，只保留临时 target ID、结构标记和布局结果。
- 快捷方式不再静默携带 `-RestartExisting`；需要重启时先向用户确认。
- install、start、restore 和 verify 使用当前用户互斥锁，避免双击或并发命令竞争端口、配置和 state。

### 改进

- 默认端口被占用时自动在后续 100 个端口内选择空闲端口；显式指定的冲突端口仍安全失败。
- injector 会等待首轮注入完成再判定启动成功；目标异常时使用有上限的指数退避和限频日志，减少后台唤醒和日志膨胀。
- 明确要求 Node.js 22 或更新版本，并记录 `process.execPath`，兼容 PATH 中的启动转发程序。
- 带空格或结尾反斜杠的测试 profile 路径现在按 Windows 命令行规则引用。

### 测试

- 增加渲染层辅助窗口与 early-bootstrap 回归测试，覆盖主窗口正常注入、透明辅助窗口清理残余样式、shell guard、generation 切换、computed-scheme observer 排空，以及辅助目标随后成为完整主界面时可重新启用皮肤。
- 增加本地 HTTP/CDP fixture，逐项执行 `--verify`、`--once` 和 `--remove`，确认一次性目标发现会校验 Browser ID 且不再访问未定义变量。
- 增加受管主题初始化、换图、保存、切换、暂停标记、payload 配置嵌入、整窗 CSS 和托盘菜单静态回归检查。
- 增加中文项目路径、CRLF/LF、UTF-16 与歧义 TOML 拒绝、并发写检测、section 隔离、精确恢复、Appx/state 身份、状态归档、payload 构造、Browser ID 和不安全 CDP URL 的回归检查。
