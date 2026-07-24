# Codex Xuanling Theme

一个面向 Codex Desktop 的 Dream Skin 主题框架。它不修改 `WindowsApps`、`app.asar` 或 Codex 官方文件，而是通过本机 Chromium DevTools Protocol 注入可恢复的外观层。

内置能力：

- 一键安装主题管理工具
- 在 Codex 设置页新增“主题”入口
- 安装/启用内置主题
- 创建本地自定义主题
- 绑定 Codex 原生 v2 宠物
- 热重载当前主题
- 一键恢复官方外观

> 非 OpenAI 官方项目。主题壁纸与视觉资源为同人/自定义视觉，请勿把官方安装包或官方二进制文件放入本仓库。

## 给 AI 的快速任务索引

如果你是 AI 助手，要根据用户意图选择这些路径：

| 用户意图 | 应执行/阅读 |
| --- | --- |
| 一键安装或重新安装 | 运行 `安装主题工具.cmd`，或等价调用 `windows/scripts/install-dream-skin.ps1` |
| 启动已安装皮肤 | `windows/scripts/start-dream-skin.ps1` |
| 恢复官方外观 | `windows/scripts/restore-dream-skin.ps1` |
| 验证安装是否正常 | `npm test`；运行中验证可用 `windows/scripts/verify-dream-skin.ps1` |
| 制作新主题 | 复制 `windows/themes/鸣潮 秧秧·玄翎` 或 `windows/themes/绝区零 蕾米埃尔`，按 `windows/THEME_FORMAT.md` 改 `theme.json/theme.css/background.jpg` |
| 添加/修改图标 | 修改主题目录下 `icons/*.svg` 源文件，并同步到 `theme.json.icons`；不要再新建独立 `icons.json` |
| 自定义发送/执行中/加载动图 | 设置 `theme.json.icons.send`、`theme.json.icons.processing`、`theme.json.icons.spinner`，或显式指定 `sendIcon/processingIcon/spinnerIcon` |
| 设置默认内置主题 | 在对应主题 `theme.json.install.default` 设为 `true`，确保只有一个内置主题为 `true` |
| 添加宠物 | 放到项目根目录 `pets/<pet-id>/pet.json` 和 `spritesheet.webp`，主题中只写 `theme.json.pet.id` |

## 一键安装

下载或克隆仓库后，双击：

```text
安装主题工具.cmd
```

安装器会：

- 复制运行文件到 `%LOCALAPPDATA%\CodexDreamSkin\runtime`
- 在 Codex 设置页添加“主题”管理入口
- 保持 Codex 首次启动时的官方外观，不会默认强行套主题
- 创建桌面/开始菜单入口
- 安装更新守护逻辑：Codex 更新后自动匹配；如果你从普通 Codex 入口打开，守护进程会按冷却间隔自动重启一次并接入 Dream Skin
- 保留“还原官方外观”和完整恢复入口

如果 Codex 已经打开，启动脚本会询问是否重启。开机 Guard 默认会自动接管“普通方式打开的 Codex”；需要禁用这个行为时，可用 `guard-dream-skin.ps1 -NoRestartExisting` 启动守护。

## 常用命令

```powershell
# 安装/更新
powershell -NoProfile -ExecutionPolicy Bypass -File windows/scripts/install-dream-skin.ps1

# 启动皮肤
powershell -NoProfile -ExecutionPolicy Bypass -File windows/scripts/start-dream-skin.ps1

# 验证运行状态
powershell -NoProfile -ExecutionPolicy Bypass -File windows/scripts/verify-dream-skin.ps1

# 恢复官方外观
powershell -NoProfile -ExecutionPolicy Bypass -File windows/scripts/restore-dream-skin.ps1

# 开发测试
npm install
npm test
```

## 主题目录结构

新主题格式是 v4，主题配置集中在单个 `theme.json`：

