# Dream Skin 自包含主题包 v2

每个主题必须是一个独立文件夹。主题的样式、DOM 适配、图标、动画和图片不能放进公共注入器。

```text
my-theme/
├─ theme.json
├─ theme.css
├─ theme.js
├─ background.jpg
└─ icons/                 # 可选，由本主题自己使用
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

## 宠物关联

Codex 宠物不会嵌入主题代码包。主题页从 `~/.codex/pets` 读取有效的 v2 宠物，并将主题与宠物的关联独立保存在 `pet-associations.json`。切换主题不会覆盖或复制用户的原生宠物包。

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
