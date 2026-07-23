# Dream Skin 主题配置包 v4

每个主题仍然是一个独立文件夹，但主题的自描述信息统一放在 `theme.json`。新格式不再要求额外的 `install.json` 或 `icons.json`。

```text
my-theme/
├─ theme.json
├─ theme.css
└─ background.jpg

项目根目录 pets/
└─ my-pet/
   ├─ pet.json
   └─ spritesheet.webp
```

最小 `theme.json`：

```json
{
  "schemaVersion": 4,
  "id": "my-theme",
  "name": "我的主题",
  "version": "1.0.0",
  "framework": {
    "id": "dream-skin",
    "version": 1
  },
  "entrypoints": {
    "css": "theme.css"
  },
  "brandIcon": "bird",
  "sendIcon": "send",
  "processingIcon": "processing",
  "spinnerIcon": "spinner",
  "image": "background.jpg",
  "pet": {
    "id": "my-pet"
  },
  "install": {
    "default": false,
    "files": ["theme.json", "theme.css", "background.jpg"],
    "pets": ["my-pet"]
  },
  "icons": {
    "bird": "<svg viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
  },
  "appearance": "dark",
  "art": {
    "focusX": 0.5,
    "focusY": 0.5,
    "safeArea": "center",
    "taskMode": "ambient"
  },
  "palette": {
    "accent": "#6edaf2"
  }
}
```

`install` 是主题自己的声明式安装信息。公共安装器只复制 `install.files` 里列出的受控文件，不执行主题目录中的 PowerShell。内置主题集合用 `install.default: true` 选择默认主题。

`icons` 是由图标名到完整 SVG 字符串的对象。SVG 会做基础安全校验：不允许脚本、事件属性或 `javascript:` URL。

常用语义图标：

- `brandIcon`：主题品牌标志。
- `sendIcon`：发送按钮图标；未设置时优先使用 `icons.send`，再回退到品牌图标。
- `processingIcon`：执行中按钮动图；未设置时优先使用 `icons.processing`，再回退到品牌图标。
- `spinnerIcon`：页面加载/执行中的转圈标记；未设置时优先使用 `icons.spinner`，再回退到 `processingIcon`。

本地自定义弹窗会固定展示 `send`、`processing`、`spinner` 等核心槽位，即使基础主题没有这些图标，也可以从默认图标库选择或上传 SVG。

主题自己的 `theme.css` 只设置变量，例如：

```css
:root.codex-dream-skin {
  --dream-brand-suffix: " · 我的主题";
  --dream-detail: #d9b85f;
  --dream-send-base: #17395b;
  --dream-processing-base: #143653;
  --dream-surface: color-mix(in oklab, #182330 94%, var(--dream-accent));
}
```

加载器会把公共 CSS、公共渲染器与主题配置合并。安装到本机主题库时会物化为带 `theme.css`、`theme.js`、背景图和单个 `theme.json` 的独立运行包；图标和安装信息仍保存在 `theme.json` 内。旧式 v3 主题仍兼容读取 `entrypoints.icons`、`icons.json` 和 `install.json`，但新建和保存的主题都会写成 v4。

## 主题宠物

主题页从 `~/.codex/pets` 读取有效的 Codex v2 宠物。主题只在 `theme.json.pet.id` 中保存绑定关系；仓库附带的宠物包保存在项目根目录 `pets/<id>/`。安装并启用主题时，会从独立宠物目录安装同一宠物到新主机的 `~/.codex/pets`，并同步 Codex 的 `desktop.selected-avatar-id`。

只接受 `spriteVersionNumber: 2`、`1536×2288` WebP 图集的标准宠物包；每帧按 Codex atlas 规则为 `192×208`，即 `8×11` 帧。解除主题宠物绑定不会删除 `~/.codex/pets` 中原有宠物，也不会删除独立宠物库中的包。

## 本地自定义主题

主题列表中的“本地自定义主题”卡片会打开设置弹窗。用户可选择基础主题与背景图片（PNG、JPG、WebP、GIF）、配置主题色、逐项选择 SVG 图标，或导入一个 `icons.json` 作为输入来源来覆盖部分或全部同名图标。生成后的主题不会保留独立 `icons.json`；合并后的图标写入 `theme.json.icons`。

本地主题色支持固定色块、透明选项和系统选色卡；高级 CSS 值仍可用于 `rgb()`、`hsl()`、`oklch()` 等表达。主题色会写入生成主题自己的 `theme.css`，强调色也会同步到 `theme.json.palette.accent`。

## TypeScript 源码

主题管理器的维护源码是 `windows/src/theme-manager.ts`，通过根目录 `tsconfig.json` 编译为 `windows/engine/theme-manager.js`。主题包加载、资源校验、主题库目录、本地主题另存和宠物绑定由 `windows/scripts/theme-package.mjs` 维护；`windows/scripts/injector.mjs` 只负责 CDP 连接、注入、热重载和验证。
