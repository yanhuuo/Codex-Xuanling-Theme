((cssText, artDataUrl, rawConfig) => {
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
  const REMIEL_ICON_VERSION = "1";
  const remielSvg = (body) => `<svg class="dream-remiel-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const REMIEL_ICON_SVGS = {
    seraph: remielSvg(`
      <path d="M12 2.1 14.1 8l5.8-2.2-3.6 5.1 5.6 2.5-6.1.5.8 6.1-4.6-4.1L7.4 20l.8-6.1-6.1-.5 5.6-2.5-3.6-5.1L9.9 8 12 2.1Z" fill="#fff4fb" stroke="#c7a9ff" stroke-width=".85" stroke-linejoin="round"/>
      <path d="m12 6.3 2.2 4.1 4.5 1.6-4.5 1.6-2.2 4.1-2.2-4.1L5.3 12l4.5-1.6L12 6.3Z" fill="#ef5f9f" stroke="#7f56ba" stroke-width=".8"/>
      <circle cx="12" cy="12" r="1.45" fill="#fff"/>
    `),
    chevron: remielSvg(`<path d="m4 8 8 7.6L20 8l-3.2-.8L12 11.8 7.2 7.2 4 8Z" fill="#efa0c8" stroke="#c7a9ff" stroke-width=".9" stroke-linejoin="round"/><path d="m9.3 8 2.7-3 2.7 3-2.7 2.1L9.3 8Z" fill="#fff4fb"/>`),
    search: remielSvg(`<circle cx="10.2" cy="10.2" r="6.2" fill="#342139" stroke="#c7a9ff" stroke-width="1"/><path d="m6.8 10.2 2.2-.8 1.2-2.1 1.2 2.1 2.2.8-2.2.8-1.2 2.1L9 11l-2.2-.8Z" fill="#ef6ba7"/><path d="m14.7 14.7 5 5" stroke="#fff4fb" stroke-width="1.8" stroke-linecap="round"/>`),
    compose: remielSvg(`<path d="M4 19.5c4.9-1.2 8.9-5.1 12-11.7l2.9-2.9c1-1 2.4.4 1.4 1.4l-2.9 2.9C10.8 12.3 6.9 16.3 5.7 21L4 19.5Z" fill="#ef6ba7" stroke="#c7a9ff" stroke-width=".9"/><path d="m5.2 7.4 1.1-2.2 2.2-1.1-2.2-1.1-1.1-2.2L4.1 3 1.9 4.1l2.2 1.1 1.1 2.2Z" fill="#fff4fb"/>`),
    quick: remielSvg(`<path d="M3 4.5h18v12.2H9l-4.7 3.6v-3.6H3V4.5Z" fill="#342139" stroke="#c7a9ff" stroke-width=".9"/><path d="m12 7 1.3 2.6L16 11l-2.7 1.4L12 15l-1.3-2.6L8 11l2.7-1.4L12 7Z" fill="#ef6ba7"/>`),
    branch: remielSvg(`<path d="M6 5v10c0 2.1 1.4 3.2 3.5 3.2H14c2 0 3-1.2 3-3.2V9M6 9c3.2 0 5.3-1.1 6.2-3.4" fill="none" stroke="#ef8fbd" stroke-width="1.45" stroke-linecap="round"/><path d="m3 4.5 3-3 3 3-3 2.3-3-2.3Zm11 .6L17 2l3 3.1L17 7.5l-3-2.4Zm0 13.2 3-3.1 3 3.1-3 2.4-3-2.4Z" fill="#fff4fb" stroke="#c7a9ff" stroke-width=".75"/>`),
    sites: remielSvg(`<path d="m3 5.5 4-3.3 4 3.3-4 3.3-4-3.3Zm10 0 4-3.3 4 3.3-4 3.3-4-3.3ZM3 16.5l4-4.2 4 4.2-4 5-4-5Zm10 0 4-4.2 4 4.2-4 5-4-5Z" fill="#ef6ba7" stroke="#c7a9ff" stroke-width=".8"/>`),
    clock: remielSvg(`<circle cx="12" cy="12" r="8.6" fill="#342139" stroke="#c7a9ff" stroke-width="1"/><path d="M12 6.8v5.4l4.2 2.1" fill="none" stroke="#fff4fb" stroke-width="1.35" stroke-linecap="round"/><path d="m4.7 3.1.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" fill="#ef6ba7"/>`),
    plugins: remielSvg(`<path d="M12 3c5 0 8 3.6 8 8 0 4.8-5.7 7-8.8 3.5-2.8 2.8-7.3.8-7.3-3 0-3.2 3-5.5 6-4.4 2.4.9 3 3.9.8 5.6" fill="none" stroke="#ef8fbd" stroke-width="1.55" stroke-linecap="round"/><path d="m9 4 3-3 3 3-3 2.3L9 4Z" fill="#fff4fb" stroke="#c7a9ff" stroke-width=".8"/><circle cx="12" cy="12" r="1.2" fill="#ef5f9f"/>`),
    folder: remielSvg(`<path d="M2.5 5.2h6l2 2h11v11.3h-19V5.2Z" fill="#342139" stroke="#c7a9ff" stroke-width=".9"/><path d="M4.2 9h15.6" stroke="#ef8fbd" stroke-width="1"/><path d="m14.7 11.2 1.1 2.2 2.2 1.1-2.2 1.1-1.1 2.2-1.1-2.2-2.2-1.1 2.2-1.1 1.1-2.2Z" fill="#fff4fb"/>`),
    more: remielSvg(`<path d="m2.8 12 3.2-3.1 3.1 3.1L6 14.5 2.8 12Zm6.2 0 3.1-3.1 3.1 3.1-3.1 2.5L9 12Zm6.1 0 3.1-3.1 3.1 3.1-3.1 2.5-3.1-2.5Z" fill="#ef8fbd" stroke="#c7a9ff" stroke-width=".7"/>`),
    add: remielSvg(`<path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8V3Z" fill="#ef6ba7" stroke="#c7a9ff" stroke-width=".55"/><path d="m3.8 2 .8 1.6 1.6.8-1.6.8-.8 1.6L3 5.2l-1.6-.8L3 3.6 3.8 2Z" fill="#fff4fb"/>`),
    pin: remielSvg(`<path d="m7 3 10 4-2.2 2.2 2 4.8-2.8 2.8-4.8-2L7 17l-4-4 2.2-2.2L3 6l4-3Z" fill="#ef6ba7" stroke="#c7a9ff" stroke-width=".9"/><path d="M9.6 14.4 4 21" stroke="#fff4fb" stroke-width="1.3" stroke-linecap="round"/>`),
    archive: remielSvg(`<path d="M3 4.2h18v5H3v-5Zm1.2 5H20v10.6H4.2V9.2Z" fill="#342139" stroke="#c7a9ff" stroke-width=".9"/><path d="M9 12h6" stroke="#ef8fbd" stroke-width="1.4" stroke-linecap="round"/><path d="m16.8 14 .8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8.8-1.6Z" fill="#fff4fb"/>`),
    help: remielSvg(`<circle cx="12" cy="12" r="9" fill="#342139" stroke="#c7a9ff" stroke-width="1"/><path d="M9.2 9a3 3 0 1 1 4.1 2.8c-1 .4-1.3 1.1-1.3 2.2m0 3h.01" fill="none" stroke="#ef8fbd" stroke-width="1.7" stroke-linecap="round"/><path d="m4.2 3.2.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8.8-1.6Z" fill="#fff4fb"/>`),
    shield: remielSvg(`<path d="M12 2.2 19 5v5.8c0 4.6-2.8 8.1-7 10.8-4.2-2.7-7-6.2-7-10.8V5l7-2.8Z" fill="#342139" stroke="#c7a9ff" stroke-width="1"/><path d="m12 6 1.4 3.1 3.1 1.4-3.1 1.4L12 15l-1.4-3.1-3.1-1.4 3.1-1.4L12 6Z" fill="#ef6ba7"/>`),
    permissionAsk: remielSvg(`<path d="M4 19c2.4-6.3 6.6-11 12.8-15.7-.7 6.8-4.7 11.6-11.9 14.3L4 19Z" fill="#342139" stroke="#c7a9ff" stroke-width=".9"/><path d="M5.3 16.8c3.8-1.6 6.9-4.3 9.4-8.1" fill="none" stroke="#ef8fbd" stroke-width="1.15" stroke-linecap="round"/><path d="m18 3 .8 1.8 1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8L18 3Z" fill="#fff4fb"/>`),
    permissionAgent: remielSvg(`<path d="M12 2.2 19 5v5.8c0 4.6-2.8 8.1-7 10.8-4.2-2.7-7-6.2-7-10.8V5l7-2.8Z" fill="#342139" stroke="#c7a9ff" stroke-width="1"/><path d="m7 12 3.2-1.1L12 7.8l1.8 3.1L17 12l-3.2 1.1L12 16.2l-1.8-3.1L7 12Z" fill="#ef6ba7"/>`),
    permissionFull: remielSvg(`<path d="M12 2 19.4 5v5.9c0 4.8-3 8.4-7.4 11.1-4.4-2.7-7.4-6.3-7.4-11.1V5L12 2Z" fill="#342139" stroke="#c7a9ff" stroke-width="1"/><path d="m6.5 12 3.4-1.2L12 7.4l2.1 3.4 3.4 1.2-3.4 1.2L12 16.6l-2.1-3.4L6.5 12Z" fill="#fff4fb"/><circle cx="12" cy="12" r="1.5" fill="#ef5f9f"/>`),
    mic: remielSvg(`<rect x="8.3" y="3" width="7.4" height="11" rx="3.7" fill="#342139" stroke="#c7a9ff" stroke-width=".9"/><path d="M5.8 10.5c0 3.4 2.5 5.8 6.2 5.8s6.2-2.4 6.2-5.8M12 16.4V21M8.8 21h6.4" fill="none" stroke="#ef8fbd" stroke-width="1.4" stroke-linecap="round"/><path d="m12 5.4.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8.8-1.6Z" fill="#fff4fb"/>`),
    send: remielSvg(`<path d="M3 11.8 21 3l-6.2 18-3.1-6.6L3 11.8Z" fill="#ef6ba7" stroke="#c7a9ff" stroke-width=".9" stroke-linejoin="round"/><path d="m11.7 14.4 4.9-6.7-7.2 5.6" fill="none" stroke="#fff4fb" stroke-width="1.15" stroke-linecap="round"/><path d="m5 6 .8 1.7 1.7.8-1.7.8L5 11l-.8-1.7-1.7-.8 1.7-.8L5 6Z" fill="#fff4fb"/>`),
  };
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
    const cleanText = (candidate, maxLength) =>
      typeof candidate === "string" && candidate.length <= maxLength && !/[\u0000-\u001f]/.test(candidate)
        ? candidate.trim()
        : "";
    const metadataRatio = Number(config?.artMetadata?.ratio);
    return {
      appearance,
      safeArea,
      taskMode,
      brandSubtitle: cleanText(config.brandSubtitle, 100),
      tagline: cleanText(config.tagline, 120),
      statusText: cleanText(config.statusText, 80),
      quote: cleanText(config.quote, 100),
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
    document.querySelectorAll(".dream-task").forEach((node) => node.classList.remove("dream-task"));
    document.querySelectorAll(".dream-home-shell").forEach((node) => node.classList.remove("dream-home-shell"));
    document.querySelectorAll(`.${HOME_UTILITY_CLASS}`).forEach((node) => node.classList.remove(HOME_UTILITY_CLASS));
    document.querySelectorAll(".dream-remiel-icon").forEach((node) => node.remove());
    document.querySelectorAll(".dream-remiel-brand-mark").forEach((node) => node.remove());
    document.querySelectorAll(".dream-composer-send").forEach((node) => node.classList.remove("dream-composer-send"));
    document.querySelectorAll(".dream-composer-processing").forEach((node) => node.classList.remove("dream-composer-processing"));
    document.querySelectorAll(".dream-permission-menu").forEach((node) => node.classList.remove("dream-permission-menu"));
    document.querySelectorAll(".dream-permission-item").forEach((node) => node.classList.remove("dream-permission-item"));
    document.querySelectorAll(".dream-remiel-spinner-mark").forEach((node) => node.remove());
    document.querySelectorAll(".dream-native-icon-source").forEach((node) => node.classList.remove("dream-native-icon-source"));
    document.querySelectorAll(".dream-remiel-spinner-source").forEach((node) => {
      node.classList.remove("dream-remiel-spinner-source");
      node.parentElement?.classList.remove("dream-remiel-spinner");
    });
    document.querySelectorAll(".dream-remiel-spinner").forEach((node) => node.classList.remove("dream-remiel-spinner"));
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

    const home = document.querySelector('[data-testid="home-icon"]')?.closest('[role="main"]') || null;
    for (const candidate of document.querySelectorAll('[role="main"]')) {
      candidate.classList.toggle("dream-home", candidate === home);
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

    const installRemielIcon = (source, iconName) => {
      if (!source || !iconName) return;
      if (!source.classList.contains("dream-native-icon-source")) {
        source.classList.add("dream-native-icon-source");
      }
      let replacement = source.previousElementSibling;
      if (!replacement?.classList.contains("dream-remiel-icon")) {
        replacement = document.createElement("span");
        replacement.setAttribute("aria-hidden", "true");
        source.parentElement?.insertBefore(replacement, source);
      }
      const expectedClass = `dream-remiel-icon dream-remiel-icon-${iconName}`;
      const iconSignature = `${REMIEL_ICON_VERSION}:${iconName}`;
      if (replacement.className !== expectedClass) replacement.className = expectedClass;
      if (replacement.dataset.dreamIcon !== iconSignature) {
        replacement.innerHTML = REMIEL_ICON_SVGS[iconName];
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
        let brandMark = button.querySelector?.(":scope > .dream-remiel-brand-mark");
        if (!brandMark) {
          brandMark = document.createElement("span");
          brandMark.className = "dream-remiel-brand-mark";
          brandMark.setAttribute("aria-hidden", "true");
          button.insertBefore?.(brandMark, button.firstChild || null);
        }
        const brandSignature = `${REMIEL_ICON_VERSION}:seraph`;
        if (brandMark.dataset.dreamIcon !== brandSignature) {
          brandMark.innerHTML = REMIEL_ICON_SVGS.seraph;
          brandMark.dataset.dreamIcon = brandSignature;
        }
      }
      installRemielIcon(button.querySelector?.("svg:not(.dream-remiel-svg)"), iconNameForLabel(label));
    }
    for (const source of [...(shellSidebar.querySelectorAll?.("svg") || [])]) {
      if (source.classList.contains("dream-remiel-svg")) continue;
      const firstPath = source.querySelector?.("path")?.getAttribute?.("d") || "";
      const priorReplacement = source.previousElementSibling;
      const knownFolder = priorReplacement?.classList.contains("dream-remiel-icon-folder") ||
        firstPath.startsWith("M4.75488 2.1416") || firstPath.startsWith("M5.36914 2.1416");
      if (knownFolder) installRemielIcon(source, "folder");
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
      else if (isComposerAction) iconName = "seraph";
      button.classList.toggle("dream-composer-send", isComposerAction && !isProcessing);
      button.classList.toggle("dream-composer-processing", isProcessing);
      if (iconName) installRemielIcon(button.querySelector("svg:not(.dream-remiel-svg)"), iconName);
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
        const nativeIcons = [...(row?.querySelectorAll?.(":scope > svg:not(.dream-remiel-svg)") || [])];
        installRemielIcon(nativeIcons[0], iconName);
        if (nativeIcons.length > 1) installRemielIcon(nativeIcons[nativeIcons.length - 1], "seraph");
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
    for (const source of [...document.querySelectorAll(".dream-remiel-spinner-source")]) {
      if (isNativeSpinner(source)) continue;
      source.classList.remove("dream-remiel-spinner-source");
      const host = source.tagName?.toLowerCase() === "svg" ? source.parentElement : source;
      host?.classList.remove("dream-remiel-spinner");
      host?.querySelector?.(":scope > .dream-remiel-spinner-mark")?.remove();
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
      if (!source.classList.contains("dream-remiel-spinner-source")) {
        source.classList.add("dream-remiel-spinner-source");
      }
      if (!host.classList.contains("dream-remiel-spinner")) {
        host.classList.add("dream-remiel-spinner");
      }
      let spinnerMark = host.querySelector?.(":scope > .dream-remiel-spinner-mark");
      if (!spinnerMark) {
        spinnerMark = document.createElement("span");
        spinnerMark.className = "dream-remiel-spinner-mark";
        spinnerMark.setAttribute("aria-hidden", "true");
        host.appendChild?.(spinnerMark);
      }
      const spinnerSignature = `${REMIEL_ICON_VERSION}:seraph-spinner`;
      if (spinnerMark.dataset.dreamIcon !== spinnerSignature) {
        spinnerMark.innerHTML = REMIEL_ICON_SVGS.seraph;
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
    window.removeEventListener?.("blur", windowDragEnd, true);
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
  };
  windowDragEnd = () => document.documentElement?.classList.remove("dream-window-dragging");
  window.addEventListener?.("mouseup", windowDragEnd, true);
  window.addEventListener?.("blur", windowDragEnd, true);
  const timer = setInterval(() => { spinnerDirty = true; ensure(); }, 30000);
  window[STATE_KEY] = {
    ensure, cleanup, observer, timer, scheduler, artUrl, profile, config, installToken, version: "1.4.0",
  };
  ensure();
  analyzeArt().then((result) => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken || window.__CODEX_DREAM_SKIN_DISABLED__) return;
    profile = result;
    state.profile = result;
    ensure();
  });
  return { installed: true, version: "1.4.0", adaptive: true };
})(__DREAM_CSS_JSON__, __DREAM_ART_JSON__, __DREAM_THEME_JSON__)
