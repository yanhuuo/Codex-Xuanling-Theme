import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readImageMetadata } from "./image-metadata.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const execFile = promisify(execFileCallback);
const here = path.dirname(scriptPath);
const root = path.resolve(here, "..");
export const DEFAULT_THEME_DIR = path.join(root, "themes");
const SKIN_VERSION = "1.4.0";
const RUNTIME_PROTOCOL_VERSION = 1;
const MAX_ART_BYTES = 16 * 1024 * 1024;
const MAX_THEME_CSS_BYTES = 512 * 1024;
const MAX_THEME_SCRIPT_BYTES = 768 * 1024;
const MAX_THEME_ICONS_BYTES = 256 * 1024;
const MAX_LIBRARY_INDEX_BYTES = 1024 * 1024;
const MAX_PET_MANIFEST_BYTES = 128 * 1024;
const MAX_PET_SPRITESHEET_BYTES = 20 * 1024 * 1024;
const SUPPORTED_ART_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
export const PET_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;

const THEME_CHOICES = {
  appearance: new Set(["auto", "light", "dark"]),
  safeArea: new Set(["auto", "left", "right", "center", "none"]),
  taskMode: new Set(["auto", "ambient", "banner", "off"]),
  homeMode: new Set(["themed", "native"]),
  imageFit: new Set(["cover", "contain", "stretch", "auto"]),
  imageRepeat: new Set(["no-repeat", "repeat", "repeat-x", "repeat-y"]),
  imagePosition: new Set(["auto", "center", "left", "right", "top", "bottom", "left top", "left center", "left bottom", "right top", "right center", "right bottom", "center top", "center bottom"]),
  sidebarBackground: new Set(["auto", "transparent", "tint", "solid"]),
  sidebarFontSize: new Set(["default", "small", "normal", "large"]),
  sidebarFontWeight: new Set(["default", "normal", "medium", "semibold", "bold"]),
  composerWidth: new Set(["default", "compact", "comfortable", "wide", "full"]),
  composerHeight: new Set(["default", "compact", "comfortable", "large"]),
  composerFontSize: new Set(["default", "small", "normal", "large"]),
};

function normalizedUnit(value, name) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new Error(`${name} must be null or a number between 0 and 1`);
  }
  return number;
}

function normalizedChoice(value, name, choices, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (!choices.has(value)) throw new Error(`${name} has an unsupported value: ${value}`);
  return value;
}

