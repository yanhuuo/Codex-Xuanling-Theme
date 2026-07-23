# Dream Skin 自包含主题包 v2

每个主题必须是一个独立文件夹。主题的样式、DOM 适配、图标、动画和图片不能放进公共注入器。

```text
my-theme/
├─ theme.json
├─ theme.css
├─ theme.js
├─ background.jpg
└─ icons/                 # 可选，由本主题自己使用

pets/
└─ my-pet/
   ├─ pet.json
   └─ spritesheet.webp
```

最小 `theme.json`：

```json
{
  "schemaVersion": 2,
  "id": "my-theme",
  "name": "我的主题",
  "version": "1.0.0",
  "entrypoints": {
    "css": "theme.css",
    "renderer": "theme.js"
  },
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

`theme.js` 是主题自己的渲染入口，并必须包含三个占位符：

```js
((cssText, artDataUrl, theme) => {
  // 安装样式、主题 DOM 适配和清理函数。
})(__DREAM_CSS_JSON__, __DREAM_ART_JSON__, __DREAM_THEME_JSON__)
```

主题切换会复制并启用整个文件夹，不会复用上一个主题的 CSS、脚本或图标。`engine/` 只负责主题列表、加载、还原与安全校验。

主题脚本会在 Codex 渲染器中执行。只安装你信任的本地或 HTTPS 主题库。

## 主题宠物

主题页从 `~/.codex/pets` 读取有效的 v2 宠物。选择后，主题只在 `theme.json.pet.id` 中保存绑定关系；宠物包保存在与 `themes/` 分离的 `pets/<id>/` 目录中。主题通过本地库或 GitHub 换机安装并启用时，会从独立宠物目录安装同一宠物到新主机的 `~/.codex/pets`，并同步 Codex 的 `desktop.selected-avatar-id`。

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
