import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalThemePackage, themeControlState } from "../scripts/theme-package.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const windowsRoot = path.resolve(here, "..");
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dream-local-theme-"));

try {
  const savedRoot = path.join(temporaryRoot, "themes");
  const iconsPath = path.join(temporaryRoot, "icons.json");
  const customBird = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="#fff"/></svg>';
  await fs.writeFile(iconsPath, `${JSON.stringify({ bird: customBird })}\n`, "utf8");
  const created = await createLocalThemePackage({
    bundledRoot: path.join(windowsRoot, "themes"),
    savedRoot,
    name: "本地回归主题",
    baseKey: "鸣潮 秧秧·玄翎",
    imagePath: path.join(windowsRoot, "themes", "鸣潮 秧秧·玄翎", "background.jpg"),
    iconsPath,
    palette: {
      accent: "#77d9ff",
      detail: "transparent",
      sendBase: "#123456",
      processingBase: "#234567",
    },
  });
  assert.ok(created.id.startsWith("local-"));
  const manifest = JSON.parse(await fs.readFile(path.join(created.directory, "theme.json"), "utf8"));
  assert.equal(manifest.localOnly, true);
  assert.equal(manifest.schemaVersion, 4);
  assert.equal(manifest.entrypoints.icons, undefined);
  assert.equal(manifest.palette.accent, "#77d9ff");
  assert.equal(manifest.icons.bird, customBird);
  assert.ok(manifest.icons.search, "Partial local icon overrides must retain the base theme icons.");
  assert.equal(manifest.install.default, false);
  assert.equal(manifest.install.files.includes("icons.json"), false);
  assert.equal(await fs.stat(path.join(created.directory, "icons.json")).then(() => true, () => false), false);
  assert.equal(await fs.stat(path.join(created.directory, "install.json")).then(() => true, () => false), false);
  assert.equal(await fs.stat(path.join(created.directory, manifest.image)).then((item) => item.isFile()), true);
  const localCss = await fs.readFile(path.join(created.directory, "theme.css"), "utf8");
  assert.ok(localCss.includes("--dream-accent: #77d9ff;"));
  assert.ok(localCss.includes("--dream-detail: transparent;"));
  assert.ok(localCss.includes("--dream-send-base: #123456;"));
  assert.ok(localCss.includes("--dream-processing-base: #234567;"));
  const activeTheme = path.join(temporaryRoot, "active-theme");
  await fs.cp(created.directory, activeTheme, { recursive: true });
  await fs.cp(created.directory, path.join(savedRoot, `preset-${created.id}`), { recursive: true });
  const state = await themeControlState({ themeDir: activeTheme, pauseFile: path.join(temporaryRoot, "paused") });
  assert.equal(new Set(state.themes.map((theme) => theme.id)).size, state.themes.length, "Installed theme duplicates must be deleted, not only hidden.");
  assert.equal(state.themes.some((theme) => Object.hasOwn(theme, "preview")), false, "Theme previews must be lazy-loaded instead of slowing the initial theme state.");
  assert.ok(state.themes.some((theme) => theme.petName && theme.petId), "Theme cards must expose their bound pet identity.");
  assert.equal(state.themes.some((theme) => Object.hasOwn(theme, "petPreview")), false, "Pet previews must be lazy-loaded instead of slowing the initial theme state.");

  const customSearch = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v16H4z" fill="#0ff"/></svg>';
  const transparentGif = Buffer.from("47494638396102000300800000000000ffffff2c00000000020003000002024401003b", "hex");
  const uploaded = await createLocalThemePackage({
    bundledRoot: path.join(windowsRoot, "themes"),
    savedRoot,
    name: "文件选择器主题",
    baseKey: "鸣潮 秧秧·玄翎",
    imageName: "picked-background.gif",
    imageBase64: transparentGif.toString("base64"),
    iconsJsonText: JSON.stringify({ bird: customBird }),
    iconOverrides: { search: customSearch },
  });
  const uploadedManifest = JSON.parse(await fs.readFile(path.join(uploaded.directory, "theme.json"), "utf8"));
  assert.equal(uploadedManifest.localOnly, true);
  assert.equal(uploadedManifest.image, "art.gif");
  assert.equal(uploadedManifest.icons.bird, customBird);
  assert.equal(uploadedManifest.icons.search, customSearch, "Individual SVG selection must override imported JSON and base icons.");

  await assert.rejects(
    createLocalThemePackage({
      bundledRoot: path.join(windowsRoot, "themes"),
      savedRoot,
      name: "越界主题",
      baseKey: "../outside",
      imagePath: path.join(windowsRoot, "themes", "鸣潮 秧秧·玄翎", "background.jpg"),
    }),
  );
  console.log("PASS: local-only themes clone a trusted base, accept bounded icon overrides, and stay in the local theme store.");
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