function normalizedPercent(value, name, fallback, min = 60, max = 140) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a finite number`);
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeImageDisplay(rawDisplay) {
  const display = rawDisplay && typeof rawDisplay === "object" && !Array.isArray(rawDisplay) ? rawDisplay : {};
  const rotation = display.rotation && typeof display.rotation === "object" && !Array.isArray(display.rotation)
    ? display.rotation : {};
  const intervalSeconds = Number(rotation.intervalSeconds ?? display.rotationIntervalSeconds ?? 45);
  return {
    fit: normalizedChoice(display.fit, "display.fit", THEME_CHOICES.imageFit, "cover"),
    position: normalizedChoice(display.position, "display.position", THEME_CHOICES.imagePosition, "auto"),
    repeat: normalizedChoice(display.repeat, "display.repeat", THEME_CHOICES.imageRepeat, "no-repeat"),
    rotation: {
      enabled: rotation.enabled === true,
      intervalSeconds: Number.isFinite(intervalSeconds) ? Math.min(3600, Math.max(5, Math.round(intervalSeconds))) : 45,
    },
  };
}

function normalizeSidebarSettings(rawSidebar) {
  const sidebar = rawSidebar && typeof rawSidebar === "object" && !Array.isArray(rawSidebar) ? rawSidebar : {};
  const fontFamily = normalizedText(sidebar.fontFamily, "sidebar.fontFamily", "", 120);
  const textColor = normalizedText(sidebar.textColor, "sidebar.textColor", "", 120);
  const iconColor = normalizedText(sidebar.iconColor, "sidebar.iconColor", "", 120);
  if (fontFamily && /[;{}]/.test(fontFamily)) throw new Error("sidebar.fontFamily contains unsupported characters");
  if (textColor && !isSupportedCssColor(textColor)) throw new Error("sidebar.textColor is not a supported CSS color");
  if (iconColor && !isSupportedCssColor(iconColor)) throw new Error("sidebar.iconColor is not a supported CSS color");
  return {
    background: normalizedChoice(sidebar.background, "sidebar.background", THEME_CHOICES.sidebarBackground, "auto"),
    fontFamily,
    textColor,
    iconColor,
    fontSize: normalizedChoice(sidebar.fontSize, "sidebar.fontSize", THEME_CHOICES.sidebarFontSize, "default"),
    fontWeight: normalizedChoice(sidebar.fontWeight, "sidebar.fontWeight", THEME_CHOICES.sidebarFontWeight, "default"),
    textBrightness: normalizedPercent(sidebar.textBrightness ?? sidebar.brightness, "sidebar.textBrightness", 100),
  };
}

function normalizeComposerSettings(rawComposer) {
  const composer = rawComposer && typeof rawComposer === "object" && !Array.isArray(rawComposer) ? rawComposer : {};
  return {
    width: normalizedChoice(composer.width, "composer.width", THEME_CHOICES.composerWidth, "default"),
    height: normalizedChoice(composer.height, "composer.height", THEME_CHOICES.composerHeight, "default"),
    fontSize: normalizedChoice(composer.fontSize, "composer.fontSize", THEME_CHOICES.composerFontSize, "default"),
  };
}

function normalizeThemeImageEntries(raw, fallbackImage, fallbackPreviewImage) {
  const entries = [];
  const addEntry = (candidate, index) => {
    const item = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
    const filePath = normalizedText(item.path, `images[${index}].path`, "", 240);
    if (!filePath || path.isAbsolute(filePath)) throw new Error(`images[${index}].path must be a relative path`);
    const idSeed = normalizedText(item.id, `images[${index}].id`, "", 80) ||
      safeThemeId(path.basename(filePath, path.extname(filePath)) || `image-${index + 1}`, `image-${index + 1}`);
    const id = idSeed.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
    if (!id) throw new Error(`images[${index}].id is invalid`);
    const previewPath = normalizedText(item.previewPath ?? item.previewImage, `images[${index}].previewPath`, "", 240);
    if (previewPath && path.isAbsolute(previewPath)) throw new Error(`images[${index}].previewPath must be a relative path`);
    entries.push({
      id,
      label: normalizedText(item.label, `images[${index}].label`, id, 80),
      path: filePath.replaceAll("\\", "/"),
      ...(previewPath ? { previewPath: previewPath.replaceAll("\\", "/") } : {}),
    });
  };
  if (Array.isArray(raw.images)) {
    raw.images.slice(0, 12).forEach(addEntry);
  }
  if (!entries.some((entry) => entry.path === fallbackImage)) {
    entries.unshift({
      id: "default",
      label: normalizedText(raw.imageLabel, "imageLabel", "默认图", 80),
      path: fallbackImage,
      ...(fallbackPreviewImage ? { previewPath: fallbackPreviewImage } : {}),
    });
  }
  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, 12);
}

function isSupportedCssColor(value) {
  return value === "transparent" ||
    /^(?:#[\da-f]{3,8}|(?:rgb|hsl|oklch|oklab)\([^;{}]{1,96}\))$/i.test(value);
}

export function normalizedText(value, name, fallback, maxLength = 120) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string" || value.length > maxLength || /[\u0000-\u001f]/.test(value)) {
    throw new Error(`${name} must be a short single-line string`);
  }
  return value;
}

function normalizeThemeIcons(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Theme icons must be an object");
  const icons = {};
  for (const [name, svg] of Object.entries(raw)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(name) || typeof svg !== "string" ||
        svg.length > 16384 || !/^<svg\b[\s\S]*<\/svg>$/i.test(svg.trim()) ||
        /<script\b|on[a-z]+\s*=|javascript:/i.test(svg)) {
      throw new Error(`Theme icon is invalid: ${name}`);
    }
    icons[name] = svg;
  }
  if (Object.keys(icons).length > 128) throw new Error("Theme icons exceed the 128 item limit");
  return icons;
}

function decodeBoundedBase64(value, name, maxBytes) {
  if (typeof value !== "string" || !value || value.length > Math.ceil(maxBytes * 4 / 3) + 8 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error(`${name}不是有效的文件内容`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 1 || bytes.length > maxBytes ||
      bytes.toString("base64").replace(/=+$/, "") !== value.replace(/=+$/, "")) {
    throw new Error(`${name}为空、过大或编码无效`);
  }
  return bytes;
}

async function resolveThemePackageDirectory(themeDir) {
  const requested = await fs.realpath(themeDir);
  try {
    const themeStat = await fs.stat(path.join(requested, "theme.json"));
    if (themeStat.isFile()) return requested;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const candidates = [];
  for (const entry of await fs.readdir(requested, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(requested, entry.name);
    try {
      const themeText = await fs.readFile(path.join(directory, "theme.json"), "utf8");
      const theme = JSON.parse(themeText);
      const inlineInstall = theme?.install && typeof theme.install === "object" && !Array.isArray(theme.install) ? theme.install : {};
      if (theme && typeof theme === "object" && !Array.isArray(theme)) candidates.push({ directory, isDefault: inlineInstall.default === true });
    } catch {
      try {
        const installText = await fs.readFile(path.join(directory, "install.json"), "utf8");
        const install = JSON.parse(installText);
        if (Number(install?.schemaVersion) === 1 && install?.manifest === "theme.json") {
          candidates.push({ directory, isDefault: install.default === true });
        }
      } catch {
        // A theme collection may contain unrelated folders.
      }
    }
  }
  const selected = candidates.find((candidate) => candidate.isDefault) ?? candidates[0];
  if (!selected) throw new Error(`No installable theme package was found in ${requested}`);
  return fs.realpath(selected.directory);
}

async function loadThemeInstallManifest(realThemeDir) {
  const installPath = path.join(realThemeDir, "install.json");
  let installText;
  try {
    installText = await fs.readFile(installPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (Buffer.byteLength(installText, "utf8") > 64 * 1024) throw new Error("install.json is too large");
  const raw = JSON.parse(installText);
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      Number(raw.schemaVersion) !== 1 || raw.manifest !== "theme.json" || !Array.isArray(raw.files)) {
    throw new Error("install.json must be a schemaVersion 1 theme package manifest");
  }
  const files = [];
  for (const item of raw.files) {
    if (typeof item !== "string" || !item || path.isAbsolute(item)) throw new Error("install.json files must be relative paths");
    const candidate = path.resolve(realThemeDir, item);
    if (!isPathInside(candidate, realThemeDir)) throw new Error("install.json file escaped the theme package");
    const realCandidate = await fs.realpath(candidate);
    if (!isPathInside(realCandidate, realThemeDir) || !(await fs.stat(realCandidate)).isFile()) {
      throw new Error("install.json files must be regular files inside the theme package");
    }
    files.push(item.replaceAll("\\", "/"));
  }
  if (!files.includes("theme.json")) throw new Error("install.json must include theme.json");
  return {
    schemaVersion: 1,
    default: raw.default === true,
    manifest: "theme.json",
    files: [...new Set(files)],
    pets: Array.isArray(raw.pets) ? raw.pets.filter((id) => typeof id === "string" && PET_ID_PATTERN.test(id)) : [],
    path: installPath,
    text: installText,
  };
}

async function normalizeInlineInstallManifest(rawInstall, realThemeDir, rawPet, rawTheme = null) {
  const install = rawInstall && typeof rawInstall === "object" && !Array.isArray(rawInstall) ? rawInstall : null;
  const filesSource = [
    ...(Array.isArray(rawTheme?.files) ? rawTheme.files : []),
    ...(Array.isArray(install?.files) ? install.files : []),
    "theme.json",
  ];
  const files = [];
  for (const item of filesSource) {
    if (typeof item !== "string" || !item || path.isAbsolute(item)) throw new Error("theme.install.files must be relative paths");
    const candidate = path.resolve(realThemeDir, item);
    if (!isPathInside(candidate, realThemeDir)) throw new Error("theme.install.files escaped the theme package");
    const realCandidate = await fs.realpath(candidate);
    if (!isPathInside(realCandidate, realThemeDir) || !(await fs.stat(realCandidate)).isFile()) {
      throw new Error("theme.install.files must be regular files inside the theme package");
    }
    files.push(item.replaceAll("\\", "/"));
  }
  if (!files.includes("theme.json")) files.unshift("theme.json");
  const petIds = Array.isArray(install?.pets)
    ? install.pets.filter((id) => typeof id === "string" && PET_ID_PATTERN.test(id))
    : rawPet?.id && PET_ID_PATTERN.test(String(rawPet.id)) ? [String(rawPet.id)] : [];
  return {
    schemaVersion: 2,
    default: install?.default === true,
    manifest: "theme.json",
    files: [...new Set(files)],
    pets: [...new Set(petIds)],
    path: path.join(realThemeDir, "theme.json"),
    text: "",
    inline: true,
  };
}

function normalizePetManifest(raw, expectedId = null) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("宠物 pet.json 必须是对象");
  const id = String(raw.id || "").trim();
  if (!PET_ID_PATTERN.test(id) || (expectedId && id !== expectedId)) throw new Error("宠物 id 无效或与主题声明不一致");
  if (Number(raw.spriteVersionNumber) !== 2) throw new Error("主题只支持 Codex v2 宠物包");
  const spritesheetPath = normalizedText(raw.spritesheetPath, "pet.spritesheetPath", "", 160);
  if (!spritesheetPath || path.isAbsolute(spritesheetPath) || path.extname(spritesheetPath).toLowerCase() !== ".webp") {
    throw new Error("宠物 spritesheetPath 必须是包内的相对 .webp 路径");
  }
  return {
    manifest: raw,
    id,
    displayName: normalizedText(raw.displayName, "pet.displayName", id, 80),
    description: normalizedText(raw.description, "pet.description", "", 240),
    spriteVersionNumber: 2,
    spritesheetPath,
  };
}

function petBundleFromBytes(manifestBytes, spritesheetBytes, expectedId = null) {
  if (manifestBytes.length < 1 || manifestBytes.length > MAX_PET_MANIFEST_BYTES) {
    throw new Error("宠物 pet.json 为空或超过 128 KB");
  }
  let raw;
  try { raw = JSON.parse(manifestBytes.toString("utf8")); }
  catch { throw new Error("宠物 pet.json 不是有效 JSON"); }
  const pet = normalizePetManifest(raw, expectedId);
  if (spritesheetBytes.length < 1 || spritesheetBytes.length > MAX_PET_SPRITESHEET_BYTES) {
    throw new Error("宠物 spritesheet.webp 为空或超过 20 MB");
  }
  const metadata = readImageMetadata(spritesheetBytes, ".webp");
  if (!metadata || metadata.width !== 1536 || metadata.height !== 2288) {
    throw new Error("Codex v2 宠物图集必须是 1536×2288 的 WebP");
  }
  return {
    ...pet,
    manifestBytes,
    spritesheetBytes,
    fingerprint: createHash("sha256").update(manifestBytes).update("\0").update(spritesheetBytes).digest("hex"),
  };
}

export async function loadPetPackage(packageDirectory, expectedId = null) {
  const realDirectory = await fs.realpath(packageDirectory);
  const manifestPath = await fs.realpath(path.join(realDirectory, "pet.json"));
  if (!isPathInside(manifestPath, realDirectory)) throw new Error("宠物清单不能通过链接跳出宠物目录");
  const manifestBytes = await fs.readFile(manifestPath);
  let raw;
  try { raw = JSON.parse(manifestBytes.toString("utf8")); }
  catch { throw new Error("宠物 pet.json 不是有效 JSON"); }
  const normalized = normalizePetManifest(raw, expectedId);
  const declaredSpritesheet = path.resolve(realDirectory, normalized.spritesheetPath);
  if (!isPathInside(declaredSpritesheet, realDirectory)) throw new Error("宠物图集必须保留在宠物目录内");
  const spritesheetPath = await fs.realpath(declaredSpritesheet);
  if (!isPathInside(spritesheetPath, realDirectory)) throw new Error("宠物图集不能通过链接跳出宠物目录");
  const spritesheetBytes = await fs.readFile(spritesheetPath);
  return {
    ...petBundleFromBytes(manifestBytes, spritesheetBytes, expectedId),
    directory: realDirectory,
    manifestPath,
    spritesheetFilePath: spritesheetPath,
  };
}

function petSearchDirectories(realThemeDir, petId, declaredDirectory = "") {
  const candidates = [];
  const add = (candidate) => {
    const resolved = path.resolve(candidate);
    if (!candidates.includes(resolved)) candidates.push(resolved);
  };
  if (declaredDirectory) add(path.resolve(realThemeDir, declaredDirectory));
  for (let cursor = realThemeDir; ; cursor = path.dirname(cursor)) {
    add(path.join(cursor, "pets", petId));
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
  }
  add(path.join(codexHome(), "pets", petId));
  return candidates;
}

async function loadThemePetBundle(realThemeDir, rawPet) {
  if (rawPet === undefined || rawPet === null) return { petBundle: null, normalizedPet: null };
  if (typeof rawPet !== "object" || Array.isArray(rawPet)) throw new Error("theme.pet must be an object");
  const petId = normalizedText(rawPet.id, "pet.id", "", 80);
  if (!PET_ID_PATTERN.test(petId)) throw new Error("theme.pet.id is invalid");
  const declaredDirectory = normalizedText(rawPet.directory, "pet.directory", "", 240);
  if (declaredDirectory && path.isAbsolute(declaredDirectory)) throw new Error("theme.pet.directory must be relative");
  const attempted = [];
  for (const directory of petSearchDirectories(realThemeDir, petId, declaredDirectory)) {
    try {
      const petBundle = await loadPetPackage(directory, petId);
      return { petBundle, normalizedPet: { id: petId } };
    } catch (error) {
      if (error?.code !== "ENOENT") attempted.push(error);
    }
  }
  if (attempted.length > 0) throw attempted[0];
  throw new Error(`Theme pet package was not found: ${petId}`);
}

export async function loadTheme(themeDir) {
  const realThemeDir = await resolveThemePackageDirectory(themeDir);
  const themePath = path.join(realThemeDir, "theme.json");
  const themeText = await fs.readFile(themePath, "utf8");
  const raw = JSON.parse(themeText);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Theme root must be an object");
  }
  let install = raw.install || raw.files
    ? await normalizeInlineInstallManifest(raw.install, realThemeDir, raw.pet, raw)
    : await loadThemeInstallManifest(realThemeDir);
  const image = normalizedText(raw.image, "image", null, 240);
  if (!image || path.isAbsolute(image)) throw new Error("Theme image must be a relative path");
  const imagePath = path.resolve(realThemeDir, image);
  const relativeImage = path.relative(realThemeDir, imagePath);
  if (!relativeImage || relativeImage.startsWith("..") || path.isAbsolute(relativeImage)) {
    throw new Error("Theme image must remain inside the selected theme directory");
  }
  const extension = path.extname(imagePath).toLowerCase();
  if (!SUPPORTED_ART_EXTENSIONS.includes(extension)) {
    throw new Error(`Unsupported theme image format: ${extension || "missing"}`);
  }
  const realImagePath = await fs.realpath(imagePath);
  const realRelativeImage = path.relative(realThemeDir, realImagePath);
  if (!realRelativeImage || realRelativeImage.startsWith("..") || path.isAbsolute(realRelativeImage)) {
    throw new Error("Theme image cannot escape through a link or junction");
  }
  const previewImage = normalizedText(raw.previewImage, "previewImage", "", 240);
  let realPreviewImagePath = null;
  let previewExtension = "";
  if (previewImage) {
    if (path.isAbsolute(previewImage)) throw new Error("Theme previewImage must be a relative path");
    const previewPath = path.resolve(realThemeDir, previewImage);
    const relativePreviewImage = path.relative(realThemeDir, previewPath);
    if (!relativePreviewImage || relativePreviewImage.startsWith("..") || path.isAbsolute(relativePreviewImage)) {
      throw new Error("Theme previewImage must remain inside the selected theme directory");
    }
    previewExtension = path.extname(previewPath).toLowerCase();
    if (!SUPPORTED_ART_EXTENSIONS.includes(previewExtension)) {
      throw new Error(`Unsupported theme previewImage format: ${previewExtension || "missing"}`);
    }
    realPreviewImagePath = await fs.realpath(previewPath);
    const realRelativePreviewImage = path.relative(realThemeDir, realPreviewImagePath);
    if (!realRelativePreviewImage || realRelativePreviewImage.startsWith("..") || path.isAbsolute(realRelativePreviewImage)) {
      throw new Error("Theme previewImage cannot escape through a link or junction");
    }
  }
  const imageEntries = normalizeThemeImageEntries(raw, image, previewImage);
  const requestedDefaultImage = normalizedText(raw.defaultImage, "defaultImage", imageEntries[0]?.id ?? "default", 80);
  const defaultImage = imageEntries.some((entry) => entry.id === requestedDefaultImage)
    ? requestedDefaultImage
    : imageEntries[0]?.id ?? "default";
  const display = normalizeImageDisplay(raw.display);
  const sidebar = normalizeSidebarSettings(raw.sidebar);
  const composer = normalizeComposerSettings(raw.composer);
  const entrypoints = raw.entrypoints && typeof raw.entrypoints === "object" && !Array.isArray(raw.entrypoints)
    ? raw.entrypoints : {};
  const framework = raw.framework && typeof raw.framework === "object" && !Array.isArray(raw.framework)
    ? raw.framework : null;
  const usesSharedFramework = framework?.id === "dream-skin" && Number(framework?.version) === 1;
  if (raw.framework !== undefined && !usesSharedFramework) {
    throw new Error("Theme framework must be dream-skin version 1");
  }
  const cssEntry = normalizedText(entrypoints.css, "entrypoints.css", "", 240);
  const rendererEntry = normalizedText(entrypoints.renderer, "entrypoints.renderer", "", 240);
  const iconsEntry = normalizedText(entrypoints.icons, "entrypoints.icons", "", 240);
  const loadThemeCode = async (relativeEntry, fallbackPath, field, expectedExtension, maximumBytes) => {
    const candidate = relativeEntry ? path.resolve(realThemeDir, relativeEntry) : fallbackPath;
    if (relativeEntry) {
      if (path.isAbsolute(relativeEntry)) throw new Error(`${field} must be a relative path`);
      const relative = path.relative(realThemeDir, candidate);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`${field} must remain inside the selected theme directory`);
      }
    }
    if (path.extname(candidate).toLowerCase() !== expectedExtension) {
      throw new Error(`${field} must use ${expectedExtension}`);
    }
    const realCandidate = await fs.realpath(candidate);
    if (relativeEntry) {
      const realRelative = path.relative(realThemeDir, realCandidate);
      if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
        throw new Error(`${field} cannot escape through a link or junction`);
      }
    }
    const bytes = await fs.readFile(realCandidate);
    if (bytes.length < 1 || bytes.length > maximumBytes) throw new Error(`${field} is empty or too large`);
    return { path: realCandidate, text: bytes.toString("utf8"), bytes };
  };
  let cssBundle;
  let rendererBundle;
  if (usesSharedFramework) {
    const [frameworkCss, themeCss, frameworkRenderer] = await Promise.all([
      loadThemeCode("", path.join(root, "engine", "theme-base.css"), "framework.css", ".css", MAX_THEME_CSS_BYTES),
      loadThemeCode(cssEntry, path.join(realThemeDir, "theme.css"), "entrypoints.css", ".css", MAX_THEME_CSS_BYTES),
      loadThemeCode("", path.join(root, "engine", "theme-runtime.js"), "framework.renderer", ".js", MAX_THEME_SCRIPT_BYTES),
    ]);
    const combinedCssText = `${frameworkCss.text.trimEnd()}\n\n${themeCss.text.trim()}\n`;
    const combinedCssBytes = Buffer.from(combinedCssText, "utf8");
    if (combinedCssBytes.length > MAX_THEME_CSS_BYTES) throw new Error("Combined framework and theme CSS is too large");
    cssBundle = { path: themeCss.path, text: combinedCssText, bytes: combinedCssBytes };
    rendererBundle = frameworkRenderer;
  } else {
    [cssBundle, rendererBundle] = await Promise.all([
      loadThemeCode(cssEntry, path.join(realThemeDir, "theme.css"), "entrypoints.css", ".css", MAX_THEME_CSS_BYTES),
      loadThemeCode(rendererEntry, path.join(realThemeDir, "theme.js"), "entrypoints.renderer", ".js", MAX_THEME_SCRIPT_BYTES),
    ]);
  }
  let iconsBundle = null;
  let icons = {};
  if (raw.icons !== undefined) {
    icons = normalizeThemeIcons(raw.icons);
    const iconsText = `${JSON.stringify(icons, null, 2)}\n`;
    const iconsBytes = Buffer.from(iconsText, "utf8");
    if (iconsBytes.length > MAX_THEME_ICONS_BYTES) throw new Error("theme.icons is too large");
    iconsBundle = { path: themePath, text: iconsText, bytes: iconsBytes, inline: true };
  } else if (iconsEntry) {
    iconsBundle = await loadThemeCode(iconsEntry, null, "entrypoints.icons", ".json", MAX_THEME_ICONS_BYTES);
    icons = normalizeThemeIcons(JSON.parse(iconsBundle.text));
  }
  const brandIcon = normalizedText(raw.brandIcon, "brandIcon", "", 40);
  if (brandIcon && !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(brandIcon)) throw new Error("brandIcon is invalid");
  if (brandIcon && iconsBundle && !icons[brandIcon]) throw new Error(`brandIcon is missing from theme icons: ${brandIcon}`);
  const semanticIconKeys = ["sendIcon", "processingIcon", "spinnerIcon"];
  for (const key of semanticIconKeys) {
    const iconName = normalizedText(raw[key], key, "", 40);
    if (iconName && (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(iconName) || (iconsBundle && !icons[iconName]))) {
      throw new Error(`${key} is invalid or missing from theme icons`);
    }
  }
  const requiredPlaceholders = ["__DREAM_CSS_JSON__", "__DREAM_ART_JSON__", "__DREAM_THEME_JSON__"];
  if (iconsBundle || Number(raw.schemaVersion) >= 3) requiredPlaceholders.push("__DREAM_ICONS_JSON__");
  for (const placeholder of requiredPlaceholders) {
    if (!rendererBundle.text.includes(placeholder)) throw new Error(`Theme renderer is missing required placeholder: ${placeholder}`);
  }
  const art = raw.art && typeof raw.art === "object" && !Array.isArray(raw.art) ? raw.art : {};
  const palette = raw.palette && typeof raw.palette === "object" && !Array.isArray(raw.palette)
    ? raw.palette : {};
  const { petBundle, normalizedPet } = await loadThemePetBundle(realThemeDir, raw.pet);
  const theme = {
    schemaVersion: Number(raw.schemaVersion) >= 4 ? 4 : Number(raw.schemaVersion) >= 3 ? 3 : Number(raw.schemaVersion) === 2 ? 2 : 1,
    id: normalizedText(raw.id, "id", "custom", 80),
    name: normalizedText(raw.name, "name", "Codex Dream Skin", 120),
    description: normalizedText(raw.description, "description", "", 240),
    author: normalizedText(raw.author, "author", "", 120),
    version: normalizedText(raw.version, "version", "1.0.0", 40),
    localOnly: raw.localOnly === true,
    ...(usesSharedFramework ? { framework: { id: "dream-skin", version: 1 } } : {}),
    entrypoints: { css: "theme.css", renderer: "theme.js" },
    brandIcon,
    sendIcon: normalizedText(raw.sendIcon, "sendIcon", "", 40),
    processingIcon: normalizedText(raw.processingIcon, "processingIcon", "", 40),
    spinnerIcon: normalizedText(raw.spinnerIcon, "spinnerIcon", "", 40),
    brandSubtitle: normalizedText(raw.brandSubtitle, "brandSubtitle", "", 100),
    tagline: normalizedText(raw.tagline, "tagline", "", 120),
    statusText: normalizedText(raw.statusText, "statusText", "", 80),
    quote: normalizedText(raw.quote, "quote", "", 100),
    image,
    ...(previewImage ? { previewImage } : {}),
    defaultImage,
    images: imageEntries,
    display,
    sidebar,
    composer,
    appearance: normalizedChoice(raw.appearance, "appearance", THEME_CHOICES.appearance, "auto"),
    art: {
      focusX: normalizedUnit(art.focusX, "art.focusX"),
      focusY: normalizedUnit(art.focusY, "art.focusY"),
      safeArea: normalizedChoice(art.safeArea, "art.safeArea", THEME_CHOICES.safeArea, "auto"),
      taskMode: normalizedChoice(art.taskMode, "art.taskMode", THEME_CHOICES.taskMode, "auto"),
      homeMode: normalizedChoice(art.homeMode, "art.homeMode", THEME_CHOICES.homeMode, "themed"),
      immersive: art.immersive === true,
    },
    palette: {},
  };
  if (typeof palette.accent === "string" && palette.accent.trim()) {
    const accent = palette.accent.trim();
    if (!isSupportedCssColor(accent)) {
      throw new Error("palette.accent is not a supported CSS color");
    }
    theme.palette.accent = accent;
  }
  const [themeStat, imageStat, previewImageStat, cssStat, rendererStat, iconsStat] = await Promise.all([
    fs.stat(themePath), fs.stat(realImagePath), realPreviewImagePath ? fs.stat(realPreviewImagePath) : null,
    fs.stat(cssBundle.path), fs.stat(rendererBundle.path),
    iconsBundle && !iconsBundle.inline ? fs.stat(iconsBundle.path) : null,
  ]);
  if (!imageStat.isFile()) throw new Error("Theme image is not a file");
  if (imageStat.size < 1) throw new Error("Theme image cannot be empty");
  if (imageStat.size > MAX_ART_BYTES) {
    throw new Error(`Theme image exceeds the ${MAX_ART_BYTES / 1024 / 1024} MB limit`);
  }
  const imageBytes = await fs.readFile(realImagePath);
  if (imageBytes.length < 1 || imageBytes.length > MAX_ART_BYTES) {
    throw new Error(`Theme image must be between 1 byte and ${MAX_ART_BYTES / 1024 / 1024} MB`);
  }
  const artMetadata = readImageMetadata(imageBytes, extension);
  if (!artMetadata) {
    throw new Error("Theme image metadata is invalid or exceeds the 16384px / 50MP safety limit");
  }
  let previewImageBytes = null;
  if (realPreviewImagePath) {
    if (!previewImageStat?.isFile()) throw new Error("Theme previewImage is not a file");
    if (previewImageStat.size < 1) throw new Error("Theme previewImage cannot be empty");
    if (previewImageStat.size > MAX_ART_BYTES) {
      throw new Error(`Theme previewImage exceeds the ${MAX_ART_BYTES / 1024 / 1024} MB limit`);
    }
    previewImageBytes = await fs.readFile(realPreviewImagePath);
    if (previewImageBytes.length < 1 || previewImageBytes.length > MAX_ART_BYTES ||
        !readImageMetadata(previewImageBytes, previewExtension)) {
      throw new Error("Theme previewImage metadata is invalid or exceeds the 16384px / 50MP safety limit");
    }
  }
  const readThemeImageAsset = async (relativePath, field) => {
    if (!relativePath || path.isAbsolute(relativePath)) throw new Error(`${field} must be a relative path`);
    if (relativePath === image) return { path: realImagePath, bytes: imageBytes, metadata: artMetadata, stat: imageStat };
    if (previewImageBytes && relativePath === previewImage) {
      return { path: realPreviewImagePath, bytes: previewImageBytes, metadata: readImageMetadata(previewImageBytes, previewExtension), stat: previewImageStat };
    }
    const candidate = path.resolve(realThemeDir, relativePath);
    const relative = path.relative(realThemeDir, candidate);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`${field} must remain inside the selected theme directory`);
    }
    const extension = path.extname(candidate).toLowerCase();
    if (!SUPPORTED_ART_EXTENSIONS.includes(extension)) throw new Error(`Unsupported ${field} format: ${extension || "missing"}`);
    const realCandidate = await fs.realpath(candidate);
    const realRelative = path.relative(realThemeDir, realCandidate);
    if (!realRelative || realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
      throw new Error(`${field} cannot escape through a link or junction`);
    }
    const stat = await fs.stat(realCandidate);
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_ART_BYTES) {
      throw new Error(`${field} must be a regular image file between 1 byte and ${MAX_ART_BYTES / 1024 / 1024} MB`);
    }
    const bytes = await fs.readFile(realCandidate);
    const metadata = readImageMetadata(bytes, extension);
    if (!metadata) throw new Error(`${field} metadata is invalid or exceeds the 16384px / 50MP safety limit`);
    return { path: realCandidate, bytes, metadata, stat };
  };
  const runtimeImages = [];
  const imageAssetCache = new Map();
  for (const entry of imageEntries) {
    const asset = imageAssetCache.get(entry.path) ?? await readThemeImageAsset(entry.path, `images.${entry.id}.path`);
    imageAssetCache.set(entry.path, asset);
    const previewAsset = entry.previewPath
      ? imageAssetCache.get(entry.previewPath) ?? await readThemeImageAsset(entry.previewPath, `images.${entry.id}.previewPath`)
      : null;
    if (entry.previewPath && previewAsset) imageAssetCache.set(entry.previewPath, previewAsset);
    runtimeImages.push({ ...entry, filePath: asset.path, bytes: asset.bytes, metadata: asset.metadata, previewFilePath: previewAsset?.path ?? null, previewBytes: previewAsset?.bytes ?? null });
  }
  const packageFiles = new Set(install?.files ?? []);
  packageFiles.add("theme.json");
  packageFiles.add(cssEntry || "theme.css");
  if (!usesSharedFramework) packageFiles.add(rendererEntry || "theme.js");
  packageFiles.add(image);
  if (previewImage) packageFiles.add(previewImage);
  for (const entry of imageEntries) {
    packageFiles.add(entry.path);
    if (entry.previewPath) packageFiles.add(entry.previewPath);
  }
  for (const file of themeIconSourceFiles(icons)) packageFiles.add(file);
  const normalizedPackageFiles = [...packageFiles].filter(Boolean).map((file) => file.replaceAll("\\", "/"));
  install = {
    ...(install ?? { schemaVersion: 2, default: false, manifest: "theme.json", pets: [], path: path.join(realThemeDir, "theme.json"), text: "", inline: true }),
    files: [...new Set(normalizedPackageFiles)],
  };
  theme.files = install.files;
  theme.artMetadata = artMetadata;
  const fingerprintBuilder = createHash("sha256")
    .update(themeText, "utf8")
    .update("\0")
    .update(imageBytes)
    .update("\0")
    .update(cssBundle.bytes)
    .update("\0")
    .update(rendererBundle.bytes);
  if (previewImageBytes) fingerprintBuilder.update("\0preview\0").update(previewImageBytes);
  for (const entry of runtimeImages) fingerprintBuilder.update("\0image-entry\0").update(entry.id).update("\0").update(entry.bytes);
  if (iconsBundle) fingerprintBuilder.update("\0icons\0").update(iconsBundle.bytes);
  if (install) fingerprintBuilder.update("\0install\0").update(install.text, "utf8");
  if (petBundle) fingerprintBuilder.update("\0pet\0").update(petBundle.manifestBytes).update("\0").update(petBundle.spritesheetBytes);
  const fingerprint = fingerprintBuilder.digest("hex");
  let petStamp = "";
  if (petBundle) {
    const [manifestStat, spritesheetStat] = await Promise.all([
      fs.stat(petBundle.manifestPath), fs.stat(petBundle.spritesheetFilePath),
    ]);
    petStamp = `:${manifestStat.size}:${manifestStat.mtimeMs}:${spritesheetStat.size}:${spritesheetStat.mtimeMs}`;
  }
  return {
    theme,
    themePath,
    imagePath: realImagePath,
    imageBytes,
    previewImagePath: realPreviewImagePath,
    previewImageBytes,
    images: runtimeImages,
    cssPath: cssBundle.path,
    cssText: cssBundle.text,
    rendererPath: rendererBundle.path,
    rendererText: rendererBundle.text,
    iconsPath: iconsBundle?.path ?? null,
    iconsText: iconsBundle?.text ?? null,
    icons,
    install,
    petBundle,
    fingerprint,
    sourceStamp: `${themeStat.size}:${themeStat.mtimeMs}:${imageStat.size}:${imageStat.mtimeMs}:${previewImageStat?.size ?? 0}:${previewImageStat?.mtimeMs ?? 0}:${cssStat.size}:${cssStat.mtimeMs}:${rendererStat.size}:${rendererStat.mtimeMs}:${iconsStat?.size ?? 0}:${iconsStat?.mtimeMs ?? 0}${petStamp}`,
  };
}

export async function loadPayload(themeDir = DEFAULT_THEME_DIR, candidateTheme = null) {
  const loadedTheme = candidateTheme ?? await loadTheme(themeDir);
  const css = loadedTheme.cssText;
  const template = loadedTheme.rendererText;
  const extension = path.extname(loadedTheme.imagePath).toLowerCase();
  const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
    : extension === ".webp" ? "image/webp" : extension === ".gif" ? "image/gif" : "image/png";
  const artDataUrl = `data:${mime};base64,${loadedTheme.imageBytes.toString("base64")}`;
  const runtimeImages = (loadedTheme.images?.length ? loadedTheme.images : [{
    id: loadedTheme.theme.defaultImage || "default",
    label: "默认图",
    path: loadedTheme.theme.image,
    bytes: loadedTheme.imageBytes,
    filePath: loadedTheme.imagePath,
  }]).map((entry) => ({
    id: entry.id,
    label: entry.label,
    path: entry.path,
    previewPath: entry.previewPath,
    src: imageDataUrl(entry.bytes, entry.filePath, MAX_ART_BYTES),
    preview: entry.previewBytes ? imageDataUrl(entry.previewBytes, entry.previewFilePath, 4 * 1024 * 1024) : null,
    metadata: entry.metadata,
  })).filter((entry) => entry.src);
  const runtimeTheme = { ...loadedTheme.theme, runtimeImages };
  const themePayload = template
    .replace("__DREAM_CSS_JSON__", JSON.stringify(css))
    .replace("__DREAM_ART_JSON__", JSON.stringify(artDataUrl))
    .replace("__DREAM_THEME_JSON__", JSON.stringify(runtimeTheme))
    .replace("__DREAM_ICONS_JSON__", JSON.stringify(loadedTheme.icons ?? {}));
  const payload = `${themePayload}
