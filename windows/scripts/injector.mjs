import fs from "node:fs/promises";
import { watch as watchFiles } from "node:fs";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_THEME_DIR,
  PET_ID_PATTERN,
  bundledThemePreviewDataUrl,
  codexHome,
  createLocalThemePackage,
  fetchRemoteTheme,
  installAndSelectBundledPet,
  installedPetPreviewDataUrl,
  installedThemeImagePreviewDataUrls,
  installedThemePreviewDataUrl,
  isPathInside,
  listInstalledThemes,
  loadPayload,
  loadPetPackage,
  loadTheme,
  localCatalog,
  normalizedText,
  readLibraries,
  readRemoteIndex,
  resolveGitHubRepository,
  safeThemeId,
  setBaseThemeEnabled,
  stateRootFor,
  themeControlState,
  updateThemeImageSettings,
  writeLibraries,
  writeThemeDirectory,
} from "./theme-package.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const here = path.dirname(scriptPath);
const root = path.resolve(here, "..");
const SKIN_VERSION = "1.4.0";
const RUNTIME_PROTOCOL_VERSION = 1;
const STRONG_THEME_AUDIT_MS = 30000;
const THEME_CONTROL_BINDING = "__codexDreamThemeControl";
const THEME_CONTROL_RESPONSE = "__codexDreamThemeResponse";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const BROWSER_ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;
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

async function handleThemeControl(options, request) {
  if (!request || typeof request !== "object" || typeof request.command !== "string") throw new Error("无效的主题控制请求");
  const payload = request.payload && typeof request.payload === "object" ? request.payload : {};
  const stateRoot = stateRootFor(options);
  const savedRoot = path.join(stateRoot, "themes");
  if (request.command === "getState") return themeControlState(options);
  if (request.command === "getPetPreview") {
    const petId = String(payload.petId || "").trim();
    return { petId, preview: await installedPetPreviewDataUrl(petId) };
  }
  if (request.command === "getThemePreview") {
    const key = String(payload.key || "").trim();
    const scope = payload.scope === "bundled" ? "bundled" : "installed";
    const preview = scope === "bundled"
      ? await bundledThemePreviewDataUrl(key)
      : await installedThemePreviewDataUrl(options, key);
    return { key, scope, preview };
  }
  if (request.command === "getThemeImages") {
    const key = String(payload.key || "").trim();
    return installedThemeImagePreviewDataUrls(options, key);
  }
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
      palette: payload.palette,
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
  if (request.command === "updateThemePet") {
    const key = safeThemeId(payload.key, "");
    if (!key || key !== String(payload.key)) throw new Error("无效的主题标识");
    const directory = path.resolve(savedRoot, key);
    if (!isPathInside(directory, path.resolve(savedRoot))) throw new Error("主题路径越界");
    const targetTheme = await loadTheme(directory);
    const petId = String(payload.petId || "").trim();
    let selectedBundle = null;
    if (petId) {
      if (!PET_ID_PATTERN.test(petId)) throw new Error("选择的宠物 id 无效");
      selectedBundle = await loadPetPackage(path.join(codexHome(), "pets", petId), petId);
    }
    const withSelection = {
      ...targetTheme,
      theme: { ...targetTheme.theme },
      petBundle: selectedBundle,
    };
    if (selectedBundle) withSelection.theme.pet = { id: selectedBundle.id };
    else delete withSelection.theme.pet;
    await writeThemeDirectory(directory, withSelection);
    const active = await loadTheme(options.themeDir);
    if (active.theme.id === targetTheme.theme.id) {
      await writeThemeDirectory(options.themeDir, withSelection);
      if (selectedBundle) await installAndSelectBundledPet(options, withSelection);
    }
    return themeControlState(options);
  }
  if (request.command === "updateThemeImages") {
    const key = safeThemeId(payload.key, "");
    if (!key || key !== String(payload.key)) throw new Error("无效的主题标识");
    const directory = path.resolve(savedRoot, key);
    if (!isPathInside(directory, path.resolve(savedRoot))) throw new Error("主题路径越界");
    const updated = await updateThemeImageSettings(directory, {
      defaultImage: payload.defaultImage,
      display: payload.display,
      sidebar: payload.sidebar,
      addedImages: payload.addedImages,
    });
    const active = await loadTheme(options.themeDir);
    if (active.theme.id === updated.theme.id) {
      await writeThemeDirectory(options.themeDir, updated);
    }
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
      result.chromePointerEvents === 'none' && Boolean(result.composer) && Boolean(result.sidebar);
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
