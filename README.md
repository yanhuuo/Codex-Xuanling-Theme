# Codex Xuanling Theme

Codex Desktop 独立主题管理工具，并内置玄翎与蕾米埃尔主题。设置页适配、布局、加载动画和 DOM 注入由公共主题框架统一维护；主题目录只配置色板、背景、文案、图标和宠物绑定。宠物统一存放在仓库根目录 `pets/`。

> 非 OpenAI 或库洛游戏官方项目。主题壁纸为原创同人视觉，不包含官方安装包或官方二进制文件。

## 一键安装

下载仓库后双击 `安装主题工具.cmd`。安装器会：

- 将运行文件复制到 `%LOCALAPPDATA%\CodexDreamSkin\runtime`；
- 只安装 `设置 → 主题` 管理页，首次启动保持 Codex 官方外观；
- 玄翎及其他主题均在主题页中点击“安装主题”，随后再启用；
- 创建桌面和开始菜单的 `Codex 主题` 入口；
- 首次启用时明确询问是否重启正在运行的 Codex；
- 安装自动恢复守护，在 Microsoft Store 更新后重新匹配已注册的 Codex 包；
- 保留 `设置 → 主题 → 还原官方外观` 和桌面完整恢复入口。

安装器不修改 `WindowsApps`、`app.asar` 或 Codex 官方文件，只连接 `127.0.0.1` 上的本机 CDP 会话。

## 主题目录

```text
windows/themes/鸣潮 秧秧·玄翎/
├─ install.json
├─ theme.json
├─ theme.css
├─ icons.json
└─ background.jpg

windows/engine/
├─ theme-base.css
└─ theme-runtime.js

pets/
└─ yangyang-xuanling-official-drum-r3/
   ├─ pet.json
   └─ spritesheet-official-drum-r3.webp
```

玄翎主题会携带当前在“主题”页选择的 Codex v2 宠物。仓库或本地主题库换机安装后，启用主题会自动安装并选中同一只宠物；当前仓库默认携带 `秧秧·玄翎（官鼓连续版 R3）`。

每个主题通过 `theme.json.framework` 继承公共框架，并在自己的 `theme.css` 与 `icons.json` 中保存主题差异。安装时会物化为可独立启用的本地包。详细格式见 [`windows/THEME_FORMAT.md`](windows/THEME_FORMAT.md)。

主题列表包含“本地自定义主题”卡片。点击后可在分区弹窗中选择背景图片；所有基础图标会以独立表单项显示真实预览，可逐项选择 SVG，也可导入完整/部分 `icons.json` 并即时查看覆盖结果。生成结果只保存在 `%LOCALAPPDATA%\CodexDreamSkin\themes`，不会写入 `theme-library.json` 或上传到远程仓库。

## 热重载

注入器会监听当前活动主题的清单、CSS、JS、`icons.json` 和图片。保存文件后会在约 120 ms 的稳定窗口后重新校验并注入，无需重启 Codex；文件监听不可用时自动回退到轮询校验。主题管理页自身也支持热重载。

## GitHub 主题仓库

仓库根目录的 [`theme-library.json`](theme-library.json) 是主题索引。在 Codex 的 `设置 → 主题 → 从 GitHub 仓库安装` 中粘贴本仓库 URL，即可读取并安装主题。仅支持公开 HTTPS GitHub 仓库，远程主题包含可执行 JS，请只添加可信来源。

## 主题宠物

主题页会读取 `~/.codex/pets` 下符合 `spriteVersionNumber: 2` 的 Codex 原生宠物包。选择后主题只保存宠物 ID 绑定；仓库附带的宠物包统一位于项目根目录 `pets/`，不会嵌套进任何主题目录。

## 开发与验证

```powershell
npm install
npm test
```

主题管理器源码位于 `windows/src/theme-manager.ts`，编译结果写入运行时使用的 `windows/engine/theme-manager.js`。PowerShell 安装、恢复和进程控制脚本继续保留 PowerShell；Node 注入器可按同一方式逐步迁移，不要求最终用户安装 TypeScript。

更多使用说明见 [`使用说明.md`](使用说明.md)。

## 致谢与许可

底层方案参考 [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin)，本仓库代码按 [`LICENSE`](LICENSE) 提供。Codex、鸣潮、秧秧及相关名称和角色权利归各自权利人所有。
