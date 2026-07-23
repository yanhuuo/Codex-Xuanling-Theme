import fs from "node:fs/promises";
import { watch as watchFiles } from "node:fs";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readImageMetadata } from "./image-metadata.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const here = path.dirname(scriptPath);
const root = path.resolve(here, "..");
const DEFAULT_THEME_DIR = path.join(root, "themes");
const SKIN_VERSION = "1.4.0";
const RUNTIME_PROTOCOL_VERSION = 1;
const MAX_ART_BYTES = 16 * 1024 * 1024;
const MAX_THEME_CSS_BYTES = 512 * 1024;
const MAX_THEME_SCRIPT_BYTES = 768 * 1024;
const MAX_THEME_ICONS_BYTES = 256 * 1024;
const MAX_LIBRARY_INDEX_BYTES = 1024 * 1024;
const MAX_PET_MANIFEST_BYTES = 128 * 1024;
const MAX_PET_SPRITESHEET_BYTES = 20 * 1024 * 1024;
const STRONG_THEME_AUDIT_MS = 30000;
const THEME_CONTROL_BINDING = "__codexDreamThemeControl";
const THEME_CONTROL_RESPONSE = "__codexDreamThemeResponse";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const BROWSER_ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;
const PET_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;
const execFile = promisify(execFileCallback);

class CdpIdentityMismatchError extends Error {}

function parseArgs(argv) {
  const options = {
    port: 9335,
    mode: "watch",
    timeoutMs: 30000,
    screenshot: null,
    reload: false,
    browserId: null,
    themeDir: DEFAULT_THEME_DIR,
    pauseFile: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port") options.port = Number(argv[++i]);
    else if (arg === "--once") options.mode = "once";
    else if (arg === "--watch") options.mode = "watch";
    else if (arg === "--verify") options.mode = "verify";
    else if (arg === "--verify-manager") options.mode = "verify-manager";
    else if (arg === "--remove") options.mode = "remove";
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++i]);
    else if (arg === "--browser-id") options.browserId = argv[++i];
    else if (arg === "--theme-dir") options.themeDir = path.resolve(argv[++i]);
    else if (arg === "--pause-file") options.pauseFile = path.resolve(argv[++i]);
    else if (arg === "--screenshot") options.screenshot = path.resolve(argv[++i]);
    else if (arg === "--reload") options.reload = true;
    else if (arg === "--self-test") options.mode = "self-test";
    else if (arg === "--check-payload") options.mode = "check-payload";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) {
    throw new Error(`Invalid port: ${options.port}`);
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 250 || options.timeoutMs > 120000) {
    throw new Error(`Invalid timeout: ${options.timeoutMs}`);
  }
  if (options.browserId !== null && !BROWSER_ID_PATTERN.test(options.browserId)) {
    throw new Error(`Invalid browser ID: ${options.browserId}`);
  }
  if (["watch", "once", "verify", "verify-manager", "remove"].includes(options.mode) && !options.browserId) {
    throw new Error(`--browser-id is required in ${options.mode} mode`);
  }
  return options;
}

function validatedDebuggerUrl(target, port) {
  const url = new URL(target.webSocketDebuggerUrl);
  const pathIsValid = /^\/devtools\/(?:page|browser)\/[A-Za-z0-9._-]{1,200}$/.test(url.pathname);
  if (url.protocol !== "ws:" || !LOOPBACK_HOSTS.has(url.hostname) || Number(url.port) !== port ||
      url.username || url.password || url.search || url.hash || !pathIsValid) {
    throw new Error("Rejected a CDP WebSocket URL outside the allowed loopback endpoint shape");
  }
  return url.href;
}

function browserIdFromVersion(version, port) {
  const url = validatedDebuggerUrl(version, port);
  const parsed = new URL(url);
  const match = parsed.pathname.match(/^\/devtools\/browser\/([A-Za-z0-9._-]{1,200})$/);
  if (!match || parsed.search || parsed.hash || !BROWSER_ID_PATTERN.test(match[1])) {
    throw new Error("Rejected an invalid CDP browser identity URL");
  }
  return match[1];
}

function isValidCdpPageTarget(item, port) {
  if (item?.type !== "page" || !item.url?.startsWith("app://") || typeof item.id !== "string" ||
      !BROWSER_ID_PATTERN.test(item.id) || !item.webSocketDebuggerUrl) return false;
  try {
    const debuggerUrl = new URL(validatedDebuggerUrl(item, port));
    return debuggerUrl.pathname === `/devtools/page/${item.id}`;
  } catch {
    return false;
  }
}

class CdpSession {
  constructor(target, port) {
    this.target = target;
    this.ws = new WebSocket(validatedDebuggerUrl(target, port));
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { this.ws.close(); } catch {}
        reject(new Error("CDP WebSocket open timed out"));
      }, 5000);
      this.ws.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.ws.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("CDP WebSocket open failed")); }, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.onMessage(event));
    this.ws.addEventListener("error", () => this.close());
    this.ws.addEventListener("close", () => {
      this.closed = true;
      for (const waiter of this.pending.values()) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error("CDP socket closed"));
      }
      this.pending.clear();
    });
    await this.send("Runtime.enable");
    await this.send("Page.enable");
    return this;
  }

  onMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      this.close();
      return;
    }
    if (message.id) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      clearTimeout(waiter.timeout);
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
      else waiter.resolve(message.result);
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error("CDP session is closed"));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 10000);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: false,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Renderer evaluation failed: ${detail}`);
    }
    return result.result?.value;
  }

  close() {
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("CDP session closed"));
    }
    this.pending.clear();
    if (!this.closed) {
      try { this.ws.close(); } catch {}
    }
    this.closed = true;
  }
}

class BrowserIdentityAnchor {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.closed = false;
    this.ws.addEventListener("close", () => { this.closed = true; });
    this.ws.addEventListener("error", () => {
      this.closed = true;
      try { this.ws.close(); } catch {}
    });
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.close();
        reject(new Error("CDP browser identity WebSocket open timed out"));
      }, 5000);
      this.ws.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.ws.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("CDP browser identity WebSocket open failed"));
      }, { once: true });
      this.ws.addEventListener("close", () => {
        clearTimeout(timeout);
        reject(new Error("CDP browser identity WebSocket closed during startup"));
      }, { once: true });
    });
    if (this.closed) throw new Error("CDP browser identity WebSocket is already closed");
    return this;
  }

  close() {
    if (!this.closed) {
      try { this.ws.close(); } catch {}
    }
    this.closed = true;
  }
}

async function fetchCdpJson(port, resource) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`http://127.0.0.1:${port}${resource}`, {
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function listAppTargets(port, expectedBrowserId = null) {
  const targets = await fetchCdpJson(port, "/json/list");
  if (!Array.isArray(targets)) throw new Error("CDP target list is not an array");
  if (expectedBrowserId) {
    const version = await fetchCdpJson(port, "/json/version");
    const actualBrowserId = browserIdFromVersion(version, port);
    if (actualBrowserId !== expectedBrowserId) {
      throw new CdpIdentityMismatchError(
        `CDP browser identity changed from ${expectedBrowserId} to ${actualBrowserId}`,
      );
    }
  }
  return targets.filter((item) => isValidCdpPageTarget(item, port));
}

async function connectBrowserIdentityAnchor(port, expectedBrowserId) {
  const version = await fetchCdpJson(port, "/json/version");
  const actualBrowserId = browserIdFromVersion(version, port);
  if (actualBrowserId !== expectedBrowserId) {
    throw new CdpIdentityMismatchError(
      `CDP browser identity changed from ${expectedBrowserId} to ${actualBrowserId}`,
    );
  }
  return new BrowserIdentityAnchor(validatedDebuggerUrl(version, port)).open();
}

