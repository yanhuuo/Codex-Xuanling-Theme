# Dream Skin 主题配置包 v3

每个主题必须是一个独立文件夹。通用布局、设置页适配、DOM 注入和动画由 `engine/theme-base.css` 与 `engine/theme-runtime.js` 统一提供；主题目录只保存自己的色板覆盖、图标、图片、文案和宠物绑定。

```text
my-theme/
├─ install.json
├─ theme.json
├─ theme.css
├─ icons.json
└─ background.jpg

项目根目录/pets/
└─ my-pet/
   ├─ pet.json
   └─ spritesheet.webp
```

`install.json` 是主题自己的声明式安装清单，公共安装器不会执行主题目录中的 PowerShell：

```json
{
  "schemaVersion": 1,
  "default": false,
  "manifest": "theme.json",
  "files": ["theme.json", "theme.css", "icons.json", "background.jpg"],
  "pets": ["my-pet"]
}
```

最小 `theme.json`：

```json
{
  "schemaVersion": 3,
  "id": "my-theme",
  "name": "我的主题",
  "version": "1.0.0",
  "framework": {
    "id": "dream-skin",
    "version": 1
  },
  "entrypoints": {
    "css": "theme.css",
    "icons": "icons.json"
  },
  "brandIcon": "bird",
  "image": "background.jpg",
  "pet": {
    "id": "my-pet"
  },
  "appearance": "dark",
  "art": {
    "focusX": 0.5,
    "focusY": 0.5,
    "safeArea": "center",
    "taskMode": "ambient"
  },
  "palette": { "accent": "#6edaf2" }
}
```

`icons.json` 是由图标名到完整 SVG 字符串的对象；`brandIcon` 指向其中用于品牌标志、发送按钮和加载动画的图标。主题自己的 `theme.css` 只设置主题变量，例如：

```css
:root.codex-dream-skin {
  --dream-brand-suffix: " · 我的主题";
  --dream-detail: #d9b85f;
  --dream-send-base: #17395b;
  --dream-processing-base: #143653;
  --dream-surface: color-mix(in oklab, #182330 94%, var(--dream-accent));
}
```

加载器会把公共 CSS、公共渲染器与主题配置合并；安装到本机主题库时会物化为带 `theme.css`、`theme.js` 和 `icons.json` 的独立运行包。旧式自包含主题仍可声明自己的 `entrypoints.renderer`，但内置和新建主题应优先使用公共框架。

旧式主题脚本会在 Codex 渲染器中执行，主题 CSS 与 SVG 也会经过加载。只安装你信任的本地或 HTTPS 主题库。

## 主题宠物

主题页从 `~/.codex/pets` 读取有效的 v2 宠物。选择后，主题只在 `theme.json.pet.id` 中保存绑定关系；仓库附带的宠物包保存在项目根目录 `pets/<id>/`。主题通过本地库或 GitHub 换机安装并启用时，会从独立宠物目录安装同一宠物到新主机的 `~/.codex/pets`，并同步 Codex 的 `desktop.selected-avatar-id`。

只接受 `spriteVersionNumber: 2`、`1536×2288` WebP 图集的标准宠物包。解除主题宠物绑定不会删除 `~/.codex/pets` 中原有宠物，也不会删除独立宠物库中的包。

## GitHub 仓库索引

公开主题仓库可在根目录提供 `theme-library.json`：

```json
{
  "schemaVersion": 1,
  "themes": [
    {
      "id": "theme-id",
      "name": "主题名",
      "themeUrl": "themes/theme-id/theme.json",
      "previewUrl": "themes/theme-id/background.jpg"
    }
  ]
}
```

相对 URL 会以 Raw 索引地址为基准解析。主题页的一键仓库入口只接受公开的 HTTPS GitHub 仓库。

## 本地自定义主题

主题列表中的“本地自定义主题”卡片会打开设置弹窗。用户可选择基础主题与背景图片、逐项选择 SVG 图标，或导入另一个 `icons.json` 覆盖部分或全部同名图标。生成的清单带有 `"localOnly": true`，只写入 `%LOCALAPPDATA%\CodexDreamSkin\themes/<local-id>/`。本地主题不会自动加入仓库索引，也不会上传或复制到远程主题库。

## TypeScript 源码

主题管理器的维护源码是 `windows/src/theme-manager.ts`，通过根目录 `tsconfig.json` 编译为 `windows/engine/theme-manager.js`。发布包携带编译结果，因此用户安装时不依赖 npm。公共渲染器位于 `windows/engine/theme-runtime.js`；主题无需再复制渲染脚本。旧式独立渲染器仍使用四占位符协议。