;window.__CODEX_DREAM_SKIN_RUNTIME__ = Object.freeze({
  protocolVersion: ${JSON.stringify(RUNTIME_PROTOCOL_VERSION)},
  injectorVersion: ${JSON.stringify(SKIN_VERSION)},
  themeId: ${JSON.stringify(loadedTheme.theme.id)},
  themeVersion: ${JSON.stringify(loadedTheme.theme.version)}
});`;
  const { imageBytes: _imageBytes, previewImageBytes: _previewImageBytes, ...themeState } = loadedTheme;
  return { ...themeState, payload };
}

export function stateRootFor(options) {
  return path.dirname(options.themeDir);
}

export function isPathInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function safeThemeId(value, fallback = "theme") {
  const cleaned = String(value || fallback).trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || fallback).slice(0, 72);
}

function themeIconSourceFiles(icons) {
  return Object.keys(icons ?? {}).sort().map((name) => `icons/${name}.svg`);
}

async function writeThemeIconSources(destination, icons) {
  const iconsDirectory = path.join(destination, "icons");
  await fs.rm(iconsDirectory, { recursive: true, force: true });
  const entries = Object.entries(icons ?? {}).sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) return;
  await fs.mkdir(iconsDirectory, { recursive: true });
  for (const [name, svg] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(name)) throw new Error(`Theme icon name is invalid: ${name}`);
    const iconPath = path.join(iconsDirectory, `${name}.svg`);
    if (!isPathInside(iconPath, iconsDirectory)) throw new Error(`Theme icon path escaped its directory: ${name}`);
    await fs.writeFile(iconPath, `${svg.trim()}\n`, "utf8");
  }
}

function themeForDisk(loaded, imageName, previewImageName = null, imageEntries = null) {
  const { artMetadata: _metadata, framework: _framework, previewImage: _previewImage, ...theme } = loaded.theme;
  const iconFiles = themeIconSourceFiles(loaded.icons);
  const diskImages = imageEntries?.length ? imageEntries : [{
    id: "default",
    label: "默认图",
    path: imageName,
    ...(previewImageName ? { previewPath: previewImageName } : {}),
  }];
  const diskDefault = diskImages.find((entry) => entry.sourceDefault)?.id ?? diskImages[0]?.id ?? "default";
  const diskTheme = {
    ...theme,
    schemaVersion: 4,
    entrypoints: {
      css: "theme.css",
      renderer: "theme.js",
    },
    image: imageName,
    defaultImage: diskDefault,
    images: diskImages.map(({ sourceDefault: _sourceDefault, ...entry }) => entry),
  };
  if (previewImageName) diskTheme.previewImage = previewImageName;
  if (loaded.icons && Object.keys(loaded.icons).length > 0) diskTheme.icons = loaded.icons;
  else delete diskTheme.icons;
  if (loaded.petBundle) diskTheme.pet = { id: loaded.petBundle.id };
  else delete diskTheme.pet;
  diskTheme.install = {
    default: false,
    files: ["theme.json", "theme.css", "theme.js", ...diskImages.flatMap((entry) => [entry.path, entry.previewPath].filter(Boolean)), imageName, ...(previewImageName ? [previewImageName] : []), ...iconFiles],
    pets: loaded.petBundle ? [loaded.petBundle.id] : [],
  };
  diskTheme.files = diskTheme.install.files;
  return diskTheme;
}

function stateRootFromThemeDestination(destination) {
  const parent = path.dirname(destination);
  return path.basename(parent).toLowerCase() === "themes" ? path.dirname(parent) : parent;
}

async function writePetBundleToStore(stateRoot, petBundle) {
  if (!petBundle) return null;
  const petsRoot = path.join(stateRoot, "pets");
  await fs.mkdir(petsRoot, { recursive: true });
  const realPetsRoot = await fs.realpath(petsRoot);
  const petDirectory = path.join(realPetsRoot, petBundle.id);
  const spritesheetPath = path.resolve(petDirectory, petBundle.spritesheetPath);
  if (!isPathInside(spritesheetPath, petDirectory)) throw new Error("Pet spritesheet target escaped the pet store");
  await fs.mkdir(path.dirname(spritesheetPath), { recursive: true });
  await fs.writeFile(spritesheetPath, petBundle.spritesheetBytes);
  await fs.writeFile(path.join(petDirectory, "pet.json"), petBundle.manifestBytes);
  return petDirectory;
}

export async function writeThemeDirectory(destination, loaded) {
  const requestedDestination = path.resolve(destination);
  const requestedParent = path.dirname(requestedDestination);
  await fs.mkdir(requestedParent, { recursive: true });
  const realParent = await fs.realpath(requestedParent);
  await fs.mkdir(requestedDestination, { recursive: true });
  const resolvedDestination = await fs.realpath(requestedDestination);
  if (!isPathInside(resolvedDestination, realParent)) throw new Error("Theme destination escaped its managed folder");
  const extension = path.extname(loaded.imagePath).toLowerCase();
  const imageName = `art${extension}`;
  const previewExtension = loaded.previewImageBytes && loaded.previewImagePath
    ? path.extname(loaded.previewImagePath).toLowerCase()
    : "";
  const previewImageName = previewExtension ? `preview${previewExtension}` : null;
  const imagePath = path.join(resolvedDestination, imageName);
  const previewImagePath = previewImageName ? path.join(resolvedDestination, previewImageName) : null;
  const cssPath = path.join(resolvedDestination, "theme.css");
  const rendererPath = path.join(resolvedDestination, "theme.js");
  const imageTemp = path.join(resolvedDestination, `.dream-image-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  const jsonTemp = path.join(resolvedDestination, `.dream-theme-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  try {
    await fs.writeFile(imageTemp, loaded.imageBytes, { flag: "wx" });
    await fs.copyFile(imageTemp, imagePath);
    if (previewImagePath) await fs.writeFile(previewImagePath, loaded.previewImageBytes);
    const diskImageEntries = [];
    const sourceImages = loaded.images?.length ? loaded.images : [{
      id: loaded.theme.defaultImage || "default",
      label: "默认图",
      path: loaded.theme.image,
      bytes: loaded.imageBytes,
      filePath: loaded.imagePath,
      previewPath: loaded.theme.previewImage,
      previewBytes: loaded.previewImageBytes,
      previewFilePath: loaded.previewImagePath,
    }];
    for (const entry of sourceImages) {
      const isDefaultSource = entry.id === loaded.theme.defaultImage;
      const sourceExtension = path.extname(entry.filePath || loaded.imagePath).toLowerCase() || extension;
      const diskPath = isDefaultSource ? imageName : `images/${safeThemeId(entry.id, "image")}${sourceExtension}`;
      const targetPath = path.join(resolvedDestination, diskPath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, entry.bytes ?? loaded.imageBytes);
      let diskPreviewPath = null;
      if (entry.previewBytes) {
        const sourcePreviewExtension = path.extname(entry.previewFilePath || loaded.previewImagePath || "").toLowerCase() || ".png";
        diskPreviewPath = isDefaultSource && previewImageName ? previewImageName : `images/${safeThemeId(entry.id, "image")}-preview${sourcePreviewExtension}`;
        const targetPreviewPath = path.join(resolvedDestination, diskPreviewPath);
        await fs.mkdir(path.dirname(targetPreviewPath), { recursive: true });
        await fs.writeFile(targetPreviewPath, entry.previewBytes);
      }
      diskImageEntries.push({
        id: entry.id,
        label: entry.label,
        path: diskPath,
        ...(diskPreviewPath ? { previewPath: diskPreviewPath } : {}),
        ...(isDefaultSource ? { sourceDefault: true } : {}),
      });
    }
    await fs.writeFile(cssPath, loaded.cssText, "utf8");
    await fs.writeFile(rendererPath, loaded.rendererText, "utf8");
    await fs.rm(path.join(resolvedDestination, "icons.json"), { force: true });
    await fs.rm(path.join(resolvedDestination, "install.json"), { force: true });
    await fs.rm(path.join(resolvedDestination, "pets"), { recursive: true, force: true });
    await writeThemeIconSources(resolvedDestination, loaded.icons);
    await writePetBundleToStore(stateRootFromThemeDestination(resolvedDestination), loaded.petBundle);
    await fs.writeFile(jsonTemp, `${JSON.stringify(themeForDisk(loaded, imageName, previewImageName, diskImageEntries), null, 2)}\n`, { flag: "wx" });
    await fs.copyFile(jsonTemp, path.join(resolvedDestination, "theme.json"));
  } finally {
    await fs.rm(imageTemp, { force: true }).catch(() => {});
    await fs.rm(jsonTemp, { force: true }).catch(() => {});
  }
}

export async function readLibraries(options) {
  const filePath = path.join(stateRootFor(options), "libraries.json");
  try {
    const raw = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (!raw || !Array.isArray(raw.sources)) return [];
    return raw.sources.filter((source) => source && typeof source === "object" &&
      typeof source.id === "string" && typeof source.location === "string" &&
      ["local", "remote", "repository"].includes(source.type) &&
      (source.type !== "repository" || typeof source.indexUrl === "string")).slice(0, 24);
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return [];
    throw error;
  }
}

export async function writeLibraries(options, sources) {
  const stateRoot = stateRootFor(options);
  await fs.mkdir(stateRoot, { recursive: true });
  const filePath = path.join(stateRoot, "libraries.json");
  const temp = path.join(stateRoot, `.dream-libraries-${Date.now()}.tmp`);
  try {
    await fs.writeFile(temp, `${JSON.stringify({ schemaVersion: 1, sources }, null, 2)}\n`, { flag: "wx" });
    await fs.copyFile(temp, filePath);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}

export function codexHome() {
  return path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
}

async function readNativeSelectedPetId() {
  try {
    const content = await fs.readFile(path.join(codexHome(), "config.toml"), "utf8");
    const desktop = content.match(/(?:^|\r?\n)[\t ]*\[[\t ]*desktop[\t ]*\][\t ]*(?:#[^\r\n]*)?\r?\n([\s\S]*?)(?=\r?\n[\t ]*\[|\s*$)/)?.[1] ?? "";
    const selected = desktop.match(/^[\t ]*selected-avatar-id[\t ]*=[\t ]*["']custom:([A-Za-z0-9._-]{1,80})["'][\t ]*(?:#.*)?$/m);
    return selected?.[1] ?? null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function listInstalledPets(themePetId = null) {
  const petsRoot = path.join(codexHome(), "pets");
  await fs.mkdir(petsRoot, { recursive: true });
  const realPetsRoot = await fs.realpath(petsRoot);
  const nativeSelectedPetId = await readNativeSelectedPetId();
  const pets = [];
  for (const entry of await fs.readdir(petsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const directory = await fs.realpath(path.join(realPetsRoot, entry.name));
      if (!isPathInside(directory, realPetsRoot)) continue;
      const pet = await loadPetPackage(directory);
      pets.push({
        id: pet.id,
        displayName: pet.displayName,
        description: pet.description,
        spriteVersionNumber: 2,
        selectedByTheme: pet.id === themePetId,
        selectedInCodex: pet.id === nativeSelectedPetId,
      });
    } catch {
      // Invalid pet packages stay untouched and are omitted from the manager.
    }
  }
  return pets.sort((left, right) => left.displayName.localeCompare(right.displayName, "zh-CN"));
}

export async function installAndSelectBundledPet(options, loaded) {
  const pet = loaded?.petBundle;
  if (!pet) return null;
  const petsRoot = path.join(codexHome(), "pets");
  await fs.mkdir(petsRoot, { recursive: true });
  const realPetsRoot = await fs.realpath(petsRoot);
  const destination = path.join(realPetsRoot, pet.id);
  try {
    const destinationStat = await fs.lstat(destination);
    if (destinationStat.isSymbolicLink() || !destinationStat.isDirectory()) throw new Error("目标宠物目录不是普通目录");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await fs.mkdir(destination);
  }
  const spritesheetPath = path.resolve(destination, pet.spritesheetPath);
  if (!isPathInside(spritesheetPath, destination)) throw new Error("宠物安装目标路径越界");
  let existingFingerprint = null;
  try { existingFingerprint = (await loadPetPackage(destination, pet.id)).fingerprint; } catch {}
  if (existingFingerprint !== pet.fingerprint) {
    if (existingFingerprint) {
      const backup = path.join(stateRootFor(options), "pet-backups", `${pet.id}-${Date.now()}`);
      await fs.mkdir(backup, { recursive: true });
      const existing = await loadPetPackage(destination, pet.id);
      await fs.writeFile(path.join(backup, "pet.json"), existing.manifestBytes);
      await fs.writeFile(path.join(backup, "spritesheet.webp"), existing.spritesheetBytes);
    }
    await fs.mkdir(path.dirname(spritesheetPath), { recursive: true });
    await fs.writeFile(spritesheetPath, pet.spritesheetBytes);
    await fs.writeFile(path.join(destination, "pet.json"), pet.manifestBytes);
  }
  if (await readNativeSelectedPetId() !== pet.id) {
    await execFile("powershell.exe", [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", path.join(here, "select-pet.ps1"), "-PetId", pet.id,
    ], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 });
  }
  return pet.id;
}

export async function setBaseThemeEnabled(options, enabled) {
  await execFile("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", path.join(here, "set-theme-base.ps1"),
    "-Mode", enabled ? "enable" : "disable",
    "-StateRoot", stateRootFor(options),
  ], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 });
}

export async function readPetAssociations(options) {
  const filePath = path.join(stateRootFor(options), "pet-associations.json");
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (!parsed || typeof parsed.associations !== "object" || Array.isArray(parsed.associations)) return {};
    return Object.fromEntries(Object.entries(parsed.associations).filter(([themeId, petId]) =>
      typeof themeId === "string" && typeof petId === "string" && themeId.length <= 80 && petId.length <= 80));
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return {};
    throw error;
  }
}

export async function writePetAssociations(options, associations) {
  const stateRoot = stateRootFor(options);
  await fs.mkdir(stateRoot, { recursive: true });
  const filePath = path.join(stateRoot, "pet-associations.json");
  const temporary = path.join(stateRoot, `.dream-pets-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  try {
    await fs.writeFile(temporary, `${JSON.stringify({ schemaVersion: 1, associations }, null, 2)}\n`, { flag: "wx" });
    await fs.copyFile(temporary, filePath);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

export async function updateThemeImageSettings(themeDirectory, settings = {}) {
  const loaded = await loadTheme(themeDirectory);
  const directory = path.dirname(loaded.themePath);
  const theme = { ...loaded.theme };
  const images = Array.isArray(theme.images) ? theme.images.map((entry) => ({ ...entry })) : [];
  const addedImages = Array.isArray(settings.addedImages) ? settings.addedImages.slice(0, 8) : [];
  if (addedImages.length) await fs.mkdir(path.join(directory, "images"), { recursive: true });
  for (const added of addedImages) {
    const name = normalizedText(added?.name, "addedImages.name", "image.png", 180);
    const extension = path.extname(name).toLowerCase();
    if (!SUPPORTED_ART_EXTENSIONS.includes(extension)) throw new Error("新增图片格式必须是 PNG、JPG、WebP 或 GIF");
    const bytes = decodeBoundedBase64(String(added?.base64 || ""), "新增图片", MAX_ART_BYTES);
    if (!readImageMetadata(bytes, extension)) throw new Error("新增图片尺寸无效或超过安全限制");
    const label = normalizedText(added?.label, "addedImages.label", path.basename(name, extension), 80);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 10);
    const id = safeThemeId(`${label}-${hash}`, `image-${hash}`);
    const relativePath = `images/${id}${extension}`;
    const destination = path.join(directory, relativePath);
    if (!isPathInside(destination, directory)) throw new Error("新增图片路径越界");
    await fs.writeFile(destination, bytes);
    images.push({ id, label, path: relativePath });
  }
  const display = normalizeImageDisplay(settings.display ?? theme.display);
  const sidebar = normalizeSidebarSettings(settings.sidebar ?? theme.sidebar);
  const composer = normalizeComposerSettings(settings.composer ?? theme.composer);
  const requestedDefault = normalizedText(settings.defaultImage, "defaultImage", theme.defaultImage || images[0]?.id || "default", 80);
  const defaultEntry = images.find((entry) => entry.id === requestedDefault) ?? images[0];
  if (!defaultEntry) throw new Error("主题至少需要一张图片");
  theme.defaultImage = defaultEntry.id;
  theme.image = defaultEntry.path;
  if (defaultEntry.previewPath) theme.previewImage = defaultEntry.previewPath;
  theme.images = images;
  theme.display = display;
  theme.sidebar = sidebar;
  theme.composer = composer;
  const files = new Set(["theme.json"]);
  for (const file of loaded.install?.files ?? []) files.add(file);
  files.add(theme.image);
  if (theme.previewImage) files.add(theme.previewImage);
  for (const entry of images) {
    files.add(entry.path);
    if (entry.previewPath) files.add(entry.previewPath);
  }
  for (const file of themeIconSourceFiles(loaded.icons)) files.add(file);
  theme.files = [...files].filter(Boolean).map((file) => String(file).replaceAll("\\", "/"));
  theme.install = {
    ...(theme.install ?? {}),
    default: theme.install?.default === true,
    files: theme.files,
    pets: loaded.install?.pets ?? (theme.pet?.id ? [theme.pet.id] : []),
  };
  await fs.writeFile(loaded.themePath, `${JSON.stringify(theme, null, 2)}\n`, "utf8");
  return loadTheme(directory);
}

async function previewDataUrl(loaded) {
  return imageDataUrl(loaded.previewImageBytes ?? loaded.imageBytes, loaded.previewImagePath ?? loaded.imagePath, 4 * 1024 * 1024);
}

function themeImageSummaries(loaded, includePreview = false) {
  const fallback = {
    id: loaded.theme.defaultImage || "default",
    label: "默认图",
    path: loaded.theme.image,
    previewPath: loaded.theme.previewImage,
    filePath: loaded.imagePath,
    bytes: loaded.imageBytes,
    previewFilePath: loaded.previewImagePath,
    previewBytes: loaded.previewImageBytes,
  };
  const entries = loaded.images?.length ? loaded.images : [fallback];
  return entries.map((entry) => ({
    id: entry.id,
    label: entry.label,
    path: entry.path,
    previewPath: entry.previewPath,
    ...(includePreview ? {
      preview: imageDataUrl(entry.previewBytes ?? entry.bytes, entry.previewFilePath ?? entry.filePath, 4 * 1024 * 1024),
    } : {}),
  }));
}

async function themeManagerSummary(loaded, key, extra = {}) {
  const includeCardPreview = extra.includeCardPreview !== false;
  const { includeCardPreview: _includeCardPreview, ...summaryExtra } = extra;
  return {
    key,
    id: loaded.theme.id,
    name: loaded.theme.name,
    description: loaded.theme.description,
    author: loaded.theme.author,
    version: loaded.theme.version,
    cardPreview: includeCardPreview ? await previewDataUrl(loaded) : null,
    brandIcon: loaded.theme.brandIcon,
    icons: loaded.icons,
    defaultImage: loaded.theme.defaultImage,
    images: themeImageSummaries(loaded),
    display: loaded.theme.display,
    sidebar: loaded.theme.sidebar,
    composer: loaded.theme.composer,
    files: loaded.theme.files,
    ...themePetSummary(loaded),
    accent: loaded.theme.palette?.accent ?? "#6edaf2",
    ...summaryExtra,
  };
}

function imageDataUrl(bytes, filePath, maxBytes) {
  if (!bytes || bytes.length > maxBytes) return null;
  const extension = path.extname(filePath).toLowerCase();
  const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
    : extension === ".webp" ? "image/webp" : extension === ".gif" ? "image/gif" : "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function petPreviewDataUrl(pet) {
  return pet ? imageDataUrl(pet.spritesheetBytes, pet.spritesheetFilePath || pet.spritesheetPath, 4 * 1024 * 1024) : null;
}

export async function installedPetPreviewDataUrl(petId) {
  const normalizedPetId = String(petId || "").trim();
  if (!PET_ID_PATTERN.test(normalizedPetId)) throw new Error("选择的宠物 id 无效");
  const petsRoot = path.join(codexHome(), "pets");
  await fs.mkdir(petsRoot, { recursive: true });
  const realPetsRoot = await fs.realpath(petsRoot);
  const directory = await fs.realpath(path.join(realPetsRoot, normalizedPetId));
  if (!isPathInside(directory, realPetsRoot)) throw new Error("宠物路径越界");
  const pet = await loadPetPackage(directory, normalizedPetId);
  return petPreviewDataUrl(pet);
}

export async function installedThemePreviewDataUrl(options, key) {
  const savedRoot = path.join(stateRootFor(options), "themes");
  const normalizedKey = safeThemeId(key, "");
  if (!normalizedKey || normalizedKey !== String(key)) throw new Error("无效的主题标识");
  const directory = path.resolve(savedRoot, normalizedKey);
  if (!isPathInside(directory, path.resolve(savedRoot))) throw new Error("主题路径越界");
  return previewDataUrl(await loadTheme(directory));
}

export async function installedThemeImagePreviewDataUrls(options, key) {
  const savedRoot = path.join(stateRootFor(options), "themes");
  const normalizedKey = safeThemeId(key, "");
  if (!normalizedKey || normalizedKey !== String(key)) throw new Error("无效的主题标识");
  const directory = path.resolve(savedRoot, normalizedKey);
  if (!isPathInside(directory, path.resolve(savedRoot))) throw new Error("主题路径越界");
  const loaded = await loadTheme(directory);
  return {
    ...(await themeManagerSummary(loaded, key, {
      localOnly: loaded.theme.localOnly === true,
      localPath: loaded.theme.localOnly === true ? directory : null,
      appearance: loaded.theme.appearance,
    })),
    images: themeImageSummaries(loaded, true),
  };
}

export async function bundledThemePreviewDataUrl(key) {
  const normalizedKey = normalizedText(key, "内置主题标识", "", 120);
  if (!normalizedKey || /[\\/:*?"<>]|\.\./.test(normalizedKey)) throw new Error("无效的内置主题标识");
  const bundledRoot = await fs.realpath(path.join(root, "themes"));
  const directory = await fs.realpath(path.resolve(bundledRoot, normalizedKey));
  if (!isPathInside(directory, bundledRoot)) throw new Error("内置主题路径越界");
  return previewDataUrl(await loadTheme(directory));
}

function themePetSummary(loaded) {
  const pet = loaded.petBundle;
  return pet ? { petId: pet.id, petName: pet.displayName } : {};
}

async function pruneDuplicateInstalledThemeDirectories(savedRoot) {
  const loadedItems = [];
  for (const entry of await fs.readdir(savedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(savedRoot, entry.name);
    try {
      const loaded = await loadTheme(directory);
      const stat = await fs.stat(directory);
      loadedItems.push({ key: entry.name, directory, id: loaded.theme.id, mtimeMs: stat.mtimeMs });
    } catch {
      // Invalid folders are ignored and left untouched.
    }
  }
  const groups = Map.groupBy(loadedItems, (item) => item.id);
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((left, right) => {
      const score = (item) => item.key.startsWith("bundled-") ? 3 : item.key.startsWith("library-") ? 2 : item.key.startsWith("preset-") ? 1 : 0;
      return score(right) - score(left) || right.mtimeMs - left.mtimeMs || right.key.localeCompare(left.key);
    });
    for (const duplicate of group.slice(1)) await fs.rm(duplicate.directory, { recursive: true, force: true });
  }
}

export async function listInstalledThemes(options) {
  const savedRoot = path.join(stateRootFor(options), "themes");
  await fs.mkdir(savedRoot, { recursive: true });
  await pruneDuplicateInstalledThemeDirectories(savedRoot);
  const items = [];
  for (const entry of await fs.readdir(savedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(savedRoot, entry.name);
    try {
      const loaded = await loadTheme(directory);
      items.push(await themeManagerSummary(loaded, entry.name, {
        includeCardPreview: false,
        localOnly: loaded.theme.localOnly === true,
        localPath: loaded.theme.localOnly === true ? directory : null,
        appearance: loaded.theme.appearance,
      }));
    } catch {
      // Invalid folders are ignored instead of becoming renderer-controlled paths.
    }
  }
  return items.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

export async function listBundledThemes() {
  const bundledRoot = path.join(root, "themes");
  const items = [];
  for (const entry of await fs.readdir(bundledRoot, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    try {
      const loaded = await loadTheme(path.join(bundledRoot, entry.name));
      items.push(await themeManagerSummary(loaded, entry.name, { includeCardPreview: false }));
    } catch {
      // Invalid bundled folders are omitted from the install catalog.
    }
  }
  return items.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function themeControlState(options, settings = {}) {
  const includePets = settings.includePets !== false;
  const active = await loadTheme(options.themeDir);
  const themes = await listInstalledThemes(options);
  const canEnableActive = themes.some((theme) => theme.id === active.theme.id);
  const selectedPet = canEnableActive ? active.petBundle?.id ?? null : null;
  return {
    version: SKIN_VERSION,
    hotReload: true,
    paused: await fileExists(options.pauseFile),
    active: { id: active.theme.id, name: active.theme.name },
    themes,
    canEnableActive,
    bundledThemes: await listBundledThemes(),
    libraries: await readLibraries(options),
    pets: includePets ? await listInstalledPets(selectedPet) : [],
    selectedPet,
    petAssociation: selectedPet,
  };
}

export async function readRemoteIndex(source) {
  const url = new URL(source.location);
  if (url.protocol !== "https:") throw new Error("远程主题库只允许 HTTPS 地址");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`主题库请求失败：HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_LIBRARY_INDEX_BYTES) throw new Error("主题库索引超过 1 MB 限制");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_LIBRARY_INDEX_BYTES) throw new Error("主题库索引超过 1 MB 限制");
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.themes)) throw new Error("主题库索引必须包含 themes 数组");
  return parsed.themes.slice(0, 100).map((item, index) => {
    if (!item || typeof item !== "object" || typeof item.themeUrl !== "string") {
      throw new Error(`主题库第 ${index + 1} 项缺少 themeUrl`);
    }
    const themeUrl = new URL(item.themeUrl, url);
    if (themeUrl.protocol !== "https:") throw new Error("远程主题文件只允许 HTTPS 地址");
    return {
      key: String(item.id || index),
      id: String(item.id || `remote-${index}`),
      name: String(item.name || item.id || `主题 ${index + 1}`).slice(0, 120),
      themeUrl: themeUrl.href,
      preview: typeof item.previewUrl === "string" ? new URL(item.previewUrl, url).href : null,
    };
  });
}

function parseGitHubRepository(value) {
  const url = new URL(String(value || "").trim());
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.username || url.password || url.search || url.hash) {
    throw new Error("仓库地址必须是公开的 HTTPS GitHub 仓库");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) throw new Error("仓库地址格式应为 https://github.com/owner/repo");
  const owner = parts[0];
  const repository = parts[1].replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repository)) {
    throw new Error("GitHub 仓库名称无效");
  }
  return { owner, repository, location: `https://github.com/${owner}/${repository}` };
}

export async function resolveGitHubRepository(value) {
  const parsed = parseGitHubRepository(value);
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}`;
  const response = await fetch(apiUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Codex-Dream-Skin" },
  });
  if (!response.ok) throw new Error(`GitHub 仓库读取失败：HTTP ${response.status}（仅支持公开仓库）`);
  const metadata = await response.json();
  const branch = normalizedText(metadata.default_branch, "repository.default_branch", "main", 120);
  const indexUrl = `https://raw.githubusercontent.com/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}/${encodeURIComponent(branch)}/theme-library.json`;
  await readRemoteIndex({ location: indexUrl });
  return { ...parsed, branch, indexUrl };
}

export async function localCatalog(source) {
  const sourceRoot = await fs.realpath(path.resolve(source.location));
  const candidates = [sourceRoot];
  for (const entry of await fs.readdir(sourceRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) candidates.push(path.join(sourceRoot, entry.name));
  }
  const items = [];
  for (const directory of candidates) {
    try {
      const loaded = await loadTheme(directory);
      items.push({
        key: path.relative(sourceRoot, directory) || ".",
        id: loaded.theme.id,
        name: loaded.theme.name,
        description: loaded.theme.description,
        author: loaded.theme.author,
        version: loaded.theme.version,
        accent: loaded.theme.palette?.accent ?? "#6edaf2",
        preview: await previewDataUrl(loaded),
      });
    } catch {}
  }
  return items;
}

export async function fetchRemoteTheme(themeUrl) {
  const url = new URL(themeUrl);
  if (url.protocol !== "https:") throw new Error("远程主题文件只允许 HTTPS 地址");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`主题文件请求失败：HTTP ${response.status}`);
  const themeText = await response.text();
  if (Buffer.byteLength(themeText, "utf8") > 128 * 1024) throw new Error("theme.json 过大");
  const rawTheme = JSON.parse(themeText);
  if (!rawTheme || typeof rawTheme !== "object" || Array.isArray(rawTheme) ||
    typeof rawTheme.image !== "string" || path.isAbsolute(rawTheme.image)) {
    throw new Error("远程主题 image 必须是相对路径");
  }
  const fetchRemoteImage = async (relativePath, label) => {
    if (typeof relativePath !== "string" || !relativePath.trim() || path.isAbsolute(relativePath)) {
      throw new Error(`远程主题 ${label} 必须是相对路径`);
    }
    const imageUrl = new URL(relativePath, url);
    if (imageUrl.protocol !== "https:") throw new Error(`远程主题 ${label} 只允许 HTTPS 地址`);
    const imageResponse = await fetch(imageUrl, { redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!imageResponse.ok) throw new Error(`${label} 请求失败：HTTP ${imageResponse.status}`);
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (bytes.length < 1 || bytes.length > MAX_ART_BYTES) throw new Error(`${label} 大小不在允许范围内`);
    const extension = path.extname(imageUrl.pathname).toLowerCase();
    if (!SUPPORTED_ART_EXTENSIONS.includes(extension) || !readImageMetadata(bytes, extension)) {
      throw new Error(`${label} 格式或尺寸无效`);
    }
    return { bytes, extension };
  };
  const { bytes, extension } = await fetchRemoteImage(rawTheme.image, "主题图片");
  const remotePreviewImage = normalizedText(rawTheme.previewImage, "previewImage", "", 240);
  const remotePreview = remotePreviewImage
    ? await fetchRemoteImage(remotePreviewImage, "主题预览图")
    : null;
  const art = rawTheme.art && typeof rawTheme.art === "object" && !Array.isArray(rawTheme.art) ? rawTheme.art : {};
  const palette = rawTheme.palette && typeof rawTheme.palette === "object" && !Array.isArray(rawTheme.palette) ? rawTheme.palette : {};
  const entrypoints = rawTheme.entrypoints && typeof rawTheme.entrypoints === "object" && !Array.isArray(rawTheme.entrypoints)
    ? rawTheme.entrypoints : {};
  const remoteFramework = rawTheme.framework && typeof rawTheme.framework === "object" && !Array.isArray(rawTheme.framework)
    ? rawTheme.framework : null;
  const usesSharedFramework = remoteFramework?.id === "dream-skin" && Number(remoteFramework?.version) === 1;
  if (rawTheme.framework !== undefined && !usesSharedFramework) {
    throw new Error("远程主题 framework 必须是 dream-skin version 1");
  }
  const fetchThemeCode = async (entry, field, extensionName, maximumBytes) => {
    if (typeof entry !== "string" || !entry.trim() || path.isAbsolute(entry)) {
      throw new Error(`远程主题 ${field} 必须是相对路径`);
    }
    const codeUrl = new URL(entry, url);
    if (codeUrl.protocol !== "https:" || path.extname(codeUrl.pathname).toLowerCase() !== extensionName) {
      throw new Error(`远程主题 ${field} 必须使用 HTTPS ${extensionName} 文件`);
    }
    const codeResponse = await fetch(codeUrl, { redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!codeResponse.ok) throw new Error(`${field} 请求失败：HTTP ${codeResponse.status}`);
    const code = await codeResponse.text();
    if (Buffer.byteLength(code, "utf8") < 1 || Buffer.byteLength(code, "utf8") > maximumBytes) {
      throw new Error(`${field} 为空或过大`);
    }
    return code;
  };
  const iconsEntry = typeof entrypoints.icons === "string" ? entrypoints.icons : "";
  const [themeCssText, remoteRendererText, iconsText] = await Promise.all([
    fetchThemeCode(entrypoints.css, "entrypoints.css", ".css", MAX_THEME_CSS_BYTES),
    usesSharedFramework ? null : fetchThemeCode(entrypoints.renderer, "entrypoints.renderer", ".js", MAX_THEME_SCRIPT_BYTES),
    iconsEntry ? fetchThemeCode(iconsEntry, "entrypoints.icons", ".json", MAX_THEME_ICONS_BYTES) : null,
  ]);
  let cssText = themeCssText;
  let rendererText = remoteRendererText;
  if (usesSharedFramework) {
    const [frameworkCssText, frameworkRendererText] = await Promise.all([
      fs.readFile(path.join(root, "engine", "theme-base.css"), "utf8"),
      fs.readFile(path.join(root, "engine", "theme-runtime.js"), "utf8"),
    ]);
    cssText = `${frameworkCssText.trimEnd()}\n\n${themeCssText.trim()}\n`;
    rendererText = frameworkRendererText;
    if (Buffer.byteLength(cssText, "utf8") > MAX_THEME_CSS_BYTES) throw new Error("远程主题与公共框架合并后的 CSS 过大");
  }
  const requiredPlaceholders = ["__DREAM_CSS_JSON__", "__DREAM_ART_JSON__", "__DREAM_THEME_JSON__"];
  if (iconsText || Number(rawTheme.schemaVersion) >= 3) requiredPlaceholders.push("__DREAM_ICONS_JSON__");
  for (const placeholder of requiredPlaceholders) {
    if (!rendererText.includes(placeholder)) throw new Error(`远程主题脚本缺少占位符：${placeholder}`);
  }
  const icons = iconsText ? normalizeThemeIcons(JSON.parse(iconsText)) : {};
  const brandIcon = normalizedText(rawTheme.brandIcon, "brandIcon", "", 40);
  if (brandIcon && (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(brandIcon) || (iconsText && !icons[brandIcon]))) {
    throw new Error("远程主题 brandIcon 无效或不在 icons.json 中");
  }
  let petBundle = null;
  let normalizedPet = null;
  if (rawTheme.pet !== undefined && rawTheme.pet !== null) {
    if (typeof rawTheme.pet !== "object" || Array.isArray(rawTheme.pet)) throw new Error("远程主题 pet 必须是对象");
    const petId = normalizedText(rawTheme.pet.id, "pet.id", "", 80);
    if (!PET_ID_PATTERN.test(petId)) throw new Error("远程主题 pet.id 无效");
    const petDirectory = normalizedText(rawTheme.pet.directory, "pet.directory", `../../../pets/${petId}`, 240);
    if (!petDirectory || path.isAbsolute(petDirectory)) throw new Error("远程主题 pet.directory 必须是相对路径");
    const manifestUrl = new URL(`${petDirectory.replace(/\/$/, "")}/pet.json`, url);
    if (manifestUrl.protocol !== "https:") throw new Error("远程宠物只允许 HTTPS 地址");
    const manifestResponse = await fetch(manifestUrl, { redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!manifestResponse.ok) throw new Error(`宠物清单请求失败：HTTP ${manifestResponse.status}`);
    const manifestBytes = Buffer.from(await manifestResponse.arrayBuffer());
    if (manifestBytes.length < 1 || manifestBytes.length > MAX_PET_MANIFEST_BYTES) throw new Error("远程宠物 pet.json 为空或过大");
    let petManifest;
    try { petManifest = JSON.parse(manifestBytes.toString("utf8")); }
    catch { throw new Error("远程宠物 pet.json 不是有效 JSON"); }
    const normalizedManifest = normalizePetManifest(petManifest, petId);
    const spritesheetUrl = new URL(normalizedManifest.spritesheetPath, manifestUrl);
    if (spritesheetUrl.protocol !== "https:") throw new Error("远程宠物图集只允许 HTTPS 地址");
    const spritesheetResponse = await fetch(spritesheetUrl, { redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!spritesheetResponse.ok) throw new Error(`宠物图集请求失败：HTTP ${spritesheetResponse.status}`);
    const spritesheetBytes = Buffer.from(await spritesheetResponse.arrayBuffer());
    petBundle = petBundleFromBytes(manifestBytes, spritesheetBytes, petId);
    normalizedPet = { id: petId };
  }
  const theme = {
    schemaVersion: iconsText ? 3 : 2,
    id: normalizedText(rawTheme.id, "id", "remote-theme", 80),
    name: normalizedText(rawTheme.name, "name", "远程主题", 120),
    description: normalizedText(rawTheme.description, "description", "", 240),
    author: normalizedText(rawTheme.author, "author", "", 120),
    version: normalizedText(rawTheme.version, "version", "1.0.0", 40),
    brandIcon,
    entrypoints: { css: "theme.css", renderer: "theme.js", ...(iconsText ? { icons: "icons.json" } : {}) },
    brandSubtitle: normalizedText(rawTheme.brandSubtitle, "brandSubtitle", "", 100),
    tagline: normalizedText(rawTheme.tagline, "tagline", "", 120),
    statusText: normalizedText(rawTheme.statusText, "statusText", "", 80),
    quote: normalizedText(rawTheme.quote, "quote", "", 100),
    image: `art${extension}`,
    ...(remotePreview ? { previewImage: `preview${remotePreview.extension}` } : {}),
    appearance: normalizedChoice(rawTheme.appearance, "appearance", THEME_CHOICES.appearance, "auto"),
    display: normalizeImageDisplay(rawTheme.display),
    sidebar: normalizeSidebarSettings(rawTheme.sidebar),
    composer: normalizeComposerSettings(rawTheme.composer),
    art: {
      focusX: normalizedUnit(art.focusX, "art.focusX"),
      focusY: normalizedUnit(art.focusY, "art.focusY"),
      safeArea: normalizedChoice(art.safeArea, "art.safeArea", THEME_CHOICES.safeArea, "auto"),
      taskMode: normalizedChoice(art.taskMode, "art.taskMode", THEME_CHOICES.taskMode, "auto"),
      homeMode: normalizedChoice(art.homeMode, "art.homeMode", THEME_CHOICES.homeMode, "themed"),
      immersive: art.immersive === true,
    },
    palette: {},
  };
  if (normalizedPet) theme.pet = normalizedPet;
  if (typeof palette.accent === "string" && palette.accent.trim()) {
    const accent = palette.accent.trim();
    if (!isSupportedCssColor(accent)) {
      throw new Error("远程主题 palette.accent 无效");
    }
    theme.palette.accent = accent;
  }
  return {
    theme, imageBytes: bytes, imagePath: `remote${extension}`,
    previewImageBytes: remotePreview?.bytes ?? null,
    previewImagePath: remotePreview ? `remote-preview${remotePreview.extension}` : null,
    petBundle,
    cssPath: "remote.css", cssText, rendererPath: "remote.js", rendererText,
    iconsPath: iconsText ? "remote-icons.json" : null, iconsText, icons,
    themePath: "remote", sourceStamp: "remote", fingerprint: "remote",
  };
}

export async function createLocalThemePackage({
  bundledRoot = path.join(root, "themes"),
  savedRoot,
  name: requestedName,
  baseKey: requestedBaseKey,
  imagePath: requestedImagePathValue,
  imageName: requestedImageNameValue = "",
  imageBase64: requestedImageBase64Value = "",
  iconsPath: requestedIconsPathValue = "",
  iconsJsonText: requestedIconsJsonTextValue = "",
  iconOverrides: requestedIconOverridesValue = null,
  palette: requestedPaletteValue = null,
}) {
  const name = normalizedText(requestedName, "本地主题名称", "", 80).trim();
  if (!name) throw new Error("请输入本地主题名称");
  const baseKey = normalizedText(requestedBaseKey, "基础主题标识", "", 120);
  if (!baseKey || /[\\/:*?"<>]|\.\./.test(baseKey)) throw new Error("请选择有效的基础主题");
  const realBundledRoot = await fs.realpath(bundledRoot);
  const baseDirectory = await fs.realpath(path.resolve(realBundledRoot, baseKey));
  if (!isPathInside(baseDirectory, realBundledRoot)) throw new Error("基础主题路径越界");
  const base = await loadTheme(baseDirectory);

  const uploadedImageBase64 = typeof requestedImageBase64Value === "string" ? requestedImageBase64Value.trim() : "";
  let imagePath;
  let imageBytes;
  let imageSource;
  if (uploadedImageBase64) {
    const imageName = normalizedText(requestedImageNameValue, "背景图片名称", "background.png", 180);
    const imageExtension = path.extname(imageName).toLowerCase();
    if (!SUPPORTED_ART_EXTENSIONS.includes(imageExtension)) throw new Error("背景图片格式必须是 PNG、JPG、WebP 或 GIF");
    imageBytes = decodeBoundedBase64(uploadedImageBase64, "背景图片", MAX_ART_BYTES);
    imagePath = `uploaded${imageExtension}`;
    imageSource = `upload:${imageName}:${createHash("sha256").update(imageBytes).digest("hex")}`;
  } else {
    const requestedImagePath = normalizedText(requestedImagePathValue, "背景图片路径", "", 1024).trim();
    if (!requestedImagePath || !path.isAbsolute(requestedImagePath)) throw new Error("请选择一张本机背景图片");
    imagePath = await fs.realpath(requestedImagePath);
    imageBytes = await fs.readFile(imagePath);
    imageSource = imagePath;
  }
  const imageExtension = path.extname(imagePath).toLowerCase();
  if (!SUPPORTED_ART_EXTENSIONS.includes(imageExtension)) throw new Error("背景图片格式必须是 PNG、JPG、WebP 或 GIF");
  if (imageBytes.length < 1 || imageBytes.length > MAX_ART_BYTES ||
      !readImageMetadata(imageBytes, imageExtension)) {
    throw new Error("背景图片为空、过大或尺寸无效");
  }

  let icons = base.icons ?? {};
  const requestedIconsPath = normalizedText(requestedIconsPathValue, "图标 JSON 路径", "", 1024).trim();
  let iconsPath = base.iconsPath;
  const iconsJsonText = typeof requestedIconsJsonTextValue === "string" ? requestedIconsJsonTextValue.trim() : "";
  if (iconsJsonText) {
    if (Buffer.byteLength(iconsJsonText, "utf8") > MAX_THEME_ICONS_BYTES) throw new Error("图标 JSON 为空或过大");
    const rawIcons = JSON.parse(iconsJsonText);
    icons = { ...icons, ...normalizeThemeIcons(rawIcons?.icons ?? rawIcons) };
    iconsPath = "uploaded-icons.json";
  } else if (requestedIconsPath) {
    if (!path.isAbsolute(requestedIconsPath) || path.extname(requestedIconsPath).toLowerCase() !== ".json") {
      throw new Error("图标文件必须是本机绝对路径的 JSON 文件");
    }
    iconsPath = await fs.realpath(requestedIconsPath);
    const iconsBytes = await fs.readFile(iconsPath);
    if (iconsBytes.length < 1 || iconsBytes.length > MAX_THEME_ICONS_BYTES) throw new Error("图标 JSON 为空或过大");
    icons = { ...icons, ...normalizeThemeIcons(JSON.parse(iconsBytes.toString("utf8"))) };
  }
  if (requestedIconOverridesValue && typeof requestedIconOverridesValue === "object" &&
      !Array.isArray(requestedIconOverridesValue) && Object.keys(requestedIconOverridesValue).length) {
    icons = { ...icons, ...normalizeThemeIcons(requestedIconOverridesValue) };
    iconsPath = "custom-icons.json";
  }
  const iconsText = Object.keys(icons).length ? `${JSON.stringify(icons, null, 2)}\n` : null;
  const colorFields = {
    accent: "--dream-accent",
    detail: "--dream-detail",
    sendBase: "--dream-send-base",
    processingBase: "--dream-processing-base",
  };
  const paletteInput = requestedPaletteValue && typeof requestedPaletteValue === "object" &&
    !Array.isArray(requestedPaletteValue) ? requestedPaletteValue : {};
  const colorOverrides = {};
  for (const [key, variable] of Object.entries(colorFields)) {
    const value = typeof paletteInput[key] === "string" ? paletteInput[key].trim() : "";
    if (!value) continue;
    if (!isSupportedCssColor(value)) {
      throw new Error(`主题色 ${key} 不是支持的 CSS 颜色`);
    }
    colorOverrides[key] = { variable, value };
  }
  const colorCss = Object.values(colorOverrides).map(({ variable, value }) => `  ${variable}: ${value};`).join("\n");
  const cssText = colorCss
    ? `${base.cssText.trimEnd()}\n\n:root.codex-dream-skin {\n${colorCss}\n}\n`
    : base.cssText;
  const idSeed = `${name}\0${imageSource}\0${Date.now()}\0${Math.random()}`;
  const localId = `local-${safeThemeId(name, "theme")}-${createHash("sha256").update(idSeed).digest("hex").slice(0, 10)}`;
  const localTheme = {
    ...base,
    theme: {
      ...base.theme,
      id: localId,
      name,
      description: "仅保存在本机的自定义背景与图标主题。",
      author: "本地用户",
      version: "1.0.0",
      localOnly: true,
      palette: {
        ...(base.theme.palette || {}),
        ...(colorOverrides.accent ? { accent: colorOverrides.accent.value } : {}),
      },
    },
    imagePath,
    imageBytes,
    previewImagePath: null,
    previewImageBytes: null,
    cssText,
    iconsPath: iconsText ? iconsPath : null,
    iconsText,
    icons,
  };
  await fs.mkdir(savedRoot, { recursive: true });
  const destination = path.join(savedRoot, localId);
  await writeThemeDirectory(destination, localTheme);
  return { id: localId, directory: destination };
}