const THEME_CHOICES = {
  appearance: new Set(["auto", "light", "dark"]),
  safeArea: new Set(["auto", "left", "right", "center", "none"]),
  taskMode: new Set(["auto", "ambient", "banner", "off"]),
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

function normalizedText(value, name, fallback, maxLength = 120) {
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
      const installText = await fs.readFile(path.join(directory, "install.json"), "utf8");
      const install = JSON.parse(installText);
      if (Number(install?.schemaVersion) === 1 && install?.manifest === "theme.json") {
        candidates.push({ directory, isDefault: install.default === true });
      }
    } catch {
      // A theme collection may contain unrelated folders.
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

async function loadPetPackage(packageDirectory, expectedId = null) {
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

async function loadTheme(themeDir) {
  const realThemeDir = await resolveThemePackageDirectory(themeDir);
  const install = await loadThemeInstallManifest(realThemeDir);
  const themePath = path.join(realThemeDir, "theme.json");
  const themeText = await fs.readFile(themePath, "utf8");
  const raw = JSON.parse(themeText);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Theme root must be an object");
  }
  const image = normalizedText(raw.image, "image", null, 240);
  if (!image || path.isAbsolute(image)) throw new Error("Theme image must be a relative path");
  const imagePath = path.resolve(realThemeDir, image);
  const relativeImage = path.relative(realThemeDir, imagePath);
  if (!relativeImage || relativeImage.startsWith("..") || path.isAbsolute(relativeImage)) {
    throw new Error("Theme image must remain inside the selected theme directory");
  }
  const extension = path.extname(imagePath).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    throw new Error(`Unsupported theme image format: ${extension || "missing"}`);
  }
  const realImagePath = await fs.realpath(imagePath);
  const realRelativeImage = path.relative(realThemeDir, realImagePath);
  if (!realRelativeImage || realRelativeImage.startsWith("..") || path.isAbsolute(realRelativeImage)) {
    throw new Error("Theme image cannot escape through a link or junction");
  }
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
  const iconsBundle = iconsEntry
    ? await loadThemeCode(iconsEntry, null, "entrypoints.icons", ".json", MAX_THEME_ICONS_BYTES)
    : null;
  const icons = iconsBundle ? normalizeThemeIcons(JSON.parse(iconsBundle.text)) : {};
  const brandIcon = normalizedText(raw.brandIcon, "brandIcon", "", 40);
  if (brandIcon && !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(brandIcon)) throw new Error("brandIcon is invalid");
  if (brandIcon && iconsBundle && !icons[brandIcon]) throw new Error(`brandIcon is missing from icons.json: ${brandIcon}`);
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
    schemaVersion: Number(raw.schemaVersion) >= 3 ? 3 : Number(raw.schemaVersion) === 2 ? 2 : 1,
    id: normalizedText(raw.id, "id", "custom", 80),
    name: normalizedText(raw.name, "name", "Codex Dream Skin", 120),
    description: normalizedText(raw.description, "description", "", 240),
    author: normalizedText(raw.author, "author", "", 120),
    version: normalizedText(raw.version, "version", "1.0.0", 40),
    localOnly: raw.localOnly === true,
    ...(usesSharedFramework ? { framework: { id: "dream-skin", version: 1 } } : {}),
    entrypoints: { css: "theme.css", renderer: "theme.js", ...(iconsBundle ? { icons: "icons.json" } : {}) },
    brandIcon,
    brandSubtitle: normalizedText(raw.brandSubtitle, "brandSubtitle", "", 100),
    tagline: normalizedText(raw.tagline, "tagline", "", 120),
    statusText: normalizedText(raw.statusText, "statusText", "", 80),
    quote: normalizedText(raw.quote, "quote", "", 100),
    image,
    appearance: normalizedChoice(raw.appearance, "appearance", THEME_CHOICES.appearance, "auto"),
    art: {
      focusX: normalizedUnit(art.focusX, "art.focusX"),
      focusY: normalizedUnit(art.focusY, "art.focusY"),
      safeArea: normalizedChoice(art.safeArea, "art.safeArea", THEME_CHOICES.safeArea, "auto"),
      taskMode: normalizedChoice(art.taskMode, "art.taskMode", THEME_CHOICES.taskMode, "auto"),
    },
    palette: {},
  };
  if (typeof palette.accent === "string" && palette.accent.trim()) {
    const accent = palette.accent.trim();
    if (!/^(?:#[\da-f]{3,8}|(?:rgb|hsl|oklch|oklab)\([^;{}]{1,96}\))$/i.test(accent)) {
      throw new Error("palette.accent is not a supported CSS color");
    }
    theme.palette.accent = accent;
  }
  const [themeStat, imageStat, cssStat, rendererStat, iconsStat] = await Promise.all([
    fs.stat(themePath), fs.stat(realImagePath), fs.stat(cssBundle.path), fs.stat(rendererBundle.path),
    iconsBundle ? fs.stat(iconsBundle.path) : null,
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
  theme.artMetadata = artMetadata;
  const fingerprintBuilder = createHash("sha256")
    .update(themeText, "utf8")
    .update("\0")
    .update(imageBytes)
    .update("\0")
    .update(cssBundle.bytes)
    .update("\0")
    .update(rendererBundle.bytes);
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
    sourceStamp: `${themeStat.size}:${themeStat.mtimeMs}:${imageStat.size}:${imageStat.mtimeMs}:${cssStat.size}:${cssStat.mtimeMs}:${rendererStat.size}:${rendererStat.mtimeMs}:${iconsStat?.size ?? 0}:${iconsStat?.mtimeMs ?? 0}${petStamp}`,
  };
}

async function loadPayload(themeDir = DEFAULT_THEME_DIR, candidateTheme = null) {
  const loadedTheme = candidateTheme ?? await loadTheme(themeDir);
  const css = loadedTheme.cssText;
  const template = loadedTheme.rendererText;
  const extension = path.extname(loadedTheme.imagePath).toLowerCase();
  const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
    : extension === ".webp" ? "image/webp" : "image/png";
  const artDataUrl = `data:${mime};base64,${loadedTheme.imageBytes.toString("base64")}`;
  const themePayload = template
    .replace("__DREAM_CSS_JSON__", JSON.stringify(css))
    .replace("__DREAM_ART_JSON__", JSON.stringify(artDataUrl))
    .replace("__DREAM_THEME_JSON__", JSON.stringify(loadedTheme.theme))
    .replace("__DREAM_ICONS_JSON__", JSON.stringify(loadedTheme.icons ?? {}));
  const payload = `${themePayload}
;window.__CODEX_DREAM_SKIN_RUNTIME__ = Object.freeze({
  protocolVersion: ${JSON.stringify(RUNTIME_PROTOCOL_VERSION)},
  injectorVersion: ${JSON.stringify(SKIN_VERSION)},
  themeId: ${JSON.stringify(loadedTheme.theme.id)},
  themeVersion: ${JSON.stringify(loadedTheme.theme.version)}
});`;
  const { imageBytes: _imageBytes, ...themeState } = loadedTheme;
  return { ...themeState, payload };
}

function stateRootFor(options) {
  return path.dirname(options.themeDir);
}

function isPathInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeThemeId(value, fallback = "theme") {
  const cleaned = String(value || fallback).trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (cleaned || fallback).slice(0, 72);
}

function themeForDisk(loaded, imageName) {
  const { artMetadata: _metadata, framework: _framework, ...theme } = loaded.theme;
  const diskTheme = {
    ...theme,
    schemaVersion: loaded.iconsText ? 3 : 2,
    entrypoints: {
      css: "theme.css",
      renderer: "theme.js",
      ...(loaded.iconsText ? { icons: "icons.json" } : {}),
    },
    image: imageName,
  };
  if (loaded.petBundle) diskTheme.pet = { id: loaded.petBundle.id };
  else delete diskTheme.pet;
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

async function writeThemeDirectory(destination, loaded) {
  await fs.mkdir(destination, { recursive: true });
  const realParent = await fs.realpath(path.dirname(destination));
  const resolvedDestination = path.resolve(destination);
  if (!isPathInside(resolvedDestination, realParent)) throw new Error("Theme destination escaped its managed folder");
  const extension = path.extname(loaded.imagePath).toLowerCase();
  const imageName = `art${extension}`;
  const imagePath = path.join(resolvedDestination, imageName);
  const cssPath = path.join(resolvedDestination, "theme.css");
  const rendererPath = path.join(resolvedDestination, "theme.js");
  const iconsPath = path.join(resolvedDestination, "icons.json");
  const imageTemp = path.join(resolvedDestination, `.dream-image-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  const jsonTemp = path.join(resolvedDestination, `.dream-theme-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
  try {
    await fs.writeFile(imageTemp, loaded.imageBytes, { flag: "wx" });
    await fs.copyFile(imageTemp, imagePath);
    await fs.writeFile(cssPath, loaded.cssText, "utf8");
    await fs.writeFile(rendererPath, loaded.rendererText, "utf8");
    if (loaded.iconsText) await fs.writeFile(iconsPath, loaded.iconsText, "utf8");
    else await fs.rm(iconsPath, { force: true });
    await fs.rm(path.join(resolvedDestination, "pets"), { recursive: true, force: true });
    await writePetBundleToStore(stateRootFromThemeDestination(resolvedDestination), loaded.petBundle);
    await fs.writeFile(jsonTemp, `${JSON.stringify(themeForDisk(loaded, imageName), null, 2)}\n`, { flag: "wx" });
    await fs.copyFile(jsonTemp, path.join(resolvedDestination, "theme.json"));
    const packageFiles = ["theme.json", "theme.css", "theme.js", ...(loaded.iconsText ? ["icons.json"] : []), imageName];
    await fs.writeFile(path.join(resolvedDestination, "install.json"), `${JSON.stringify({
      schemaVersion: 1,
      default: false,
      manifest: "theme.json",
      files: packageFiles,
      pets: loaded.petBundle ? [loaded.petBundle.id] : [],
    }, null, 2)}\n`, "utf8");
  } finally {
    await fs.rm(imageTemp, { force: true }).catch(() => {});
    await fs.rm(jsonTemp, { force: true }).catch(() => {});
  }
}

async function readLibraries(options) {
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

async function writeLibraries(options, sources) {
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

function codexHome() {
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

async function installAndSelectBundledPet(options, loaded) {
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

async function setBaseThemeEnabled(options, enabled) {
  await execFile("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", path.join(here, "set-theme-base.ps1"),
    "-Mode", enabled ? "enable" : "disable",
    "-StateRoot", stateRootFor(options),
  ], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 });
}

async function readPetAssociations(options) {
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

async function writePetAssociations(options, associations) {
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

async function previewDataUrl(loaded) {
  if (loaded.imageBytes.length > 4 * 1024 * 1024) return null;
  const extension = path.extname(loaded.imagePath).toLowerCase();
  const mime = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg"
    : extension === ".webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${loaded.imageBytes.toString("base64")}`;
}

async function listInstalledThemes(options) {
  const savedRoot = path.join(stateRootFor(options), "themes");
  await fs.mkdir(savedRoot, { recursive: true });
  const items = [];
  for (const entry of await fs.readdir(savedRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(savedRoot, entry.name);
    try {
      const loaded = await loadTheme(directory);
      items.push({
        key: entry.name,
        id: loaded.theme.id,
        name: loaded.theme.name,
        description: loaded.theme.description,
        author: loaded.theme.author,
        version: loaded.theme.version,
        localOnly: loaded.theme.localOnly === true,
        localPath: loaded.theme.localOnly === true ? directory : null,
        appearance: loaded.theme.appearance,
        brandIcon: loaded.theme.brandIcon,
        icons: loaded.icons,
        accent: loaded.theme.palette?.accent ?? "#6edaf2",
        preview: await previewDataUrl(loaded),
      });
    } catch {
      // Invalid folders are ignored instead of becoming renderer-controlled paths.
    }
  }
  return items.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

async function listBundledThemes() {
  const bundledRoot = path.join(root, "themes");
  const items = [];
  for (const entry of await fs.readdir(bundledRoot, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    try {
      const loaded = await loadTheme(path.join(bundledRoot, entry.name));
      items.push({
        key: entry.name,
        id: loaded.theme.id,
        name: loaded.theme.name,
        description: loaded.theme.description,
        author: loaded.theme.author,
        version: loaded.theme.version,
        brandIcon: loaded.theme.brandIcon,
        icons: loaded.icons,
        accent: loaded.theme.palette?.accent ?? "#6edaf2",
        preview: await previewDataUrl(loaded),
      });
    } catch {
      // Invalid bundled folders are omitted from the install catalog.
    }
  }
  return items.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

async function themeControlState(options) {
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
    pets: await listInstalledPets(selectedPet),
    selectedPet,
    petAssociation: selectedPet,
  };
}

async function readRemoteIndex(source) {
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

async function resolveGitHubRepository(value) {
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

async function localCatalog(source) {
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

async function fetchRemoteTheme(themeUrl) {
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
  const imageUrl = new URL(rawTheme.image, url);
  if (imageUrl.protocol !== "https:") throw new Error("远程主题图片只允许 HTTPS 地址");
  const imageResponse = await fetch(imageUrl, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!imageResponse.ok) throw new Error(`主题图片请求失败：HTTP ${imageResponse.status}`);
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (bytes.length < 1 || bytes.length > MAX_ART_BYTES) throw new Error("主题图片大小不在允许范围内");
  const extension = path.extname(imageUrl.pathname).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension) || !readImageMetadata(bytes, extension)) {
    throw new Error("远程主题图片格式或尺寸无效");
  }
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
    appearance: normalizedChoice(rawTheme.appearance, "appearance", THEME_CHOICES.appearance, "auto"),
    art: {
      focusX: normalizedUnit(art.focusX, "art.focusX"),
      focusY: normalizedUnit(art.focusY, "art.focusY"),
      safeArea: normalizedChoice(art.safeArea, "art.safeArea", THEME_CHOICES.safeArea, "auto"),
      taskMode: normalizedChoice(art.taskMode, "art.taskMode", THEME_CHOICES.taskMode, "auto"),
    },
    palette: {},
  };
  if (normalizedPet) theme.pet = normalizedPet;
  if (typeof palette.accent === "string" && palette.accent.trim()) {
    const accent = palette.accent.trim();
    if (!/^(?:#[\da-f]{3,8}|(?:rgb|hsl|oklch|oklab)\([^;{}]{1,96}\))$/i.test(accent)) {
      throw new Error("远程主题 palette.accent 无效");
    }
    theme.palette.accent = accent;
  }
  return {
    theme, imageBytes: bytes, imagePath: `remote${extension}`, petBundle,
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
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(imageExtension)) throw new Error("背景图片格式必须是 PNG、JPG 或 WebP");
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
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(imageExtension)) throw new Error("背景图片格式必须是 PNG、JPG 或 WebP");
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
    },
    imagePath,
    imageBytes,
    iconsPath: iconsText ? iconsPath : null,
    iconsText,
    icons,
  };
  await fs.mkdir(savedRoot, { recursive: true });
  const destination = path.join(savedRoot, localId);
  await writeThemeDirectory(destination, localTheme);
  return { id: localId, directory: destination };
}

async function handleThemeControl(options, request) {
  if (!request || typeof request !== "object" || typeof request.command !== "string") throw new Error("无效的主题控制请求");
  const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
  const stateRoot = stateRootFor(options);
  const savedRoot = path.join(stateRoot, "themes");
  if (request.command === "getState") return themeControlState(options);
  if (request.command === "setPaused") {
    await fs.mkdir(stateRoot, { recursive: true });
    if (Boolean(payload.paused)) {
      await fs.writeFile(options.pauseFile, "paused\n");
      await setBaseThemeEnabled(options, false);
    } else {
      const active = await loadTheme(options.themeDir);
      if (!(await listInstalledThemes(options)).some((theme) => theme.id === active.theme.id)) {
        throw new Error("请先安装主题，再启用主题外观");
      }
      await setBaseThemeEnabled(options, true);
      await installAndSelectBundledPet(options, active);
      await fs.rm(options.pauseFile, { force: true });
    }
    return themeControlState(options);
  }
  if (request.command === "useTheme") {
    const key = safeThemeId(payload.key, "");
    if (!key || key !== String(payload.key)) throw new Error("无效的主题标识");
    const directory = path.resolve(savedRoot, key);
    if (!isPathInside(directory, path.resolve(savedRoot))) throw new Error("主题路径越界");
    const loaded = await loadTheme(directory);
    await writeThemeDirectory(options.themeDir, loaded);
    await setBaseThemeEnabled(options, true);
    await installAndSelectBundledPet(options, loaded);
    await fs.rm(options.pauseFile, { force: true });
    return themeControlState(options);
  }
  if (request.command === "installBundledTheme") {
    const key = normalizedText(payload.key, "内置主题标识", "", 120);
    if (!key || /[\\/:*?"<>]|\.\./.test(key)) throw new Error("无效的内置主题标识");
    const bundledRoot = await fs.realpath(path.join(root, "themes"));
    const directory = await fs.realpath(path.resolve(bundledRoot, key));
    if (!isPathInside(directory, bundledRoot)) throw new Error("内置主题路径越界");
    const loaded = await loadTheme(directory);
    await fs.mkdir(savedRoot, { recursive: true });
    await writeThemeDirectory(path.join(savedRoot, `bundled-${safeThemeId(loaded.theme.id)}`), loaded);
    return themeControlState(options);
  }
  if (request.command === "createLocalTheme") {
    await createLocalThemePackage({
      savedRoot,
      name: payload.name,
      baseKey: payload.baseKey,
      imagePath: payload.imagePath,
      imageName: payload.imageName,
      imageBase64: payload.imageBase64,
      iconsPath: payload.iconsPath,
      iconsJsonText: payload.iconsJsonText,
      iconOverrides: payload.iconOverrides,
    });
    return themeControlState(options);
  }
  if (request.command === "selectPet" || request.command === "associatePet") {
    const active = await loadTheme(options.themeDir);
    if (!(await listInstalledThemes(options)).some((theme) => theme.id === active.theme.id)) {
      throw new Error("请先安装并启用一个主题，再选择主题宠物");
    }
    const petId = String(payload.petId || "").trim();
    let selectedBundle = null;
    if (petId) {
      if (!PET_ID_PATTERN.test(petId)) throw new Error("选择的宠物 id 无效");
      selectedBundle = await loadPetPackage(path.join(codexHome(), "pets", petId), petId);
    }
    const withSelection = {
      ...active,
      theme: { ...active.theme },
      petBundle: selectedBundle,
    };
    if (selectedBundle) withSelection.theme.pet = { id: selectedBundle.id };
    else delete withSelection.theme.pet;
    await writeThemeDirectory(options.themeDir, withSelection);
    for (const entry of await fs.readdir(savedRoot, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue;
      const directory = path.join(savedRoot, entry.name);
      try {
        const saved = await loadTheme(directory);
        if (saved.theme.id !== active.theme.id) continue;
        const savedWithSelection = {
          ...saved,
          theme: { ...saved.theme },
          petBundle: selectedBundle,
        };
        if (selectedBundle) savedWithSelection.theme.pet = { id: selectedBundle.id };
        else delete savedWithSelection.theme.pet;
        await writeThemeDirectory(directory, savedWithSelection);
      } catch {
        // A broken saved theme must not prevent changing the active theme.
      }
    }
    if (selectedBundle) await installAndSelectBundledPet(options, withSelection);
    return themeControlState(options);
  }
  if (request.command === "addRepository") {
    const repository = await resolveGitHubRepository(payload.location);
    const sources = await readLibraries(options);
    const id = createHash("sha256").update(`repository\0${repository.location}`).digest("hex").slice(0, 16);
    if (!sources.some((item) => item.id === id)) {
      sources.push({
        id,
        type: "repository",
        label: String(payload.label || "").trim().slice(0, 80) || `${repository.owner}/${repository.repository}`,
        location: repository.location,
        indexUrl: repository.indexUrl,
        branch: repository.branch,
      });
    }
    await writeLibraries(options, sources);
    return themeControlState(options);
  }
  if (request.command === "addLibrary") {
    const location = String(payload.location || "").trim();
    if (!location || location.length > 2048 || /[\u0000-\u001f]/.test(location)) throw new Error("请输入有效的主题库路径或 HTTPS 地址");
    const type = /^https:\/\//i.test(location) ? "remote" : "local";
    if (type === "local") {
      const stat = await fs.stat(path.resolve(location));
      if (!stat.isDirectory()) throw new Error("本地主题库必须是文件夹");
    } else {
      new URL(location);
    }
    const sources = await readLibraries(options);
    const id = createHash("sha256").update(`${type}\0${location}`).digest("hex").slice(0, 16);
    if (!sources.some((item) => item.id === id)) sources.push({ id, type, label: String(payload.label || "").trim().slice(0, 80) || (type === "local" ? path.basename(location) : new URL(location).hostname), location });
    await writeLibraries(options, sources);
    return themeControlState(options);
  }
  if (request.command === "removeLibrary") {
    const sources = (await readLibraries(options)).filter((item) => item.id !== payload.id);
    await writeLibraries(options, sources);
    return themeControlState(options);
  }
  if (request.command === "getCatalog") {
    const source = (await readLibraries(options)).find((item) => item.id === payload.id);
    if (!source) throw new Error("主题库不存在");
    const themes = source.type === "local" ? await localCatalog(source) :
      await readRemoteIndex(source.type === "repository" ? { ...source, location: source.indexUrl } : source);
    return { source: { id: source.id, label: source.label, type: source.type }, themes };
  }
  if (request.command === "installLibraryTheme") {
    const source = (await readLibraries(options)).find((item) => item.id === payload.sourceId);
    if (!source) throw new Error("主题库不存在");
    let loaded;
    if (source.type === "local") {
      const sourceRoot = await fs.realpath(path.resolve(source.location));
      const directory = await fs.realpath(path.resolve(sourceRoot, String(payload.key || ".")));
      if (!isPathInside(directory, sourceRoot)) throw new Error("主题路径越界");
      loaded = await loadTheme(directory);
    } else {
      const catalogSource = source.type === "repository" ? { ...source, location: source.indexUrl } : source;
      const catalog = await readRemoteIndex(catalogSource);
      const item = catalog.find((candidate) => candidate.key === String(payload.key));
      if (!item) throw new Error("远程主题不存在");
      loaded = await fetchRemoteTheme(item.themeUrl);
      loaded.theme = { ...loaded.theme, id: normalizedText(loaded.theme.id, "id", item.id, 80), name: normalizedText(loaded.theme.name, "name", item.name, 120) };
    }
    await fs.mkdir(savedRoot, { recursive: true });
    const directoryName = `library-${safeThemeId(loaded.theme.id)}-${createHash("sha256").update(`${source.id}\0${loaded.theme.id}`).digest("hex").slice(0, 8)}`;
    await writeThemeDirectory(path.join(savedRoot, directoryName), loaded);
    return themeControlState(options);
  }
  throw new Error(`未知的主题控制命令：${request.command}`);
}

async function attachThemeControl(session, options) {
  const bindingName = `${THEME_CONTROL_BINDING}_${process.pid}_${Math.random().toString(16).slice(2)}`;
  await session.send("Runtime.addBinding", { name: bindingName });
  const bridgeSource = `(() => {
    const target = ${JSON.stringify(bindingName)};
    window[${JSON.stringify(THEME_CONTROL_BINDING)}] = (payload) => window[target](payload);
  })();`;
  const bridgeScriptId = (await session.send("Page.addScriptToEvaluateOnNewDocument", { source: bridgeSource })).identifier ?? null;
  await session.evaluate(bridgeSource);
  session.on("Runtime.bindingCalled", ({ name, payload }) => {
    if (name !== bindingName) return;
    let request;
    try {
      if (typeof payload !== "string" || Buffer.byteLength(payload, "utf8") > 32768) throw new Error("主题控制请求过大");
      request = JSON.parse(payload);
    } catch (error) {
      request = { requestId: null, invalidError: error.message };
    }
    Promise.resolve().then(async () => {
      let response;
      try {
        if (request.invalidError) throw new Error(request.invalidError);
        response = { requestId: request.requestId, ok: true, result: await handleThemeControl(options, request) };
      } catch (error) {
        response = { requestId: request?.requestId ?? null, ok: false, error: String(error?.message || error) };
      }
      const detail = JSON.stringify(response);
      await session.evaluate(`window.dispatchEvent(new CustomEvent(${JSON.stringify(THEME_CONTROL_RESPONSE)}, { detail: ${JSON.stringify(detail)} }))`).catch(() => {});
    });
  });
  return bridgeScriptId;
}

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    return (await fs.stat(filePath)).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readThemeSourceStamp(loadedTheme) {
  const [themeStat, imageStat, cssStat, rendererStat, iconsStat] = await Promise.all([
    fs.stat(loadedTheme.themePath),
    fs.stat(loadedTheme.imagePath),
    fs.stat(loadedTheme.cssPath),
    fs.stat(loadedTheme.rendererPath),
    loadedTheme.iconsPath ? fs.stat(loadedTheme.iconsPath) : null,
  ]);
  let petStamp = "";
  if (loadedTheme.petBundle) {
    const [manifestStat, spritesheetStat] = await Promise.all([
      fs.stat(loadedTheme.petBundle.manifestPath), fs.stat(loadedTheme.petBundle.spritesheetFilePath),
    ]);
    petStamp = `:${manifestStat.size}:${manifestStat.mtimeMs}:${spritesheetStat.size}:${spritesheetStat.mtimeMs}`;
  }
  return `${themeStat.size}:${themeStat.mtimeMs}:${imageStat.size}:${imageStat.mtimeMs}:${cssStat.size}:${cssStat.mtimeMs}:${rendererStat.size}:${rendererStat.mtimeMs}:${iconsStat?.size ?? 0}:${iconsStat?.mtimeMs ?? 0}${petStamp}`;
}

async function probeSession(session) {
  return session.evaluate(`(() => {
    const markers = {
      shell: Boolean(document.querySelector('main.main-surface')),
      sidebar: Boolean(document.querySelector('aside.app-shell-left-panel')),
      composer: Boolean(document.querySelector('.composer-surface-chrome')),
      main: Boolean(document.querySelector('[role="main"]')),
    };
    return {
      markers,
      codex: location.protocol === 'app:' && markers.shell && markers.sidebar && (markers.composer || markers.main),
    };
  })()`);
}

async function waitForCodexProbe(session, timeoutMs = 1800) {
  const deadline = Date.now() + timeoutMs;
  let probe = null;
  while (Date.now() < deadline) {
    try {
      probe = await probeSession(session);
      if (probe?.codex) return probe;
    } catch {
      // The renderer may be between documents while the early payload waits.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return probe;
}

async function connectTarget(target, port) {
  return new CdpSession(target, port).open();
}

async function connectCodexTargets(port, timeoutMs, expectedBrowserId) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const targets = await listAppTargets(port, expectedBrowserId);
      const connected = [];
      for (const target of targets) {
        let session;
        try {
          session = await connectTarget(target, port);
          const probe = await probeSession(session);
          if (probe?.codex) connected.push({ target, session, probe });
          else session.close();
        } catch (error) {
          session?.close();
          lastError = error;
        }
      }
      if (connected.length) return connected;
      lastError = new Error("No page matched the expected Codex shell markers");
    } catch (error) {
      if (error instanceof CdpIdentityMismatchError) throw error;
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`No verified Codex renderer on 127.0.0.1:${port}: ${lastError?.message ?? "timed out"}`);
}

async function applyToSession(session, payload) {
  await session.evaluate(`(() => {
    const previous = window.__CODEX_DREAM_SKIN_STATE__;
    if (previous?.cleanup) previous.cleanup();
    else {
      document.getElementById('codex-dream-skin-style')?.remove();
      document.getElementById('codex-dream-skin-chrome')?.remove();
      delete window.__CODEX_DREAM_SKIN_STATE__;
    }
    delete window.__CODEX_DREAM_SKIN_RUNTIME__;
    return true;
  })()`);
  return session.evaluate(payload);
}

export function earlyPayloadFor(payload, revision) {
  return `(() => {
    const generationKey = "__CODEX_DREAM_SKIN_EARLY_GENERATION__";
    const appliedKey = "__CODEX_DREAM_SKIN_EARLY_APPLIED__";
    const generation = ${JSON.stringify(revision)};
    window[generationKey] = generation;
    let observer = null;
    let timeout = null;
    const stop = () => {
      observer?.disconnect();
      observer = null;
      if (timeout) clearTimeout(timeout);
      timeout = null;
    };
    const install = () => {
      if (window[generationKey] !== generation) { stop(); return true; }
      const root = document.documentElement;
      if (!root || !document.body) return false;
      const shell = document.querySelector('main.main-surface');
      const sidebar = document.querySelector('aside.app-shell-left-panel');
      if (!shell || !sidebar) return false;
      stop();
      const previousTheme = window.__CODEX_DREAM_SKIN_STATE__;
      if (previousTheme?.cleanup) previousTheme.cleanup();
      ${payload};
      window[appliedKey] = generation;
      return true;
    };
    if (install()) return;
    if (typeof MutationObserver === "function" && document.documentElement) {
      observer = new MutationObserver(install);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    timeout = setTimeout(stop, 10000);
  })()`;
}

async function registerEarlyPayload(session, payload, revision) {
  const result = await session.send("Page.addScriptToEvaluateOnNewDocument", {
    source: earlyPayloadFor(payload, revision),
  });
  return result.identifier ?? null;
}

async function removeEarlyPayload(session, identifier) {
  if (!identifier || session.closed) return;
  await session.send("Page.removeScriptToEvaluateOnNewDocument", { identifier }).catch(() => {});
}

async function removeFromSession(session) {
  return session.evaluate(`(() => {
    window.__CODEX_DREAM_SKIN_DISABLED__ = true;
    const state = window.__CODEX_DREAM_SKIN_STATE__;
    if (state?.cleanup) return state.cleanup();
    document.documentElement?.classList.remove(
      'codex-dream-skin', 'dream-theme-light', 'dream-theme-dark',
      'dream-art-wide', 'dream-art-standard', 'dream-focus-left',
      'dream-focus-center', 'dream-focus-right', 'dream-safe-left',
      'dream-safe-center', 'dream-safe-right', 'dream-safe-none',
      'dream-task-ambient', 'dream-task-banner', 'dream-task-off'
    );
    for (const property of [
      '--dream-art', '--dream-art-position', '--dream-focus-x', '--dream-focus-y',
      '--dream-accent', '--dream-accent-ink', '--dream-image-luma'
    ]) document.documentElement?.style.removeProperty(property);
    document.querySelectorAll('.dream-home').forEach((node) => node.classList.remove('dream-home'));
    document.querySelectorAll('.dream-task').forEach((node) => node.classList.remove('dream-task'));
    document.querySelectorAll('.dream-home-shell').forEach((node) => node.classList.remove('dream-home-shell'));
    document.getElementById('codex-dream-skin-style')?.remove();
    document.getElementById('codex-dream-skin-chrome')?.remove();
    delete window.__CODEX_DREAM_SKIN_STATE__;
    delete window.__CODEX_DREAM_SKIN_RUNTIME__;
    return true;
  })()`);
}

async function verifyRemovedSession(session) {
  return session.evaluate(`(() =>
    !document.documentElement.classList.contains('codex-dream-skin') &&
    !document.documentElement.style.getPropertyValue('--dream-art') &&
    !document.querySelector('.dream-home') &&
    !document.querySelector('.dream-task') &&
    !document.querySelector('.dream-home-shell') &&
    !document.getElementById('codex-dream-skin-style') &&
    !document.getElementById('codex-dream-skin-chrome') &&
    !window.__CODEX_DREAM_SKIN_STATE__ &&
    !window.__CODEX_DREAM_SKIN_RUNTIME__
  )()`);
}

async function verifySession(session) {
  return session.evaluate(`(() => {
    const box = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const home = document.querySelector('.dream-home');
    const suggestions = home?.querySelector('.group\\\\/home-suggestions') ?? null;
    const cards = suggestions ? [...suggestions.querySelectorAll('button')].map(box) : [];
    const result = {
      installed: document.documentElement.classList.contains('codex-dream-skin'),
      version: window.__CODEX_DREAM_SKIN_STATE__?.version ?? null,
      themeVersion: window.__CODEX_DREAM_SKIN_RUNTIME__?.themeVersion ?? null,
      injectorVersion: window.__CODEX_DREAM_SKIN_RUNTIME__?.injectorVersion ?? null,
      protocolVersion: window.__CODEX_DREAM_SKIN_RUNTIME__?.protocolVersion ?? null,
      expectedProtocolVersion: ${JSON.stringify(RUNTIME_PROTOCOL_VERSION)},
      stylePresent: Boolean(document.getElementById('codex-dream-skin-style')),
      chromePresent: Boolean(document.getElementById('codex-dream-skin-chrome')),
      chromePointerEvents: getComputedStyle(document.getElementById('codex-dream-skin-chrome') || document.body).pointerEvents,
      homePresent: Boolean(home),
      suggestionsPresent: Boolean(suggestions),
      hero: box(home?.firstElementChild?.firstElementChild?.firstElementChild),
      cards,
      composer: box(document.querySelector('.composer-surface-chrome')),
      sidebar: box(document.querySelector('aside.app-shell-left-panel')),
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow: {
        x: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      },
    };
    result.pass = result.installed && result.protocolVersion === result.expectedProtocolVersion &&
      result.stylePresent && result.chromePresent &&
      result.chromePointerEvents === 'none' && Boolean(result.composer) && Boolean(result.sidebar) &&
      (!result.homePresent || (Boolean(result.hero) &&
        (!result.suggestionsPresent || (result.cards.length >= 2 && result.cards.length <= 4))));
    return result;
  })()`);
}

async function waitForVerifiedSession(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastResult;
  let lastError;
  while (Date.now() < deadline) {
    try {
      lastResult = await verifySession(session);
      lastError = null;
      if (lastResult.pass) return lastResult;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!lastResult && lastError) throw lastError;
  return lastResult;
}

async function capture(session, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  const viewport = await session.evaluate("({ width: innerWidth, height: innerHeight })");
  await session.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: Math.round(viewport.width * 0.64),
    y: Math.round(viewport.height * 0.62),
    button: "none",
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const result = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await fs.writeFile(outputPath, Buffer.from(result.data, "base64"));
}

async function runOneShot(options) {
  const connected = await connectCodexTargets(options.port, options.timeoutMs, options.browserId);
  const loadedPayload = (options.mode === "once" || options.reload)
    ? await loadPayload(options.themeDir) : null;
  const payload = loadedPayload?.payload ?? null;
  if (loadedPayload && options.mode === "once") await installAndSelectBundledPet(options, loadedPayload);
  const results = [];
  let screenshotCaptured = false;
  try {
    for (const { target, session, probe } of connected) {
      try {
        if (options.mode === "remove") await removeFromSession(session);
        else if (options.mode === "once") await applyToSession(session, payload);
        if (options.mode === "once") {
          await new Promise((resolve) => setTimeout(resolve, 850));
        }
        if (options.reload) {
          await session.send("Page.reload", { ignoreCache: true });
          await new Promise((resolve) => setTimeout(resolve, 1600));
          if (options.mode !== "remove") await applyToSession(session, payload);
        }
        const verified = options.mode === "remove"
          ? await verifyRemovedSession(session)
          : (options.reload || options.mode === "once" || options.mode === "verify")
            ? await waitForVerifiedSession(session, options.timeoutMs)
            : await verifySession(session);
        results.push({ targetId: target.id, markers: probe.markers, result: verified });
        if (options.screenshot && !screenshotCaptured) {
          await capture(session, options.screenshot);
          screenshotCaptured = true;
        }
      } finally {
        session.close();
      }
    }
  } finally {
    for (const { session } of connected) session.close();
  }
  console.log(JSON.stringify({ mode: options.mode, port: options.port, targets: results }, null, 2));
  const failed = results.length === 0 || results.some((item) =>
    options.mode === "remove" ? item.result !== true : !item.result?.pass);
  if (failed) process.exitCode = 2;
}

async function runManagerVerify(options) {
  const connected = await connectCodexTargets(options.port, options.timeoutMs, options.browserId);
  const results = [];
  try {
    for (const { target, session } of connected) {
      try {
        const ready = await session.evaluate("Boolean(window.__CODEX_DREAM_THEME_MANAGER__?.ensure)");
        results.push({ targetId: target.id, managerReady: Boolean(ready) });
      } finally {
        session.close();
      }
    }
  } finally {
    for (const { session } of connected) session.close();
  }
  console.log(JSON.stringify({ mode: options.mode, port: options.port, targets: results }, null, 2));
  if (!results.length || results.some((item) => !item.managerReady)) process.exitCode = 2;
}

async function runWatch(options) {
  const identityAnchor = await connectBrowserIdentityAnchor(options.port, options.browserId);
  const sessions = new Map();
  const earlyScripts = new Map();
  const managerScripts = new Map();
  const controlScripts = new Map();
  const fallbackTargets = new Map();
  const fallbackListeners = new Set();
  const targetFailures = new Map();
  let stopping = false;
  let listFailures = 0;
  let lastListErrorLogAt = 0;
  let lastThemeErrorLogAt = 0;
  let lastStrongThemeAuditAt = 0;
  let loadedPayload = null;
  let managerPayload = null;
  let paused = false;
  let themeDirty = false;
  let managerDirty = false;
  let lastThemeChangeAt = 0;
  let lastManagerChangeAt = 0;
  const watchers = [];
  const stop = () => { stopping = true; };
  const rejectTarget = (target, baseDelayMs, error = null) => {
    const previous = targetFailures.get(target.id) ?? { failures: 0, lastLogAt: 0 };
    const failures = previous.failures + 1;
    const delayMs = Math.min(30000, baseDelayMs * (2 ** Math.min(failures - 1, 4)));
    const now = Date.now();
    if (error && (failures === 1 || now - previous.lastLogAt >= 30000)) {
      console.error(`[dream-skin] inject failed for ${target.id}: ${error.message}; retrying in ${delayMs}ms`);
      previous.lastLogAt = now;
    }
    targetFailures.set(target.id, { failures, lastLogAt: previous.lastLogAt, until: now + delayMs });
  };
  const attachLoadFallback = (id, target, session) => {
    if (fallbackListeners.has(id)) return;
    fallbackListeners.add(id);
    let lastReinjectErrorLogAt = 0;
    session.on("Page.loadEventFired", () => {
      if (!fallbackTargets.get(id)) return;
      setTimeout(() => {
        const operation = paused ? removeFromSession(session) : applyToSession(session, loadedPayload.payload);
        operation.catch((error) => {
          if (Date.now() - lastReinjectErrorLogAt >= 30000) {
            console.error(`[dream-skin] reinject failed for ${target.id}: ${error.message}`);
            lastReinjectErrorLogAt = Date.now();
          }
        });
      }, 250);
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  try {
    loadedPayload = await loadPayload(options.themeDir);
    paused = await fileExists(options.pauseFile);
    if (!paused) await installAndSelectBundledPet(options, loadedPayload);
    managerPayload = await fs.readFile(path.join(root, "engine", "theme-manager.js"), "utf8");
    try {
      const themeWatcher = watchFiles(options.themeDir, { recursive: true }, (_event, fileName) => {
        if (!fileName || /(?:theme\.json|\.css|\.js|\.png|\.jpe?g|\.webp)$/i.test(String(fileName))) {
          themeDirty = true;
          lastThemeChangeAt = Date.now();
        }
      });
      themeWatcher.on("error", (error) => console.error(`[dream-skin] theme hot reload watcher: ${error.message}`));
      watchers.push(themeWatcher);
      const managerWatcher = watchFiles(path.join(root, "engine"), { recursive: false }, (_event, fileName) => {
        if (!fileName || String(fileName).toLowerCase() === "theme-manager.js") {
          managerDirty = true;
          lastManagerChangeAt = Date.now();
        }
      });
      managerWatcher.on("error", (error) => console.error(`[dream-skin] manager hot reload watcher: ${error.message}`));
      watchers.push(managerWatcher);
      console.log(`[dream-skin] hot reload watching ${options.themeDir}`);
    } catch (error) {
      console.error(`[dream-skin] filesystem hot reload unavailable; polling remains active: ${error.message}`);
    }
    lastStrongThemeAuditAt = Date.now();
    while (!stopping) {
      if (identityAnchor.closed) {
        console.error("[dream-skin] original CDP browser identity closed; watcher is stopping instead of reconnecting");
        process.exitCode = 3;
        break;
      }
      let targets = [];
      try {
        targets = await listAppTargets(options.port);
        listFailures = 0;
      } catch (error) {
        listFailures += 1;
        const retryMs = Math.min(10000, 1000 * (2 ** Math.min(listFailures - 1, 4)));
        if (listFailures === 1 || Date.now() - lastListErrorLogAt >= 30000) {
          console.error(`[dream-skin] ${new Date().toISOString()} ${error.message}; retrying in ${retryMs}ms`);
          lastListErrorLogAt = Date.now();
        }
        await new Promise((resolve) => setTimeout(resolve, retryMs));
        continue;
      }

      const nextPaused = await fileExists(options.pauseFile);
      let nextPayload = loadedPayload;
      if (managerDirty && Date.now() - lastManagerChangeAt >= 120) {
        try {
          const nextManagerPayload = await fs.readFile(path.join(root, "engine", "theme-manager.js"), "utf8");
          for (const [id, session] of sessions) {
            const previousManagerScript = managerScripts.get(id);
            const nextManagerScript = (await session.send("Page.addScriptToEvaluateOnNewDocument", { source: nextManagerPayload })).identifier ?? null;
            if (nextManagerScript) managerScripts.set(id, nextManagerScript);
            await removeEarlyPayload(session, previousManagerScript);
            await session.evaluate("window.__CODEX_DREAM_THEME_MANAGER__?.cleanup?.()").catch(() => {});
            await session.evaluate(nextManagerPayload);
          }
          managerPayload = nextManagerPayload;
          managerDirty = false;
          console.log("[dream-skin] theme manager hot reloaded");
        } catch (error) {
          if (Date.now() - lastThemeErrorLogAt >= 30000) {
            console.error(`[dream-skin] manager hot reload rejected: ${error.message}`);
            lastThemeErrorLogAt = Date.now();
          }
        }
      }
      if (!nextPaused) {
        try {
          const now = Date.now();
          let shouldAudit = !loadedPayload || (themeDirty && now - lastThemeChangeAt >= 120) ||
            now - lastStrongThemeAuditAt >= STRONG_THEME_AUDIT_MS;
          if (!shouldAudit) {
            try {
              shouldAudit = await readThemeSourceStamp(loadedPayload) !== loadedPayload.sourceStamp;
            } catch {
              shouldAudit = true;
            }
          }
          if (shouldAudit) {
            const candidateTheme = await loadTheme(options.themeDir);
            lastStrongThemeAuditAt = now;
            themeDirty = false;
            if (!loadedPayload || candidateTheme.fingerprint !== loadedPayload.fingerprint) {
              nextPayload = await loadPayload(options.themeDir, candidateTheme);
            } else {
              loadedPayload.sourceStamp = candidateTheme.sourceStamp;
            }
          }
        } catch (error) {
          if (Date.now() - lastThemeErrorLogAt >= 30000) {
            console.error(`[dream-skin] theme update rejected: ${error.message}; keeping the active theme`);
            lastThemeErrorLogAt = Date.now();
          }
        }
      }
      const pauseChanged = nextPaused !== paused;
      const payloadChanged = !nextPaused && nextPayload !== loadedPayload;
      loadedPayload = nextPayload;
      paused = nextPaused;

      if (payloadChanged && !paused) await installAndSelectBundledPet(options, loadedPayload);

      if (pauseChanged || payloadChanged) {
        for (const [id, session] of sessions) {
          try {
            const previousEarlyScript = earlyScripts.get(id);
            if (paused) {
              await removeFromSession(session);
              await removeEarlyPayload(session, previousEarlyScript);
              earlyScripts.delete(id);
              fallbackTargets.delete(id);
              fallbackListeners.delete(id);
            } else {
              let nextEarlyScript = null;
              try {
                nextEarlyScript = await registerEarlyPayload(
                  session,
                  loadedPayload.payload,
                  loadedPayload.fingerprint,
                );
                if (!nextEarlyScript) throw new Error("CDP did not return an early-script identifier");
                fallbackTargets.set(id, false);
              } catch (error) {
                fallbackTargets.set(id, true);
                console.error(`[dream-skin] early theme refresh unavailable for ${id}: ${error.message}`);
                attachLoadFallback(id, { id }, session);
              }
              if (nextEarlyScript) earlyScripts.set(id, nextEarlyScript);
              else earlyScripts.delete(id);
              await removeEarlyPayload(session, previousEarlyScript);
              await applyToSession(session, loadedPayload.payload);
            }
          } catch (error) {
            console.error(`[dream-skin] live theme update failed for ${id}: ${error.message}`);
            await removeEarlyPayload(session, earlyScripts.get(id));
            earlyScripts.delete(id);
            fallbackTargets.delete(id);
            fallbackListeners.delete(id);
            session.close();
            sessions.delete(id);
          }
        }
        console.log(paused ? "[dream-skin] paused" : `[dream-skin] active theme ${loadedPayload.theme.id}`);
      }

      const activeIds = new Set(targets.map((target) => target.id));
      for (const id of targetFailures.keys()) {
        if (!activeIds.has(id)) targetFailures.delete(id);
      }
      for (const [id, session] of sessions) {
        if (!activeIds.has(id) || session.closed) {
          await removeEarlyPayload(session, earlyScripts.get(id));
          await removeEarlyPayload(session, managerScripts.get(id));
          await removeEarlyPayload(session, controlScripts.get(id));
          earlyScripts.delete(id);
          managerScripts.delete(id);
          controlScripts.delete(id);
          fallbackTargets.delete(id);
          fallbackListeners.delete(id);
          session.close();
          sessions.delete(id);
          targetFailures.delete(id);
        }
      }

      for (const target of targets) {
        if (identityAnchor.closed) break;
        if (sessions.has(target.id)) continue;
        if ((targetFailures.get(target.id)?.until ?? 0) > Date.now()) continue;
        let session;
        let earlyScriptId = null;
        try {
          session = await connectTarget(target, options.port);
          if (identityAnchor.closed) throw new CdpIdentityMismatchError("Original CDP browser identity closed");
          const controlScriptId = await attachThemeControl(session, options);
          if (controlScriptId) controlScripts.set(target.id, controlScriptId);
          const managerScriptId = (await session.send("Page.addScriptToEvaluateOnNewDocument", { source: managerPayload })).identifier ?? null;
          if (managerScriptId) managerScripts.set(target.id, managerScriptId);
          await session.evaluate(managerPayload);
          let earlyInjectionFallback = false;
          if (!paused) {
            try {
              earlyScriptId = await registerEarlyPayload(
                session,
                loadedPayload.payload,
                loadedPayload.fingerprint,
              );
              if (!earlyScriptId) throw new Error("CDP did not return an early-script identifier");
              await session.evaluate(earlyPayloadFor(loadedPayload.payload, loadedPayload.fingerprint));
            } catch (error) {
              await removeEarlyPayload(session, earlyScriptId);
              earlyScriptId = null;
              earlyInjectionFallback = true;
              console.error(`[dream-skin] early injection unavailable for ${target.id}: ${error.message}`);
            }
          }
          const probe = await waitForCodexProbe(session);
          if (!probe?.codex) {
            await removeEarlyPayload(session, earlyScriptId);
            await removeEarlyPayload(session, managerScripts.get(target.id));
            await removeEarlyPayload(session, controlScripts.get(target.id));
            managerScripts.delete(target.id);
            controlScripts.delete(target.id);
            rejectTarget(target, 5000);
            session.close();
            continue;
          }
          fallbackTargets.set(target.id, earlyInjectionFallback);
          if (earlyInjectionFallback) attachLoadFallback(target.id, target, session);
          if (identityAnchor.closed) throw new CdpIdentityMismatchError("Original CDP browser identity closed");
          let earlyApplied = false;
          if (!paused && !earlyInjectionFallback) {
            earlyApplied = await session.evaluate(
              `window.__CODEX_DREAM_SKIN_EARLY_APPLIED__ === ${JSON.stringify(loadedPayload.fingerprint)}`,
            ).catch(() => false);
          }
          if (paused) await removeFromSession(session);
          else if (!earlyApplied) await applyToSession(session, loadedPayload.payload);
          sessions.set(target.id, session);
          if (earlyScriptId) earlyScripts.set(target.id, earlyScriptId);
          targetFailures.delete(target.id);
          console.log(`[dream-skin] injected target ${target.id}`);
        } catch (error) {
          await removeEarlyPayload(session, earlyScriptId);
          await removeEarlyPayload(session, managerScripts.get(target.id));
          await removeEarlyPayload(session, controlScripts.get(target.id));
          managerScripts.delete(target.id);
          controlScripts.delete(target.id);
          fallbackTargets.delete(target.id);
          fallbackListeners.delete(target.id);
          session?.close();
          if (identityAnchor.closed || error instanceof CdpIdentityMismatchError) break;
          rejectTarget(target, 2500, error);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  } finally {
    for (const watcher of watchers) watcher.close();
    identityAnchor.close();
    for (const [id, session] of sessions) {
      await removeEarlyPayload(session, earlyScripts.get(id));
      await removeEarlyPayload(session, managerScripts.get(id));
      await removeEarlyPayload(session, controlScripts.get(id));
      session.close();
    }
    earlyScripts.clear();
    managerScripts.clear();
    controlScripts.clear();
    fallbackTargets.clear();
    fallbackListeners.clear();
  }
}

if (path.resolve(process.argv[1] || "") === path.resolve(scriptPath)) {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === "self-test") {
  const valid = validatedDebuggerUrl({ webSocketDebuggerUrl: `ws://127.0.0.1:${options.port}/devtools/page/test` }, options.port);
  const browserId = browserIdFromVersion({
    webSocketDebuggerUrl: `ws://127.0.0.1:${options.port}/devtools/browser/test-browser`,
  }, options.port);
  const invalid = [
    "ws://example.com/devtools/page/test",
    `ws://127.0.0.1:${options.port + 1}/devtools/page/test`,
    `wss://127.0.0.1:${options.port}/devtools/page/test`,
    `ws://user@127.0.0.1:${options.port}/devtools/page/test`,
    `ws://127.0.0.1:${options.port}/unexpected/test`,
    `ws://127.0.0.1:${options.port}/devtools/page/test?query=1`,
  ];
  for (const value of invalid) {
    let rejected = false;
    try { validatedDebuggerUrl({ webSocketDebuggerUrl: value }, options.port); } catch { rejected = true; }
    if (!rejected) throw new Error(`CDP URL validation accepted an unsafe URL: ${value}`);
  }
  const invalidBrowserUrls = [
    `ws://127.0.0.1:${options.port}/devtools/page/not-a-browser`,
    `ws://127.0.0.1:${options.port}/devtools/browser/bad%20id`,
    `ws://127.0.0.1:${options.port}/devtools/browser/test?query=1`,
  ];
  for (const value of invalidBrowserUrls) {
    let rejected = false;
    try { browserIdFromVersion({ webSocketDebuggerUrl: value }, options.port); } catch { rejected = true; }
    if (!rejected) throw new Error(`Browser identity validation accepted an unsafe URL: ${value}`);
  }
  const validPageTarget = {
    id: "page-test",
    type: "page",
    url: "app://codex/",
    webSocketDebuggerUrl: `ws://127.0.0.1:${options.port}/devtools/page/page-test`,
  };
  const invalidPageTargets = [
    { ...validPageTarget, webSocketDebuggerUrl: `ws://127.0.0.1:${options.port}/devtools/browser/page-test` },
    { ...validPageTarget, id: "other-page" },
    { ...validPageTarget, id: 123 },
    { ...validPageTarget, type: "other" },
  ];
  if (!valid || browserId !== "test-browser" || !isValidCdpPageTarget(validPageTarget, options.port) ||
      invalidPageTargets.some((item) => isValidCdpPageTarget(item, options.port))) {
    throw new Error("CDP URL and target validation self-test failed");
  }
  console.log(JSON.stringify({ pass: true, version: SKIN_VERSION, test: "loopback-cdp-validation" }));
  } else if (options.mode === "check-payload") {
    const loaded = await loadPayload(options.themeDir);
    const unresolved = ["__DREAM_CSS_JSON__", "__DREAM_ART_JSON__", "__DREAM_THEME_JSON__", "__DREAM_ICONS_JSON__"]
      .some((placeholder) => loaded.payload.includes(placeholder));
    if (unresolved) {
      throw new Error("Payload placeholders were not fully replaced");
    }
    console.log(JSON.stringify({
      pass: true,
      version: SKIN_VERSION,
      payloadBytes: Buffer.byteLength(loaded.payload),
      themeId: loaded.theme.id,
      appearance: loaded.theme.appearance,
      art: loaded.theme.art,
      artMetadata: loaded.theme.artMetadata ?? null,
    }));
  } else if (options.mode === "watch") await runWatch(options);
  else if (options.mode === "verify-manager") await runManagerVerify(options);
  else await runOneShot(options);
}
