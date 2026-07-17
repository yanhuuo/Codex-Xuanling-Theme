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
  const XUAN_ICON_VERSION = "3";
  const xuanSvg = (body) => `<svg class="dream-xuan-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const XUAN_ICON_SVGS = {
    bird: xuanSvg(`
      <path d="M11.7 10.8C8.5 9.8 5.1 6.6 2.3 1.8c.1 4.8 2.4 8.8 7.2 11.2" fill="#55c6eb" stroke="#d9b85f" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M12.1 9.9c1.2-4 3.6-7 7.1-8.7.1 4.3-1.6 7.8-5.2 10.4" fill="#276ba9" stroke="#d9b85f" stroke-width=".9" stroke-linejoin="round"/>
      <path d="M9.2 12.3c2.1-2.4 4.5-3.3 7.1-2.6l2.7-1.2 2.7 1.1-2.9 1.1c-1.2 2.7-3.8 4-7.5 3.7-1.6-.1-2.3-1.1-2.1-2.1Z" fill="#f5fdff" stroke="#2c78ae" stroke-width=".85" stroke-linejoin="round"/>
      <circle cx="18.2" cy="9.7" r=".55" fill="#143d72"/>
      <path d="M11.8 14.1C9.6 16 7.6 18.8 5.9 22.4M13.1 14.2c1.6 2.8 4 5.2 7.1 7.2" fill="none" stroke="#d9b85f" stroke-width="1.05" stroke-linecap="round"/>
      <path d="M11.4 14.1C8.9 16.3 7.2 18.8 6 21.5M13.5 14.1c1.6 2.6 3.7 4.8 6.4 6.6" fill="none" stroke="#53c9ee" stroke-width=".62" stroke-linecap="round"/>
    `),
    chevron: xuanSvg(`<path d="M4 8.2c3.1.4 5.8 1.6 8 3.7 2.4-2.3 5-3.7 8-4.1-1.4 3.5-4 6.4-8 8.7-3.7-2.1-6.4-4.9-8-8.3Z" fill="#73d7f1" stroke="#d9b85f" stroke-width=".9" stroke-linejoin="round"/><path d="m8 11.1 4 2.3 4.3-2.6" fill="none" stroke="#f5fdff" stroke-width=".9" stroke-linecap="round"/>`),
    search: xuanSvg(`<circle cx="10.2" cy="10.1" r="6.1" fill="#102c4e" stroke="#d9b85f" stroke-width="1"/><circle cx="10.2" cy="10.1" r="4.5" fill="none" stroke="#91e5f7" stroke-width="1.15"/><path d="m14.6 14.5 5 5" stroke="#f5fdff" stroke-width="1.8" stroke-linecap="round"/><path d="M3.8 4.6C2.4 7 2.2 9.1 3.2 11 1.3 9.8.6 7.8 1.1 5.1l2.7-.5Z" fill="#56c8eb" stroke="#d9b85f" stroke-width=".7"/>`),
    compose: xuanSvg(`<path d="M5 18.8c4.4-1.2 8.2-4.7 11.4-10.5l3-3c.8-.8 2.1.5 1.3 1.3l-3 3C11.9 12.8 8.4 16.6 7.2 21L5 18.8Z" fill="#62cdec" stroke="#d9b85f" stroke-width=".9" stroke-linejoin="round"/><path d="M8.2 17.1c2.1-1.7 4-3.8 5.6-6.2" stroke="#f7feff" stroke-width="1" stroke-linecap="round"/><path d="M4 14V6.8C4 5.3 5.3 4 6.8 4H13" fill="none" stroke="#3689bb" stroke-width="1.4" stroke-linecap="round"/>`),
    quick: xuanSvg(`<path d="M3 4.5h18v12.3H9l-4.6 3.6v-3.6H3V4.5Z" fill="#153757" stroke="#d9b85f" stroke-width=".9" stroke-linejoin="round"/><path d="M11 7v3H8v2h3v3h2v-3h3v-2h-3V7h-2Z" fill="#7bddf2"/><path d="M16.3 5c1.2 1.7 2.7 2.7 4.5 3-1.7.9-3.2 1-4.6.3L16.3 5Z" fill="#f6fdff"/>`),
    branch: xuanSvg(`<path d="M6 5v10.2c0 2 1.4 3 3.5 3H14c2 0 3-1.2 3-3V9M6 9.2c3.2 0 5.3-1.1 6.2-3.4" fill="none" stroke="#65d4ef" stroke-width="1.45" stroke-linecap="round"/><path d="m3.2 4.5 2.8-3 2.8 3L6 6.7 3.2 4.5Zm10.9.7L17 2l3 3.2L17 7.5l-2.9-2.3Zm0 13.2 2.9-3.1 3 3.1-3 2.3-2.9-2.3Z" fill="#f5fdff" stroke="#d9b85f" stroke-width=".75" stroke-linejoin="round"/>`),
    sites: xuanSvg(`<path d="m3 5.4 4.3-3.1 3.5 3.8-4 2.8L3 5.4Zm10.3 0 4.3-3.1 3.5 3.8-4 2.8-3.8-3.5ZM3 16.3l3.8-4.1 4 3.4-3.4 5L3 16.3Zm10.3 0 3.8-4.1 4 3.4-3.4 5-4.4-4.3Z" fill="#51c3e7" stroke="#d9b85f" stroke-width=".8" stroke-linejoin="round"/><path d="m6.2 5.2 1.1-.8M16.5 5.2l1.1-.8M6.2 16.2l1-1M16.5 16.2l1-1" stroke="#f7feff" stroke-width="1.1" stroke-linecap="round"/>`),
    clock: xuanSvg(`<circle cx="12" cy="12" r="8.6" fill="#112f4e" stroke="#d9b85f" stroke-width="1"/><circle cx="12" cy="12" r="6.8" fill="none" stroke="#67d4ef" stroke-width="1"/><path d="M12 7.3v4.8l4 2" fill="none" stroke="#f6fdff" stroke-width="1.35" stroke-linecap="round"/><path d="M4.4 3.5c2.4.9 4.2.5 5.4-1.3-.6 2.7-2 4.5-4.3 5.2.2-1.6-.2-2.9-1.1-3.9Z" fill="#54c6e9" stroke="#d9b85f" stroke-width=".7"/>`),
    plugins: xuanSvg(`<path d="M12 3c5 0 8 3.6 8 8 0 4.7-5.7 7-8.8 3.5-2.8 2.8-7.3.8-7.3-3 0-3.2 3-5.5 6-4.4 2.4.9 3 3.9.8 5.6" fill="none" stroke="#68d5ef" stroke-width="1.55" stroke-linecap="round"/><path d="m9.1 4 3-3 3 3-3 2.3L9.1 4Z" fill="#f6fdff" stroke="#d9b85f" stroke-width=".8"/><circle cx="12" cy="12" r="1.2" fill="#d9b85f"/>`),
    folder: xuanSvg(`<path d="M2.5 5.2h6l2 2h11v11.3h-19V5.2Z" fill="#122f4c" stroke="#d9b85f" stroke-width=".9" stroke-linejoin="round"/><path d="M4.2 9h15.6" stroke="#61d0ec" stroke-width="1"/><path d="M7.2 17c3.3-1 5.9-3.2 7.7-6.4.1 2.3 1.1 3.9 3.1 4.7-4 .2-7.6.7-10.8 1.7Z" fill="#68d5ef" stroke="#f5fdff" stroke-width=".55"/>`),
    more: xuanSvg(`<path d="m2.8 12 3.2-3.1L9.1 12 6 14.5 2.8 12Zm6.2 0 3.1-3.1 3.1 3.1-3.1 2.5L9 12Zm6.1 0 3.1-3.1 3.1 3.1-3.1 2.5-3.1-2.5Z" fill="#65d2ed" stroke="#d9b85f" stroke-width=".7" stroke-linejoin="round"/><path d="m5 11.8 1-.8m5 1 1-.8m5.1.8 1-.8" stroke="#f7feff" stroke-width=".8"/>`),
    add: xuanSvg(`<path d="M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8V3Z" fill="#72dbf2" stroke="#d9b85f" stroke-width=".55"/><path d="m2.2 4 2-2 2.1 2-2.1 1.7L2.2 4Zm15.5 16 2.1-2 2 2-2 1.7-2.1-1.7Z" fill="#f6fdff" stroke="#d9b85f" stroke-width=".65"/>`),
    pin: xuanSvg(`<path d="m7 3 10 4-2.2 2.2 2 4.8-2.8 2.8-4.8-2L7 17l-4-4 2.2-2.2L3 6l4-3Z" fill="#4dbde4" stroke="#d9b85f" stroke-width=".9" stroke-linejoin="round"/><path d="M9.6 14.4 4 21" stroke="#f6fdff" stroke-width="1.3" stroke-linecap="round"/>`),
    archive: xuanSvg(`<path d="M3 4.2h18v5H3v-5Zm1.2 5H20v10.6H4.2V9.2Z" fill="#143552" stroke="#d9b85f" stroke-width=".9" stroke-linejoin="round"/><path d="M9 12h6" stroke="#6ad5ef" stroke-width="1.4" stroke-linecap="round"/><path d="M13.8 18.6c2.1-1 3.6-2.8 4.6-5.2.2 2.3.7 4 1.5 5.2h-6.1Z" fill="#f4fdff" stroke="#4ebfe5" stroke-width=".55"/>`),
    help: xuanSvg(`<circle cx="12" cy="12" r="9" fill="#12324f" stroke="#d9b85f" stroke-width="1"/><path d="M9.2 9a3 3 0 1 1 4.1 2.8c-1 .4-1.3 1.1-1.3 2.2m0 3h.01" fill="none" stroke="#7bdcf2" stroke-width="1.7" stroke-linecap="round"/><path d="M3.2 5.8c2 .2 3.5-.5 4.5-2-.4 2.3-1.6 3.8-3.5 4.5l-1-2.5Z" fill="#f5fdff"/>`),
    shield: xuanSvg(`<path d="M12 2.2 19 5v5.8c0 4.6-2.8 8.1-7 10.8-4.2-2.7-7-6.2-7-10.8V5l7-2.8Z" fill="#153755" stroke="#d9b85f" stroke-width="1"/><path d="M12 5.3v12.3c2.6-2 4.3-4.2 4.3-7V7.1L12 5.3Z" fill="#55c7e9"/><path d="m8.8 11.5 2 2 4.2-4.5" fill="none" stroke="#f6fdff" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>`),
    mic: xuanSvg(`<rect x="8.3" y="3" width="7.4" height="11" rx="3.7" fill="#153755" stroke="#d9b85f" stroke-width=".9"/><path d="M5.8 10.5c0 3.4 2.5 5.8 6.2 5.8s6.2-2.4 6.2-5.8M12 16.4V21M8.8 21h6.4" fill="none" stroke="#68d5ef" stroke-width="1.4" stroke-linecap="round"/><path d="M9.8 6.2c1.5-.2 2.9-.8 4-1.9-.2 1.8-1.1 3.1-2.8 3.9l-1.2-2Z" fill="#f6fdff"/>`),
    send: xuanSvg(`<path d="M3 11.8 21 3l-6.2 18-3.1-6.6L3 11.8Z" fill="#56c8ea" stroke="#d9b85f" stroke-width=".9" stroke-linejoin="round"/><path d="m11.7 14.4 4.9-6.7-7.2 5.6" fill="none" stroke="#f7feff" stroke-width="1.15" stroke-linecap="round"/><path d="M4.1 9.2C6 8 7 6.4 7.2 4.3c1 2.2.8 4.2-.6 6l-2.5-1.1Z" fill="#276ba9"/>`),
  };
  const installToken = {};
  let samplingNativeShell = false;
  let observer = null;
  let sidebarDirty = true;
  let spinnerDirty = true;
  let lastSidebarAt = 0;
  let lastSpinnerAt = 0;
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
    document.querySelectorAll(".dream-xuan-icon").forEach((node) => node.remove());
    document.querySelectorAll(".dream-xuan-brand-mark").forEach((node) => node.remove());
    document.querySelectorAll(".dream-composer-send").forEach((node) => node.classList.remove("dream-composer-send"));
    document.querySelectorAll(".dream-xuanniao-spinner-mark").forEach((node) => node.remove());
    document.querySelectorAll(".dream-native-icon-source").forEach((node) => node.classList.remove("dream-native-icon-source"));
    document.querySelectorAll(".dream-xuanniao-spinner-source").forEach((node) => {
      node.classList.remove("dream-xuanniao-spinner-source");
      node.parentElement?.classList.remove("dream-xuanniao-spinner");
    });
    document.querySelectorAll(".dream-xuanniao-spinner").forEach((node) => node.classList.remove("dream-xuanniao-spinner"));
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

    const installXuanIcon = (source, iconName) => {
      if (!source || !iconName) return;
      if (!source.classList.contains("dream-native-icon-source")) {
        source.classList.add("dream-native-icon-source");
      }
      let replacement = source.previousElementSibling;
      if (!replacement?.classList.contains("dream-xuan-icon")) {
        replacement = document.createElement("span");
        replacement.setAttribute("aria-hidden", "true");
        source.parentElement?.insertBefore(replacement, source);
      }
      const expectedClass = `dream-xuan-icon dream-xuan-icon-${iconName}`;
      const iconSignature = `${XUAN_ICON_VERSION}:${iconName}`;
      if (replacement.className !== expectedClass) replacement.className = expectedClass;
      if (replacement.dataset.dreamIcon !== iconSignature) {
        replacement.innerHTML = XUAN_ICON_SVGS[iconName];
        replacement.dataset.dreamIcon = iconSignature;
      }
    };

    const now = Date.now();
    if (sidebarDirty || now - lastSidebarAt > 15000) {
      sidebarDirty = false;
      lastSidebarAt = now;
    const sidebarButtons = [...(shellSidebar.querySelectorAll?.("button") || [])];
    const exactText = (node) => (node.innerText || node.getAttribute("aria-label") || "").trim();
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
        let brandMark = button.querySelector?.(":scope > .dream-xuan-brand-mark");
        if (!brandMark) {
          brandMark = document.createElement("span");
          brandMark.className = "dream-xuan-brand-mark";
          brandMark.setAttribute("aria-hidden", "true");
          button.insertBefore?.(brandMark, button.firstChild || null);
        }
        const brandSignature = `${XUAN_ICON_VERSION}:bird`;
        if (brandMark.dataset.dreamIcon !== brandSignature) {
          brandMark.innerHTML = XUAN_ICON_SVGS.bird;
          brandMark.dataset.dreamIcon = brandSignature;
        }
      }
      installXuanIcon(button.querySelector?.("svg:not(.dream-xuan-svg)"), iconNameForLabel(label));
    }
    for (const source of [...(shellSidebar.querySelectorAll?.("svg") || [])]) {
      if (source.classList.contains("dream-xuan-svg")) continue;
      const firstPath = source.querySelector?.("path")?.getAttribute?.("d") || "";
      const priorReplacement = source.previousElementSibling;
      const knownFolder = priorReplacement?.classList.contains("dream-xuan-icon-folder") ||
        firstPath.startsWith("M4.75488 2.1416") || firstPath.startsWith("M5.36914 2.1416");
      if (knownFolder) installXuanIcon(source, "folder");
    }
    }

    for (const button of document.querySelectorAll(".composer-surface-chrome button")) {
      const label = (button.getAttribute("aria-label") || button.innerText || "").trim();
      const navigation = button.getAttribute("data-composer-navigation-target") || "";
      let iconName = "";
      if (navigation === "add-context" || ["添加文件等内容", "Add files and more"].includes(label)) iconName = "add";
      else if (navigation === "permissions") iconName = "shield";
      else if (["听写", "Dictate"].includes(label)) iconName = "mic";
      else if (!label && !navigation && button.matches(".size-token-button-composer")) iconName = "send";
      button.classList.toggle("dream-composer-send", iconName === "send");
      if (iconName) installXuanIcon(button.querySelector("svg:not(.dream-xuan-svg)"), iconName);
    }

    if (spinnerDirty || now - lastSpinnerAt > 10000) {
    spinnerDirty = false;
    lastSpinnerAt = now;
    const isNativeSpinner = (source) => source.matches?.(SPINNER_SELECTOR) || (
      source.tagName?.toLowerCase() === "svg" &&
      source.querySelector?.('path[opacity="0.3"]') &&
      (source.querySelectorAll?.("path")?.length || 0) >= 2
    );
    for (const source of [...document.querySelectorAll(".dream-xuanniao-spinner-source")]) {
      if (isNativeSpinner(source)) continue;
      source.classList.remove("dream-xuanniao-spinner-source");
      const host = source.tagName?.toLowerCase() === "svg" ? source.parentElement : source;
      host?.classList.remove("dream-xuanniao-spinner");
      host?.querySelector?.(":scope > .dream-xuanniao-spinner-mark")?.remove();
    }
    const spinnerCandidates = new Set([
      ...document.querySelectorAll(SPINNER_SELECTOR),
      ...document.querySelectorAll('svg:has(path[opacity="0.3"])'),
    ]);
    for (const source of spinnerCandidates) {
      if (!isNativeSpinner(source)) continue;
      const bounds = source.getBoundingClientRect?.();
      if (bounds && (bounds.width > 34 || bounds.height > 34)) continue;
      const host = source.tagName?.toLowerCase() === "svg" ? source.parentElement : source;
      if (!host) continue;
      if (!source.classList.contains("dream-xuanniao-spinner-source")) {
        source.classList.add("dream-xuanniao-spinner-source");
      }
      if (!host.classList.contains("dream-xuanniao-spinner")) {
        host.classList.add("dream-xuanniao-spinner");
      }
      let spinnerMark = host.querySelector?.(":scope > .dream-xuanniao-spinner-mark");
      if (!spinnerMark) {
        spinnerMark = document.createElement("span");
        spinnerMark.className = "dream-xuanniao-spinner-mark";
        spinnerMark.setAttribute("aria-hidden", "true");
        host.appendChild?.(spinnerMark);
      }
      const spinnerSignature = `${XUAN_ICON_VERSION}:bird-spinner`;
      if (spinnerMark.dataset.dreamIcon !== spinnerSignature) {
        spinnerMark.innerHTML = XUAN_ICON_SVGS.bird;
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
    if (state?.artUrl) URL.revokeObjectURL(state.artUrl);
    delete window[STATE_KEY];
    return true;
  };

  const scheduler = { timeout: null };
  const scheduleEnsure = () => {
    if (scheduler.timeout) return;
    scheduler.timeout = setTimeout(() => {
      scheduler.timeout = null;
      ensure();
    }, 48);
  };
  observer = new MutationObserver((records = []) => {
    if (samplingNativeShell) return;
    const relevant = records.some((record) => {
      const target = record.target;
      const elements = [...record.addedNodes, ...record.removedNodes].filter((node) => node?.nodeType === 1);
      const inSidebar = Boolean(target.closest?.("aside.app-shell-left-panel"));
      const inComposer = Boolean(target.closest?.(".composer-surface-chrome"));
      const mainRootChanged = Boolean(target.matches?.("main.main-surface, [role='main']")) && elements.length > 0;
      const sidebarChanged = (inSidebar && elements.length > 0) ||
        elements.some((node) => node.matches?.("aside.app-shell-left-panel"));
      const composerChanged = inComposer && elements.length > 0;
      const spinnerChanged = Boolean(target.closest?.(SPINNER_SELECTOR)) ||
        elements.some((node) => node.matches?.(`${SPINNER_SELECTOR}, [role='progressbar']`));
      if (sidebarChanged) sidebarDirty = true;
      if (spinnerChanged) spinnerDirty = true;
      return sidebarChanged || composerChanged || mainRootChanged || spinnerChanged ||
        target === document.body || target === document.documentElement ||
        elements.some((node) => node.matches?.("main.main-surface, [role='main'], [class*='_homeUtilityBar_']"));
    });
    if (relevant) scheduleEnsure();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  const timer = setInterval(() => { spinnerDirty = true; ensure(); }, 10000);
  window[STATE_KEY] = {
    ensure, cleanup, observer, timer, scheduler, artUrl, profile, config, installToken, version: "1.3.1",
  };
  ensure();
  analyzeArt().then((result) => {
    const state = window[STATE_KEY];
    if (state?.installToken !== installToken || window.__CODEX_DREAM_SKIN_DISABLED__) return;
    profile = result;
    state.profile = result;
    ensure();
  });
  return { installed: true, version: "1.3.1", adaptive: true };
})(__DREAM_CSS_JSON__, __DREAM_ART_JSON__, __DREAM_THEME_JSON__)
