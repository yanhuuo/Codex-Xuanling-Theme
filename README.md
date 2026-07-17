# Codex Xuanling Theme

《鸣潮》秧秧·玄翎风格的 Codex Desktop 主题工具。主题、图标、加载动画和页面适配均封装在独立主题目录中；公共引擎只负责安全加载、主题仓库、热重载、宠物关联和恢复官方外观。

> 非 OpenAI 或库洛游戏官方项目。主题壁纸为原创同人视觉，不包含官方安装包或官方二进制文件。

## 一键安装

下载仓库后双击 `安装主题工具.cmd`。安装器会：

- 将运行文件复制到 `%LOCALAPPDATA%\CodexDreamSkin\runtime`；
- 创建桌面和开始菜单的 `Codex 主题` 入口；
- 首次启用时明确询问是否重启正在运行的 Codex；
- 安装自动恢复守护，在 Microsoft Store 更新后重新匹配已注册的 Codex 包；
- 保留 `设置 → 主题 → 还原官方外观` 和桌面完整恢复入口。

安装器不修改 `WindowsApps`、`app.asar` 或 Codex 官方文件，只连接 `127.0.0.1` 上的本机 CDP 会话。

## 主题目录

```text
windows/themes/yangyang-xuanling-official-v2/
├─ theme.json
├─ theme.css
├─ theme.js
└─ background.jpg
```

每个主题是完整、互相隔离的代码包。详细格式见 [`windows/THEME_FORMAT.md`](windows/THEME_FORMAT.md)。

## 热重载

注入器会监听当前活动主题的 `theme.json`、CSS、JS 和图片。保存文件后会在约 120 ms 的稳定窗口后重新校验并注入，无需重启 Codex；文件监听不可用时自动回退到轮询校验。主题管理页自身也支持热重载。

## GitHub 主题仓库

仓库根目录的 [`theme-library.json`](theme-library.json) 是主题索引。在 Codex 的 `设置 → 主题 → 从 GitHub 仓库安装` 中粘贴本仓库 URL，即可读取并安装主题。仅支持公开 HTTPS GitHub 仓库，远程主题包含可执行 JS，请只添加可信来源。

## 宠物关联

主题页会读取 `~/.codex/pets` 下符合 `spriteVersionNumber: 2` 的 Codex 原生宠物包，并允许为当前主题记录配套宠物。宠物精灵图仍由 Codex 原生宠物窗口加载和渲染，不注入主题 CSS，也不复制用户已有宠物。

## 开发与验证

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\tests\run-tests.ps1
```

更多使用说明见 [`使用说明.md`](使用说明.md)。

## 致谢与许可

底层方案参考 [Fei-Away/Codex-Dream-Skin](https://github.com/Fei-Away/Codex-Dream-Skin)，本仓库代码按 [`LICENSE`](LICENSE) 提供。Codex、鸣潮、秧秧及相关名称和角色权利归各自权利人所有。
