import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalThemePackage } from "../scripts/injector.mjs";

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
  });
  assert.ok(created.id.startsWith("local-"));
  const manifest = JSON.parse(await fs.readFile(path.join(created.directory, "theme.json"), "utf8"));
  const install = JSON.parse(await fs.readFile(path.join(created.directory, "install.json"), "utf8"));
  const icons = JSON.parse(await fs.readFile(path.join(created.directory, "icons.json"), "utf8"));
  assert.equal(manifest.localOnly, true);
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.entrypoints.icons, "icons.json");
  assert.equal(icons.bird, customBird);
  assert.ok(icons.search, "Partial local icon overrides must retain the base theme icons.");
  assert.equal(install.default, false);
  assert.ok(install.files.includes("icons.json"));
  assert.equal(await fs.stat(path.join(created.directory, manifest.image)).then((item) => item.isFile()), true);

  const customSearch = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v16H4z" fill="#0ff"/></svg>';
  const sourceImagePath = path.join(windowsRoot, "themes", "鸣潮 秧秧·玄翎", "background.jpg");
  const uploaded = await createLocalThemePackage({
    bundledRoot: path.join(windowsRoot, "themes"),
    savedRoot,
    name: "文件选择器主题",
    baseKey: "鸣潮 秧秧·玄翎",
    imageName: "picked-background.jpg",
    imageBase64: (await fs.readFile(sourceImagePath)).toString("base64"),
    iconsJsonText: JSON.stringify({ bird: customBird }),
    iconOverrides: { search: customSearch },
  });
  const uploadedManifest = JSON.parse(await fs.readFile(path.join(uploaded.directory, "theme.json"), "utf8"));
  const uploadedIcons = JSON.parse(await fs.readFile(path.join(uploaded.directory, "icons.json"), "utf8"));
  assert.equal(uploadedManifest.localOnly, true);
  assert.equal(uploadedManifest.image, "art.jpg");
  assert.equal(uploadedIcons.bird, customBird);
  assert.equal(uploadedIcons.search, customSearch, "Individual SVG selection must override imported JSON and base icons.");

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