```text
windows/themes/<theme-name>/
├─ theme.json
├─ theme.css
├─ icons/
│  ├─ bird.svg
│  └─ send.svg
└─ background.jpg

pets/<pet-id>/
├─ pet.json
└─ spritesheet.webp
```

不要再为新主题创建独立 `icons.json` 或 `install.json`：

- 运行时图标写入 `theme.json.icons`
- 图标 SVG 原文件保存在主题自己的 `icons/` 文件夹下
- 安装信息写入 `theme.json.install`
- 宠物只在 `theme.json.pet.id` 中绑定 ID

详细字段见 [windows/THEME_FORMAT.md](windows/THEME_FORMAT.md)。

## 制作一个新主题

最稳的做法：

1. 复制一个内置主题目录，例如：

   ```text
   windows/themes/鸣潮 秧秧·玄翎
   ```

2. 改目录名，例如：

   ```text
   windows/themes/我的主题
   ```

3. 替换背景图，建议：

   - PNG/JPG/WebP/GIF
   - 小于 16 MB
   - 不要把窗口、侧边栏、按钮、文字 UI 烘焙进图片

4. 修改 `theme.json`：

   - `id`
   - `name`
   - `author`
   - `version`
   - `image`（实际应用背景）
   - `previewImage`（可选，主题页卡片预览）
   - `defaultImage` / `images`（单图也放进列表；多图可定时轮换）
   - `display`（背景适配、位置、平铺和轮换）
   - `files`（主题包静态资源；不再手写长串 `install.files`）
  - `palette.accent`
  - `icons`，并同步维护 `icons/*.svg` 源文件
  - `sendIcon` / `processingIcon` / `spinnerIcon`（可选）
  - `pet.id`
   - `install.files`

5. 修改 `theme.css` 中的主题变量。

6. 运行：

   ```powershell
   npm test
   ```

7. 重新安装或刷新运行时。

## 本地自定义主题

Codex 的“设置 → 主题”页里有“本地自定义主题”卡片。它会在本机创建主题，不写回 GitHub，也不会加入远程主题库。

支持：

- 选择背景图
- 选择基础主题
- 配置主题色
- 从默认图标库选择图标
- 上传单个 SVG 图标
- 导入一个 `icons.json` 作为输入来源

注意：导入的 `icons.json` 只是输入格式；生成结果会合并进 `theme.json.icons`，不会保留独立 `icons.json` 文件。

## 宠物规则

宠物按 Codex 官方的独立资源思路管理：

- 宠物包放在项目根目录 `pets/`
- 主题只绑定宠物 ID
- 管理页从本机 `~/.codex/pets` 按需读取宠物预览
- 解除主题宠物绑定不会删除用户已有宠物

当前只接受 Codex v2 宠物：

- `spriteVersionNumber: 2`
- `1536×2288`
- WebP spritesheet

## 开发结构

```text
windows/src/theme-manager.ts      # 主题管理页源码
windows/engine/theme-manager.js   # 编译后的管理页运行文件
windows/engine/theme-runtime.js   # 公共渲染器
windows/engine/theme-base.css     # 公共 CSS 框架
windows/scripts/theme-package.mjs # 主题包读取/写入/校验/本地主题创建
windows/scripts/injector.mjs      # CDP 连接、注入、热重载
windows/scripts/theme-windows.ps1 # Windows 主题库和安装流程
windows/THEME_FORMAT.md           # 主题包 v4 格式
```

## 安全边界

- 不修改 Codex 官方安装目录
- 不接管 `WindowsApps`
- 不修改 `app.asar`
- 只连接本机 `127.0.0.1` CDP
- 所有主题图片、SVG、脚本入口都有大小和路径校验
- managed store 写入会拒绝 junction/reparse point
- `config.toml` 使用 UTF-8 原子写入，检测并重试并发修改

## 许可证与致谢

底层方案参考 [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin)。本仓库代码按 [LICENSE](LICENSE) 提供。Codex、鸣潮、秧秧及相关名称和角色权利归各自权利人所有。
