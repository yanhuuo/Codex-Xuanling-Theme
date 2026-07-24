/* Dream Skin shared framework renderer. */
((cssText, artDataUrl, rawConfig, rawIcons) => {
  const STATE_KEY = "__CODEX_DREAM_SKIN_STATE__";
  const STYLE_ID = "codex-dream-skin-style";
  const CHROME_ID = "codex-dream-skin-chrome";
  const ROOT_CLASSES = [
    "codex-dream-skin",
    "dream-theme-light",
    "dream-theme-dark",
    "dream-art-wide",
    "dream-art-standard",
    "dream-focus-left",
    "dream-focus-center",
    "dream-focus-right",
    "dream-safe-left",
    "dream-safe-center",
    "dream-safe-right",
    "dream-safe-none",
    "dream-task-ambient",
    "dream-task-banner",
    "dream-task-off",
    "dream-route-home",
    "dream-route-task",
    "dream-home-utility-present",
    "dream-window-dragging",
  ];
  const ROOT_PROPERTIES = [
    "--dream-art",
    "--dream-art-position",
    "--dream-focus-x",
    "--dream-focus-y",
    "--dream-accent",
    "--dream-accent-ink",
    "--dream-image-luma",
  ];
  const HOME_UTILITY_CLASS = "dream-home-utility";
  const SPINNER_SELECTOR = ".animate-spin, [class~='animate-spin'], [role='progressbar'], [data-loading='true']";
  const THEME_ICON_VERSION = "8";
  const THEME_ICON_SVGS = Object.freeze(Object.fromEntries(
    Object.entries(rawIcons && typeof rawIcons === "object" ? rawIcons : {})
      .filter(([name, svg]) => /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(name) && typeof svg === "string")
  ));
  const installToken = {};
  let samplingNativeShell = false;
  let observer = null;
  let sidebarDirty = true;
  let spinnerDirty = true;
  let lastSpinnerAt = 0;
  let sidebarReadyAt = 0;
  let appliedProfileSignature = "";
  let permissionMenuTimer = null;
  let permissionMenuListener = null;
  const permissionButtons = new Set();
  let windowDragHeader = null;
  let windowDragStart = null;
  let windowDragEnd = null;
  let windowDragTimer = null;
  window.__CODEX_DREAM_SKIN_DISABLED__ = false;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value)));
  const luminance = (red, green, blue) => {
    const linear = [red, green, blue].map((value) => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  };
  const defaultProfile = {
    appearance: "dark",
    accent: [108, 131, 142],
    focusX: .5,
    focusY: .5,
    aspect: 1.6,
    luma: .32,
    safeArea: "center",
  };

  const normalizeConfig = (value) => {
    const config = value && typeof value === "object" ? value : {};
    const art = config.art && typeof config.art === "object" ? config.art : {};
    const hasNumber = (candidate) =>
      (typeof candidate === "number" || (typeof candidate === "string" && candidate.trim() !== "")) &&
      Number.isFinite(Number(candidate));
    const requestedAccent = typeof config?.palette?.accent === "string"
      ? config.palette.accent.trim()
      : "";
    const safeAccent = /^(?:#[\da-f]{3,8}|(?:rgb|hsl|oklch|oklab)\([^;{}]{1,96}\))$/i.test(requestedAccent)
      ? requestedAccent
      : null;
    const appearance = ["auto", "light", "dark"].includes(config.appearance)
      ? config.appearance
      : "auto";
    const safeArea = ["auto", "left", "right", "center", "none"].includes(art.safeArea)
      ? art.safeArea
      : "auto";
    const taskMode = ["auto", "ambient", "banner", "off"].includes(art.taskMode)
      ? art.taskMode
      : "auto";
    const homeMode = ["themed", "native"].includes(art.homeMode)
      ? art.homeMode
      : "themed";
    const cleanText = (candidate, maxLength) =>
      typeof candidate === "string" && candidate.length <= maxLength && !/[\u0000-\u001f]/.test(candidate)
        ? candidate.trim()
        : "";
    const metadataRatio = Number(config?.artMetadata?.ratio);
    return {
      appearance,
      safeArea,
      taskMode,
      homeMode,
      brandSubtitle: cleanText(config.brandSubtitle, 100),
      tagline: cleanText(config.tagline, 120),
      statusText: cleanText(config.statusText, 80),
      quote: cleanText(config.quote, 100),
      brandIcon: /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(config.brandIcon || "") ? config.brandIcon : "",
      sendIcon: /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(config.sendIcon || "") ? config.sendIcon : "",
      processingIcon: /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(config.processingIcon || "") ? config.processingIcon : "",
      spinnerIcon: /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(config.spinnerIcon || "") ? config.spinnerIcon : "",
      focusX: hasNumber(art.focusX) ? clamp(art.focusX) : null,
      focusY: hasNumber(art.focusY) ? clamp(art.focusY) : null,
      accent: safeAccent,
      initialAspect: Number.isFinite(metadataRatio) && metadataRatio > 0 ? metadataRatio : null,
    };
  };

  const previous = window[STATE_KEY];
  if (previous?.observer) previous.observer.disconnect();
  if (previous?.timer) clearInterval(previous.timer);
  if (previous?.scheduler?.timeout) clearTimeout(previous.scheduler.timeout);
  if (previous?.artUrl) URL.revokeObjectURL(previous.artUrl);
  const artUrl = (() => {
    const comma = artDataUrl.indexOf(",");
    const binary = atob(artDataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const mime = /^data:([^;,]+)/.exec(artDataUrl)?.[1] || "image/png";
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  })();
  const config = normalizeConfig(rawConfig);
  const brandIcon = THEME_ICON_SVGS[config.brandIcon]
    ? config.brandIcon
    : (THEME_ICON_SVGS.bird ? "bird" : (THEME_ICON_SVGS.seraph ? "seraph" : Object.keys(THEME_ICON_SVGS)[0]));
  const sendIcon = THEME_ICON_SVGS[config.sendIcon] ? config.sendIcon : (THEME_ICON_SVGS.send ? "send" : brandIcon);
  const processingIcon = THEME_ICON_SVGS[config.processingIcon] ? config.processingIcon : (THEME_ICON_SVGS.processing ? "processing" : brandIcon);
  const spinnerIcon = THEME_ICON_SVGS[config.spinnerIcon] ? config.spinnerIcon : (THEME_ICON_SVGS.spinner ? "spinner" : processingIcon);
  let profile = {
    ...defaultProfile,
    aspect: config.initialAspect ?? defaultProfile.aspect,
  };
  const existingStyle = document.getElementById(STYLE_ID);
  if (existingStyle) {
    existingStyle.textContent = cssText;
    existingStyle.dataset.dreamVersion = "3";
  }

  const analyzeArt = () => new Promise((resolve) => {
    if (typeof Image !== "function") {
      resolve(defaultProfile);
      return;
    }
    const image = new Image();
    image.onload = () => {
      try {
        const width = 48;
        const height = Math.max(12, Math.round(width * image.naturalHeight / image.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext?.("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas is unavailable");
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        let count = 0;
        let totalRed = 0;
        let totalGreen = 0;
        let totalBlue = 0;
        let totalBrightness = 0;
        const samples = [];
        const sampleMap = new Array(width * height);
        for (let offset = 0; offset < pixels.length; offset += 4) {
          if (pixels[offset + 3] < 96) continue;
          const red = pixels[offset];
          const green = pixels[offset + 1];
          const blue = pixels[offset + 2];
          const light = (.2126 * red + .7152 * green + .0722 * blue) / 255;
          const sample = { red, green, blue, light, index: offset / 4 };
          samples.push(sample);
          sampleMap[sample.index] = sample;
          totalRed += red;
          totalGreen += green;
          totalBlue += blue;
          totalBrightness += light;
          count += 1;
        }
        if (!count) throw new Error("Image contains no opaque pixels");
        const average = [totalRed / count, totalGreen / count, totalBlue / count];
        const averageBrightness = totalBrightness / count;
        const information = (start, end) => {
          let total = 0;
          let totalSquared = 0;
          let edges = 0;
          let edgeCount = 0;
          let sampleCount = 0;
          for (let y = 0; y < height; y += 1) {
            for (let x = start; x < end; x += 1) {
              const sample = sampleMap[y * width + x];
              if (!sample) continue;
              total += sample.light;
              totalSquared += sample.light * sample.light;
              sampleCount += 1;
              const previousSample = x > start ? sampleMap[y * width + x - 1] : null;
              const above = y > 0 ? sampleMap[(y - 1) * width + x] : null;
              if (previousSample) { edges += Math.abs(sample.light - previousSample.light); edgeCount += 1; }
              if (above) { edges += Math.abs(sample.light - above.light); edgeCount += 1; }
            }
          }
          const mean = sampleCount ? total / sampleCount : 0;
          const variance = sampleCount ? Math.max(0, totalSquared / sampleCount - mean * mean) : 1;
          return Math.sqrt(variance) * .58 + (edgeCount ? edges / edgeCount : 1) * .42;
        };
        const zoneWidth = Math.max(1, Math.floor(width * .38));
        const leftInformation = information(0, zoneWidth);
        const rightInformation = information(width - zoneWidth, width);
        let safeArea = "center";
        if (leftInformation < rightInformation * .86) safeArea = "left";
        else if (rightInformation < leftInformation * .86) safeArea = "right";
        let focusWeight = 0;
        let focusX = 0;
        let focusY = 0;
        let accentWeight = 0;
        let accent = [0, 0, 0];
        for (const sample of samples) {
          const x = sample.index % width;
          const y = Math.floor(sample.index / width);
          const difference = Math.sqrt(
            (sample.red - average[0]) ** 2 +
            (sample.green - average[1]) ** 2 +
            (sample.blue - average[2]) ** 2,
          ) / 441.7;
          const saliency = .03 + difference ** 1.35;
          focusX += (x / Math.max(1, width - 1)) * saliency;
          focusY += (y / Math.max(1, height - 1)) * saliency;
          focusWeight += saliency;
          const max = Math.max(sample.red, sample.green, sample.blue);
          const min = Math.min(sample.red, sample.green, sample.blue);
          const saturation = max ? (max - min) / max : 0;
          const usableLight = 1 - Math.min(1, Math.abs(sample.light - .46) / .54);
          const weight = saturation ** 2 * (.15 + usableLight);
          accent[0] += sample.red * weight;
          accent[1] += sample.green * weight;
          accent[2] += sample.blue * weight;
          accentWeight += weight;
        }
        const resolvedAccent = accentWeight > 1
          ? accent.map((channel) => Math.round(channel / accentWeight))
          : average.map((channel) => Math.round(channel));
        let resolvedFocusX = clamp(focusX / focusWeight);
        if (safeArea === "left") resolvedFocusX = Math.max(.64, resolvedFocusX);
        if (safeArea === "right") resolvedFocusX = Math.min(.36, resolvedFocusX);
        resolve({
          appearance: averageBrightness >= .58 ? "light" : "dark",
          accent: resolvedAccent,
          focusX: resolvedFocusX,
          focusY: clamp(focusY / focusWeight),
          aspect: image.naturalWidth / Math.max(1, image.naturalHeight),
          luma: clamp(averageBrightness),
          safeArea,
        });
      } catch {
        resolve(defaultProfile);
      }
    };
    image.onerror = () => resolve(defaultProfile);
    image.src = artUrl;
  });

  const detectShellAppearance = () => {
    const root = document.documentElement;
    const body = document.body;
    const classes = `${root?.className || ""} ${body?.className || ""}`
      .toLowerCase()
      .replace(/\bdream-theme-(?:dark|light)\b/g, "");
    if (/\b(dark|electron-dark|theme-dark|appearance-dark)\b/.test(classes)) return "dark";
    if (/\b(light|electron-light|theme-light|appearance-light)\b/.test(classes)) return "light";

    const dataTheme = (
      root?.getAttribute?.("data-theme") ||
      root?.getAttribute?.("data-appearance") ||
      root?.getAttribute?.("data-color-mode") ||
      body?.getAttribute?.("data-theme") ||
      body?.getAttribute?.("data-appearance") ||
      ""
    ).toLowerCase();
    if (dataTheme.includes("dark")) return "dark";
    if (dataTheme.includes("light")) return "light";

    try {
      const hadSkin = root?.classList?.contains?.("codex-dream-skin");
      const savedSkinClasses = hadSkin
        ? ROOT_CLASSES.filter((className) => root.classList.contains(className))
        : [];
      samplingNativeShell = true;
      if (hadSkin) root.classList.remove(...ROOT_CLASSES);
      try {
        const colorScheme = getComputedStyle(root).colorScheme || "";
        if (colorScheme.includes("dark") && !colorScheme.includes("light")) return "dark";
        if (colorScheme.includes("light") && !colorScheme.includes("dark")) return "light";
      } finally {
        if (hadSkin) root.classList.add(...savedSkinClasses);
        observer?.takeRecords?.();
        samplingNativeShell = false;
      }
    } catch {
      samplingNativeShell = false;
    }
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {}
    return "light";
  };

  const clearSkinDom = () => {
    const root = document.documentElement;
    root?.classList.remove(...ROOT_CLASSES);
    for (const property of ROOT_PROPERTIES) root?.style.removeProperty(property);
    document.querySelectorAll(".dream-home").forEach((node) => node.classList.remove("dream-home"));
    document.querySelectorAll(".dream-home-content").forEach((node) => node.classList.remove("dream-home-content"));
    document.querySelectorAll(".dream-task").forEach((node) => node.classList.remove("dream-task"));
    document.querySelectorAll(".dream-home-shell").forEach((node) => node.classList.remove("dream-home-shell"));
    document.querySelectorAll(`.${HOME_UTILITY_CLASS}`).forEach((node) => node.classList.remove(HOME_UTILITY_CLASS));
    document.querySelectorAll(".dream-theme-icon").forEach((node) => node.remove());
    document.querySelectorAll(".dream-theme-brand-mark").forEach((node) => node.remove());
    document.querySelectorAll(".dream-composer-send").forEach((node) => node.classList.remove("dream-composer-send"));
    document.querySelectorAll(".dream-composer-processing").forEach((node) => node.classList.remove("dream-composer-processing"));
    document.querySelectorAll(".dream-permission-menu").forEach((node) => node.classList.remove("dream-permission-menu"));
    document.querySelectorAll(".dream-permission-item").forEach((node) => node.classList.remove("dream-permission-item"));
    document.querySelectorAll(".dream-theme-spinner-mark").forEach((node) => node.remove());
    document.querySelectorAll(".dream-native-icon-source").forEach((node) => node.classList.remove("dream-native-icon-source"));
    document.querySelectorAll(".dream-theme-spinner-source").forEach((node) => {
      node.classList.remove("dream-theme-spinner-source");
      node.parentElement?.classList.remove("dream-theme-spinner");
    });
    document.querySelectorAll(".dream-theme-spinner").forEach((node) => node.classList.remove("dream-theme-spinner"));
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CHROME_ID)?.remove();
  };

  const applyProfile = (root) => {
    const focusX = config.focusX ?? profile.focusX;
    const focusY = config.focusY ?? profile.focusY;
    const appearance = config.appearance === "auto" ? detectShellAppearance() : config.appearance;
    const focus = focusX < .4 ? "left" : focusX > .6 ? "right" : "center";
    const safeArea = config.safeArea === "auto" ? (profile.safeArea ||
      (focus === "left" ? "right" : focus === "right" ? "left" : "center")) : config.safeArea;
    const taskMode = config.taskMode === "auto"
      ? profile.aspect >= 2.25 ? "banner" : "ambient"
      : config.taskMode;
    const accent = config.accent || `rgb(${profile.accent.join(" ")})`;
    const accentInk = luminance(...profile.accent) > .42 ? "rgb(26 24 28)" : "rgb(250 248 251)";
    const signature = [appearance, focus, safeArea, taskMode, accent, accentInk, focusX, focusY,
      profile.aspect, profile.luma].join("|");
    if (signature === appliedProfileSignature) return;
    appliedProfileSignature = signature;
    root.classList.toggle("dream-theme-light", appearance === "light");
    root.classList.toggle("dream-theme-dark", appearance === "dark");
    root.classList.toggle("dream-art-wide", profile.aspect >= 1.75);
    root.classList.toggle("dream-art-standard", profile.aspect < 1.75);
    for (const value of ["left", "center", "right"]) {
      root.classList.toggle(`dream-focus-${value}`, focus === value);
    }
    for (const value of ["left", "center", "right", "none"]) {
      root.classList.toggle(`dream-safe-${value}`, safeArea === value);
    }
    for (const value of ["ambient", "banner", "off"]) {
      root.classList.toggle(`dream-task-${value}`, taskMode === value);
    }
    root.style.setProperty("--dream-art", `url("${artUrl}")`);
    root.style.setProperty("--dream-art-position", `${Math.round(focusX * 100)}% ${Math.round(focusY * 100)}%`);
    root.style.setProperty("--dream-focus-x", String(focusX));
    root.style.setProperty("--dream-focus-y", String(focusY));
    root.style.setProperty("--dream-accent", accent);
    root.style.setProperty("--dream-accent-ink", accentInk);
    root.style.setProperty("--dream-image-luma", profile.luma.toFixed(3));
  };

  const ensure = () => {
    if (window.__CODEX_DREAM_SKIN_DISABLED__) return;
    const root = document.documentElement;
    if (!root || !document.body) return;

    const shellMain = document.querySelector("main.main-surface");
    const shellSidebar = document.querySelector("aside.app-shell-left-panel");
    if (!shellMain || !shellSidebar) {
      clearSkinDom();
      return;
    }
    const shellHeader = shellMain.querySelector?.(":scope > header.app-header-tint") ||
      document.querySelector("main.main-surface > header.app-header-tint");
    if (shellHeader !== windowDragHeader) {
      windowDragHeader?.removeEventListener?.("mousedown", windowDragStart, true);
      windowDragHeader = shellHeader;
      windowDragHeader?.addEventListener?.("mousedown", windowDragStart, true);
    }

    root.classList.add("codex-dream-skin");
    applyProfile(root);

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || root).appendChild(style);
    }
    if (style.dataset.dreamVersion !== "3") {
      style.textContent = cssText;
      style.dataset.dreamVersion = "3";
    }

    const homeIcon = document.querySelector('[data-testid="home-icon"]');
    const roleHome = homeIcon?.closest('[role="main"]') || null;
    const home = roleHome || (homeIcon ? shellMain : null);
    let homeContent = homeIcon;
    while (homeContent && homeContent.parentElement !== home) homeContent = homeContent.parentElement;
    if (homeContent?.parentElement !== home) homeContent = null;
    for (const candidate of document.querySelectorAll(".dream-home-content")) {
      if (candidate !== homeContent) candidate.classList.remove("dream-home-content");
    }
    const decorateHome = config.homeMode === "themed";
    homeContent?.classList.toggle("dream-home-content", decorateHome);
    const routeMains = [...document.querySelectorAll('[role="main"]')];
    if (routeMains.length === 0) routeMains.push(shellMain);
    for (const candidate of routeMains) {
      candidate.classList.toggle("dream-home", decorateHome && candidate === home);
      candidate.classList.toggle("dream-task", candidate !== home);
    }
    const utilityBars = new Set(home ? home.querySelectorAll('[class*="_homeUtilityBar_"]') : []);
    for (const candidate of document.querySelectorAll(`.${HOME_UTILITY_CLASS}`)) {
      if (!utilityBars.has(candidate)) candidate.classList.remove(HOME_UTILITY_CLASS);
    }
    for (const candidate of utilityBars) candidate.classList.add(HOME_UTILITY_CLASS);
    shellMain.classList.toggle("dream-home-shell", Boolean(home));
    root.classList.toggle("dream-route-home", Boolean(home));
    root.classList.toggle("dream-route-task", !home);
    root.classList.toggle("dream-home-utility-present", utilityBars.size > 0);

    let chrome = document.getElementById(CHROME_ID);
    if (!chrome || chrome.parentElement !== document.body) {
      chrome?.remove();
      chrome = document.createElement("div");
      chrome.id = CHROME_ID;
      chrome.setAttribute("aria-hidden", "true");
      document.body.appendChild(chrome);
    }
    chrome.classList.toggle("dream-home-shell", Boolean(home));

    const setChromeText = (className, text) => {
      let node = chrome.querySelector?.(`.${className}`);
      if (!text) {
        node?.remove?.();
        return;
      }
      if (!chrome.appendChild) return;
      if (!node) {
        node = document.createElement("div");
        node.className = className;
        chrome.appendChild(node);
      }
      if (node.textContent !== text) node.textContent = text;
    };
    setChromeText("dream-brand-subtitle", config.brandSubtitle);
    setChromeText("dream-brand-tagline", config.tagline);
    setChromeText("dream-theme-status", config.statusText);
    setChromeText("dream-theme-quote", config.quote);

    const installThemeIcon = (source, iconName, semanticClass = "") => {
      if (!source || !iconName || !THEME_ICON_SVGS[iconName]) return;
      if (!source.classList.contains("dream-native-icon-source")) {
        source.classList.add("dream-native-icon-source");
      }
      let replacement = source.previousElementSibling;
      if (!replacement?.classList.contains("dream-theme-icon")) {
        replacement = document.createElement("span");
        replacement.setAttribute("aria-hidden", "true");
        source.parentElement?.insertBefore(replacement, source);
      }
      const expectedClass = `dream-theme-icon dream-theme-icon-${iconName}${iconName === brandIcon ? " dream-theme-icon-brand" : ""}${semanticClass ? ` ${semanticClass}` : ""}`;
      const iconSignature = `${THEME_ICON_VERSION}:${iconName}`;
      if (replacement.className !== expectedClass) replacement.className = expectedClass;
      if (replacement.dataset.dreamIcon !== iconSignature) {
        replacement.innerHTML = THEME_ICON_SVGS[iconName];
        replacement.querySelector("svg")?.classList.add("dream-theme-svg");
        replacement.dataset.dreamIcon = iconSignature;
      }
    };

    const now = Date.now();
    if (sidebarDirty && now >= sidebarReadyAt) {
      sidebarDirty = false;
    const sidebarButtons = [...(shellSidebar.querySelectorAll?.("button") || [])];
    const exactText = (node) => (node.getAttribute("aria-label") || node.textContent || "").trim();
    const primaryLabels = new Set([
      "新建任务", "拉取请求", "站点", "已安排", "插件",
      "New task", "Pull requests", "Sites", "Scheduled", "Plugins",
    ]);
    const sectionLabels = new Set(["项目", "任务", "Projects", "Tasks"]);
    const iconNameForLabel = (label) => {
      if (label === "Codex") return "chevron";
      if (["搜索", "Search"].includes(label)) return "search";
      if (["新建任务", "New task"].includes(label)) return "compose";
      if (label === "Quick chat") return "quick";
      if (["拉取请求", "Pull requests"].includes(label)) return "branch";
      if (["站点", "Sites"].includes(label)) return "sites";
      if (["已安排", "Scheduled"].includes(label)) return "clock";
      if (["插件", "Plugins"].includes(label)) return "plugins";
      if (sectionLabels.has(label)) return "chevron";
      if (["项目侧边栏选项", "任务侧边栏选项", "Project sidebar options", "Task sidebar options"].includes(label)) return "more";
      if (["添加新项目", "Add new project"].includes(label)) return "add";
      if (/的项目操作$/.test(label) || /project actions?$/i.test(label)) return "more";
      if (/^在 .+ 中新建任务$/.test(label) || /^New task in .+/i.test(label)) return "compose";
      if (["置顶任务", "Pin task"].includes(label)) return "pin";
      if (["归档任务", "Archive task"].includes(label)) return "archive";
      if (["打开帮助菜单", "Open help menu"].includes(label)) return "help";
      return "";
    };
    for (const button of sidebarButtons) {
      const label = exactText(button);
      button.classList.toggle("dream-brand-button", label === "Codex");
      button.classList.toggle("dream-nav-primary", primaryLabels.has(label));
      button.classList.toggle("dream-section-heading", sectionLabels.has(label));
      if (label === "Codex") {
        let brandMark = button.querySelector?.(":scope > .dream-theme-brand-mark");
        if (!brandMark) {
          brandMark = document.createElement("span");
          brandMark.className = "dream-theme-brand-mark";
          brandMark.setAttribute("aria-hidden", "true");
          button.insertBefore?.(brandMark, button.firstChild || null);
        }
        const brandSignature = `${THEME_ICON_VERSION}:${brandIcon}`;
        if (brandMark.dataset.dreamIcon !== brandSignature) {
          brandMark.innerHTML = THEME_ICON_SVGS[brandIcon] || "";
          brandMark.querySelector("svg")?.classList.add("dream-theme-svg");
          brandMark.dataset.dreamIcon = brandSignature;
        }
      }
      installThemeIcon(button.querySelector?.("svg:not(.dream-theme-svg)"), iconNameForLabel(label));
    }
    for (const source of [...(shellSidebar.querySelectorAll?.("svg") || [])]) {
      if (source.classList.contains("dream-theme-svg")) continue;
      const firstPath = source.querySelector?.("path")?.getAttribute?.("d") || "";
      const priorReplacement = source.previousElementSibling;
      const knownFolder = priorReplacement?.classList.contains("dream-theme-icon-folder") ||
        firstPath.startsWith("M4.75488 2.1416") || firstPath.startsWith("M5.36914 2.1416");
      if (knownFolder) installThemeIcon(source, "folder");
    }
    }

    for (const button of document.querySelectorAll(".composer-surface-chrome button")) {
      const label = (button.getAttribute("aria-label") || button.textContent || "").trim();
      const navigation = button.getAttribute("data-composer-navigation-target") || "";
      const isComposerAction = !navigation && button.matches("button.size-token-button-composer");
      const isProcessing = isComposerAction && ["停止", "Stop"].includes(label);
      let iconName = "";
      if (navigation === "add-context" || ["添加文件等内容", "Add files and more"].includes(label)) iconName = "add";
      else if (navigation === "permissions") {
        if (/^(?:完全访问|Full access)/i.test(label)) iconName = "permissionFull";
        else if (/^(?:替我审批|Agent approval)/i.test(label)) iconName = "permissionAgent";
        else iconName = "permissionAsk";
        if (permissionMenuListener && !permissionButtons.has(button)) {
          button.addEventListener?.("click", permissionMenuListener);
          permissionButtons.add(button);
        }
      }
      else if (["听写", "Dictate"].includes(label)) iconName = "mic";
      else if (isComposerAction) iconName = isProcessing ? processingIcon : sendIcon;
      button.classList.toggle("dream-composer-send", isComposerAction && !isProcessing);
      button.classList.toggle("dream-composer-processing", isProcessing);
      if (iconName) installThemeIcon(button.querySelector("svg:not(.dream-theme-svg)"), iconName, isProcessing ? "dream-theme-icon-processing" : isComposerAction ? "dream-theme-icon-send" : "");
    }

    const permissionIconFor = (label) => {
      if (/^(?:请求批准|Ask for approval|Request approval)/i.test(label)) return "permissionAsk";
      if (/^(?:替我审批|Agent approval)/i.test(label)) return "permissionAgent";
      if (/^(?:完全访问权限|Full access)/i.test(label)) return "permissionFull";
      return "";
    };
    for (const menu of document.querySelectorAll('[role="menu"][data-state="open"]')) {
      const items = [...menu.querySelectorAll(':scope > [role="menuitem"]')];
      const themedItems = items.map((item) => ({
        item,
        iconName: permissionIconFor((item.textContent || "").trim()),
      })).filter((entry) => entry.iconName);
      if (!themedItems.length) continue;
      menu.classList.add("dream-permission-menu");
      for (const { item, iconName } of themedItems) {
        item.classList.add("dream-permission-item");
        const row = item.querySelector(":scope > div");
        const nativeIcons = [...(row?.querySelectorAll?.(":scope > svg:not(.dream-theme-svg)") || [])];
        installThemeIcon(nativeIcons[0], iconName);
        if (nativeIcons.length > 1) installThemeIcon(nativeIcons[nativeIcons.length - 1], brandIcon);
      }
    }

    if (spinnerDirty || now - lastSpinnerAt > 10000) {
    spinnerDirty = false;
    lastSpinnerAt = now;
    const isNativeSpinner = (source) => source.matches?.(SPINNER_SELECTOR) || (
      source.tagName?.toLowerCase() === "svg" &&
      source.querySelector?.('path[opacity="0.3"], path[opacity=".3"]') &&
      (source.querySelectorAll?.("path")?.length || 0) >= 2
    );
    for (const source of [...document.querySelectorAll(".dream-theme-spinner-source")]) {
      if (isNativeSpinner(source)) continue;
      source.classList.remove("dream-theme-spinner-source");
      const host = source.tagName?.toLowerCase() === "svg" ? source.parentElement : source;
      host?.classList.remove("dream-theme-spinner");
      host?.querySelector?.(":scope > .dream-theme-spinner-mark")?.remove();
    }
    const spinnerCandidates = new Set([
      ...document.querySelectorAll(SPINNER_SELECTOR),
      ...[...document.querySelectorAll("aside.app-shell-left-panel svg")].filter((source) =>
        source.querySelector?.('path[opacity="0.3"], path[opacity=".3"]') &&
        (source.querySelectorAll?.("path")?.length || 0) >= 2),
    ]);
    for (const source of spinnerCandidates) {
      if (!isNativeSpinner(source)) continue;
      const bounds = source.getBoundingClientRect?.();
      if (bounds && (bounds.width > 34 || bounds.height > 34)) continue;
      const host = source.tagName?.toLowerCase() === "svg" ? source.parentElement : source;
      if (!host) continue;
      if (!source.classList.contains("dream-theme-spinner-source")) {
        source.classList.add("dream-theme-spinner-source");
      }
      if (!host.classList.contains("dream-theme-spinner")) {
        host.classList.add("dream-theme-spinner");
      }
      let spinnerMark = host.querySelector?.(":scope > .dream-theme-spinner-mark");
      if (!spinnerMark) {
        spinnerMark = document.createElement("span");
        spinnerMark.className = "dream-theme-spinner-mark";
        spinnerMark.setAttribute("aria-hidden", "true");
        host.appendChild?.(spinnerMark);
      }
      const spinnerSignature = `${THEME_ICON_VERSION}:${spinnerIcon}-spinner`;
      if (spinnerMark.dataset.dreamIcon !== spinnerSignature) {
        spinnerMark.innerHTML = THEME_ICON_SVGS[spinnerIcon] || "";
        spinnerMark.querySelector("svg")?.classList.add("dream-theme-svg");
        spinnerMark.dataset.dreamIcon = spinnerSignature;
      }
    }
    }
  };

  const cleanup = () => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken) return false;
    window.__CODEX_DREAM_SKIN_DISABLED__ = true;
    clearSkinDom();
    state?.observer?.disconnect();
    if (state?.timer) clearInterval(state.timer);
    if (state?.scheduler?.timeout) clearTimeout(state.scheduler.timeout);
    if (state?.scheduler?.sidebarTimeout) clearTimeout(state.scheduler.sidebarTimeout);
    if (permissionMenuTimer) clearTimeout(permissionMenuTimer);
    if (permissionMenuListener) document.removeEventListener?.("click", permissionMenuListener, true);
    for (const button of permissionButtons) button.removeEventListener?.("click", permissionMenuListener);
    permissionButtons.clear();
    windowDragHeader?.removeEventListener?.("mousedown", windowDragStart, true);
    window.removeEventListener?.("mouseup", windowDragEnd, true);
    window.removeEventListener?.("pointerup", windowDragEnd, true);
    window.removeEventListener?.("pointercancel", windowDragEnd, true);
    window.removeEventListener?.("blur", windowDragEnd, true);
    if (windowDragTimer) clearTimeout(windowDragTimer);
    document.documentElement?.classList.remove("dream-window-dragging");
    windowDragHeader = null;
    if (state?.artUrl) URL.revokeObjectURL(state.artUrl);
    delete window[STATE_KEY];
    return true;
  };

  const scheduler = { timeout: null, sidebarTimeout: null };
  const scheduleEnsure = () => {
    if (scheduler.timeout) return;
    scheduler.timeout = setTimeout(() => {
      scheduler.timeout = null;
      ensure();
    }, 48);
  };
  const scheduleSidebarEnsure = () => {
    if (scheduler.sidebarTimeout) clearTimeout(scheduler.sidebarTimeout);
    scheduler.sidebarTimeout = setTimeout(() => {
      scheduler.sidebarTimeout = null;
      ensure();
    }, 280);
  };
  observer = new MutationObserver((records = []) => {
    if (samplingNativeShell) return;
    const relevant = records.some((record) => {
      const target = record.target;
      const elements = [...record.addedNodes, ...record.removedNodes].filter((node) => node?.nodeType === 1);
      const inSidebar = Boolean(target.closest?.("aside.app-shell-left-panel"));
      const inComposer = Boolean(target.closest?.(".composer-surface-chrome"));
      const actionStateChanged = record.type === "attributes" && inComposer &&
        target.matches?.("button.size-token-button-composer");
      const mainRootChanged = Boolean(target.matches?.("main.main-surface, [role='main']")) && elements.length > 0;
      const sidebarChanged = (inSidebar && elements.length > 0) ||
        elements.some((node) => node.matches?.("aside.app-shell-left-panel"));
      const composerChanged = inComposer && elements.length > 0;
      const permissionMenuChanged = elements.some((node) =>
        node.matches?.('[role="menu"], [data-radix-popper-content-wrapper]') ||
        node.querySelector?.('[role="menu"]'));
      const spinnerChanged = Boolean(target.closest?.(SPINNER_SELECTOR)) ||
        elements.some((node) => node.matches?.(`${SPINNER_SELECTOR}, [role='progressbar']`));
      if (sidebarChanged) {
        sidebarDirty = true;
        spinnerDirty = true;
        sidebarReadyAt = Date.now() + 220;
        scheduleSidebarEnsure();
      }
      if (spinnerChanged) spinnerDirty = true;
      return composerChanged || permissionMenuChanged || actionStateChanged || mainRootChanged || spinnerChanged ||
        target === document.body || target === document.documentElement ||
        elements.some((node) => node.matches?.("main.main-surface, [role='main'], [class*='_homeUtilityBar_']"));
    });
    if (relevant) scheduleEnsure();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "disabled"],
  });
  permissionMenuListener = (event) => {
    if (!event.target?.closest?.('button[data-composer-navigation-target="permissions"]')) return;
    if (permissionMenuTimer) clearTimeout(permissionMenuTimer);
    permissionMenuTimer = setTimeout(() => {
      permissionMenuTimer = null;
      const state = window[STATE_KEY];
      if (state?.installToken === installToken) ensure();
    }, 120);
  };
  document.addEventListener?.("click", permissionMenuListener, true);
  windowDragStart = (event) => {
    if (event.button !== 0 || event.target?.closest?.("button, a, input, textarea, select, [role='button']")) return;
    document.documentElement?.classList.add("dream-window-dragging");
    if (windowDragTimer) clearTimeout(windowDragTimer);
    windowDragTimer = setTimeout(windowDragEnd, 4000);
  };
  windowDragEnd = () => {
    document.documentElement?.classList.remove("dream-window-dragging");
    if (windowDragTimer) clearTimeout(windowDragTimer);
    windowDragTimer = null;
  };
  window.addEventListener?.("mouseup", windowDragEnd, true);
  window.addEventListener?.("pointerup", windowDragEnd, true);
  window.addEventListener?.("pointercancel", windowDragEnd, true);
  window.addEventListener?.("blur", windowDragEnd, true);
  const timer = setInterval(() => { spinnerDirty = true; ensure(); }, 30000);
  window[STATE_KEY] = {
    ensure, cleanup, observer, timer, scheduler, artUrl, profile, config, installToken, version: "1.4.1",
  };
  ensure();
  analyzeArt().then((result) => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken || window.__CODEX_DREAM_SKIN_DISABLED__) return;
    profile = result;
    state.profile = result;
    ensure();
  });
  return { installed: true, version: "1.4.1", adaptive: true };
})(__DREAM_CSS_JSON__, __DREAM_ART_JSON__, __DREAM_THEME_JSON__, __DREAM_ICONS_JSON__)
