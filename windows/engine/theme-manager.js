(() => {
  const KEY = "__CODEX_DREAM_THEME_MANAGER__";
  const VERSION = "1.4.0";
  const BINDING = "__codexDreamThemeControl";
  const RESPONSE = "__codexDreamThemeResponse";
  const STYLE_ID = "codex-dream-theme-manager-style";
  const PANEL_ID = "codex-dream-theme-manager-panel";
  const NAV_SLUG = "dream-theme-manager";
  const prior = window[KEY];
  if (prior?.version === VERSION && prior?.ensure) { prior.ensure(); return true; }
  prior?.cleanup?.();

  const bird = `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M11.7 10.8C8.5 9.8 5.1 6.6 2.3 1.8c.1 4.8 2.4 8.8 7.2 11.2" fill="#55c6eb" stroke="#d9b85f" stroke-width=".9"/><path d="M12.1 9.9c1.2-4 3.6-7 7.1-8.7.1 4.3-1.6 7.8-5.2 10.4" fill="#276ba9" stroke="#d9b85f" stroke-width=".9"/><path d="M9.2 12.3c2.1-2.4 4.5-3.3 7.1-2.6l2.7-1.2 2.7 1.1-2.9 1.1c-1.2 2.7-3.8 4-7.5 3.7-1.6-.1-2.3-1.1-2.1-2.1Z" fill="#f5fdff" stroke="#2c78ae" stroke-width=".85"/><circle cx="18.2" cy="9.7" r=".55" fill="#143d72"/><path d="M11.8 14.1C9.6 16 7.6 18.8 5.9 22.4M13.1 14.2c1.6 2.8 4 5.2 7.1 7.2" fill="none" stroke="#d9b85f" stroke-width="1.05" stroke-linecap="round"/></svg>`;
  const palette = `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5A9.5 9.5 0 0 0 2.5 12c0 5.2 4.1 9.5 9.2 9.5 1.7 0 2.6-1 2.6-2.1 0-.8-.4-1.3-.4-2 0-1.1.9-2 2-2h1.5c2.5 0 4.1-1.8 4.1-4.1C21.5 6.4 17.2 2.5 12 2.5Z" fill="#143552" stroke="#d9b85f"/><circle cx="8" cy="8" r="1.4" fill="#6edaf2"/><circle cx="12.6" cy="6.5" r="1.4" fill="#f5fdff"/><circle cx="16.7" cy="9.1" r="1.4" fill="#5e86d8"/><circle cx="7" cy="13" r="1.4" fill="#d9b85f"/></svg>`;
  const css = `
    #${PANEL_ID}{position:fixed;z-index:29;overflow:auto;background:var(--main-surface-primary,#0d151f);color:var(--text-primary,#edf7fb);padding:28px 34px 48px;box-sizing:border-box;font-family:inherit}
    #${PANEL_ID} *{box-sizing:border-box} #${PANEL_ID} .dtm-wrap{max-width:1040px;margin:0 auto}
    #${PANEL_ID} .dtm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:24px}
    #${PANEL_ID} h1{font-size:26px;line-height:1.2;margin:0 0 8px;font-weight:650} #${PANEL_ID} h2{font-size:17px;margin:0 0 12px}
    #${PANEL_ID} p{margin:0;color:var(--text-secondary,#9bb0bc);font-size:13px;line-height:1.55}
    #${PANEL_ID} .dtm-status{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 35%,transparent);border-radius:999px;background:color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 9%,transparent);font-size:12px;white-space:nowrap}
    #${PANEL_ID} .dtm-dot{width:7px;height:7px;border-radius:50%;background:var(--dream-manager-accent,#6edaf2);box-shadow:0 0 10px var(--dream-manager-accent,#6edaf2)}
    #${PANEL_ID} .dtm-section{margin-top:24px;padding-top:20px;border-top:1px solid var(--border-light,#263642)}
    #${PANEL_ID} .dtm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:14px}
    #${PANEL_ID} .dtm-card{overflow:hidden;border:1px solid var(--border-light,#263642);border-radius:14px;background:color-mix(in srgb,var(--main-surface-secondary,#13212c) 90%,transparent)}
    #${PANEL_ID} .dtm-preview{height:122px;background:linear-gradient(135deg,#10263d,#173957 55%,#0c1828);position:relative;overflow:hidden}
    #${PANEL_ID} .dtm-preview img{width:100%;height:100%;display:block;object-fit:cover} #${PANEL_ID} .dtm-preview>svg{position:absolute;width:54px;height:54px;left:50%;top:50%;transform:translate(-50%,-50%)}
    #${PANEL_ID} .dtm-card-body{padding:13px} #${PANEL_ID} .dtm-title{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:14px;font-weight:600;margin-bottom:10px}
    #${PANEL_ID} .dtm-chip{font-size:10px;font-weight:500;color:#8ee8f8;border:1px solid #397a8d;border-radius:999px;padding:2px 7px}
    #${PANEL_ID} button{font:inherit;cursor:pointer} #${PANEL_ID} .dtm-button{border:1px solid var(--border-heavy,#38505f);border-radius:9px;padding:7px 12px;color:inherit;background:var(--main-surface-secondary,#14232e);font-size:12px}
    #${PANEL_ID} .dtm-button:hover{border-color:var(--dream-manager-accent,#6edaf2);background:color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 12%,var(--main-surface-secondary,#14232e))}
    #${PANEL_ID} .dtm-button-primary{background:#397e91;border-color:#5ac7e1;color:#f5fdff} #${PANEL_ID} .dtm-button-danger{border-color:#95534e;color:#ffc0b8}
    #${PANEL_ID} .dtm-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap} #${PANEL_ID} .dtm-row .dtm-grow{flex:1;min-width:220px}
    #${PANEL_ID} input{width:100%;height:36px;border:1px solid var(--border-heavy,#38505f);border-radius:9px;background:var(--input-bg,#101b24);color:inherit;padding:0 11px;outline:none;font:inherit;font-size:12px}
    #${PANEL_ID} input:focus{border-color:var(--dream-manager-accent,#6edaf2);box-shadow:0 0 0 2px color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 18%,transparent)}
    #${PANEL_ID} .dtm-source{display:grid;grid-template-columns:minmax(120px,180px) minmax(220px,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--border-light,#263642) 65%,transparent);font-size:12px}
    #${PANEL_ID} .dtm-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary,#9bb0bc)}
    #${PANEL_ID} .dtm-empty{padding:20px;border:1px dashed var(--border-heavy,#38505f);border-radius:12px;color:var(--text-secondary,#9bb0bc);font-size:12px;text-align:center}
    #${PANEL_ID} .dtm-message{position:sticky;bottom:12px;margin:20px auto 0;width:max-content;max-width:90%;padding:8px 13px;border-radius:9px;background:#142c3b;border:1px solid #4daac1;box-shadow:0 8px 24px #0008;font-size:12px}
    @media(max-width:780px){#${PANEL_ID}{padding:20px}#${PANEL_ID} .dtm-head{display:block}#${PANEL_ID} .dtm-status{margin-top:12px;width:max-content}#${PANEL_ID} .dtm-source{grid-template-columns:1fr} }
  `;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const safePreview = (value) => typeof value === "string" && (/^data:image\/(?:png|jpeg|webp);base64,/i.test(value) || /^https:\/\//i.test(value)) ? value : "";
  const pending = new Map();
  let sequence = 0;
  let state = null;
  let catalog = null;
  let message = "";
  let showing = false;

  const call = (command, payload = {}) => new Promise((resolve, reject) => {
    const requestId = `theme-${Date.now()}-${++sequence}`;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error("主题服务响应超时")); }, 15000);
    pending.set(requestId, { resolve, reject, timer });
    try {
      if (typeof window[BINDING] !== "function") throw new Error("主题服务尚未连接，请稍后重试");
      window[BINDING](JSON.stringify({ requestId, command, payload }));
    } catch (error) {
      clearTimeout(timer); pending.delete(requestId); reject(error);
    }
  });
  const onResponse = (event) => {
    try {
      const response = JSON.parse(event.detail);
      const item = pending.get(response.requestId);
      if (!item) return;
      clearTimeout(item.timer); pending.delete(response.requestId);
      if (response.ok) item.resolve(response.result); else item.reject(new Error(response.error || "主题操作失败"));
    } catch {}
  };
  window.addEventListener(RESPONSE, onResponse);

  const getStyle = () => {
    let style = document.getElementById(STYLE_ID);
    if (!style) { style = document.createElement("style"); style.id = STYLE_ID; style.textContent = css; document.head?.appendChild(style); }
    return style;
  };
  const navIcon = `<span class="flex w-4 shrink-0 items-center justify-center" data-dream-theme-icon style="width:16px;height:16px">${palette}</span>`;
  const setSelected = (button) => {
    document.querySelectorAll('button[data-settings-panel-slug]').forEach((candidate) => {
      candidate.removeAttribute("aria-current");
      candidate.classList.remove("bg-token-list-hover-background");
      candidate.querySelector("[class*='text-token-list-active-selection']")?.classList.remove("text-token-list-active-selection-foreground");
    });
    button.setAttribute("aria-current", "page");
    button.classList.add("bg-token-list-hover-background");
  };
  const positionPanel = (panel, nav) => {
    const aside = nav.closest("aside");
    const bounds = aside?.getBoundingClientRect();
    panel.style.left = `${Math.max(0, Math.round(bounds?.right ?? 270))}px`;
    panel.style.top = `${Math.max(36, Math.round(bounds?.top ?? 36))}px`;
    panel.style.right = "0"; panel.style.bottom = "0";
  };
  const cardHtml = (theme) => {
    const preview = safePreview(theme.preview);
    const active = state && !state.paused && state.active?.id === theme.id;
    const meta = [theme.author, theme.version].filter(Boolean).map(escapeHtml).join(" · ");
    return `<article class="dtm-card"><div class="dtm-preview">${preview ? `<img src="${escapeHtml(preview)}" alt="">` : bird}</div><div class="dtm-card-body"><div class="dtm-title"><span>${escapeHtml(theme.name)}</span>${active ? '<span class="dtm-chip">使用中</span>' : ""}</div>${meta ? `<p style="margin:-4px 0 9px">${meta}</p>` : ""}<button class="dtm-button ${active ? "" : "dtm-button-primary"}" data-theme-use="${escapeHtml(theme.key)}" ${active ? "disabled" : ""}>${active ? "当前主题" : "启用主题"}</button></div></article>`;
  };
  const bundledCardHtml = (theme) => {
    const preview = safePreview(theme.preview);
    const installed = Boolean(state?.themes?.some((item) => item.id === theme.id));
    const meta = [theme.author, theme.version].filter(Boolean).map(escapeHtml).join(" · ");
    return `<article class="dtm-card"><div class="dtm-preview">${preview ? `<img src="${escapeHtml(preview)}" alt="">` : bird}</div><div class="dtm-card-body"><div class="dtm-title"><span>${escapeHtml(theme.name)}</span><span class="dtm-chip">内置主题</span></div>${meta ? `<p style="margin:-4px 0 9px">${meta}</p>` : ""}<button class="dtm-button ${installed ? "" : "dtm-button-primary"}" data-bundled-install="${escapeHtml(theme.key)}" ${installed ? "disabled" : ""}>${installed ? "已安装" : "安装主题"}</button></div></article>`;
  };
  const petHtml = (pet) => {
    const active = state?.selectedPet === pet.id;
    const selectable = Boolean(state?.canEnableActive);
    const chips = [`<span class="dtm-chip">宠物 v${escapeHtml(pet.spriteVersionNumber)}</span>`];
    if (pet.selectedInCodex) chips.push('<span class="dtm-chip">Codex 当前使用</span>');
    return `<article class="dtm-card"><div class="dtm-preview">${bird}</div><div class="dtm-card-body"><div class="dtm-title"><span>${escapeHtml(pet.displayName)}</span><span class="dtm-row">${chips.join("")}</span></div>${pet.description ? `<p style="margin:-4px 0 10px">${escapeHtml(pet.description)}</p>` : ""}<button class="dtm-button ${active ? "" : "dtm-button-primary"}" data-pet-select="${escapeHtml(pet.id)}" ${active || !selectable ? "disabled" : ""}>${active ? "已选择并随主题保存" : (selectable ? "选择此宠物" : "请先安装并启用主题")}</button></div></article>`;
  };
  const catalogHtml = () => {
    if (!catalog) return "";
    const cards = catalog.themes.map((theme) => {
      const preview = safePreview(theme.preview);
      return `<article class="dtm-card"><div class="dtm-preview">${preview ? `<img src="${escapeHtml(preview)}" alt="">` : bird}</div><div class="dtm-card-body"><div class="dtm-title"><span>${escapeHtml(theme.name)}</span><span class="dtm-chip">库</span></div><button class="dtm-button dtm-button-primary" data-library-install="${escapeHtml(theme.key)}" data-source-id="${escapeHtml(catalog.source.id)}">安装</button></div></article>`;
    }).join("");
    return `<div class="dtm-section"><h2>${escapeHtml(catalog.source.label)} · 可安装主题</h2>${cards ? `<div class="dtm-grid">${cards}</div>` : '<div class="dtm-empty">这个主题库中没有找到有效主题。</div>'}</div>`;
  };
  const render = () => {
    const panel = document.getElementById(PANEL_ID);
    if (!panel || !state) return;
    const themes = state.themes.map(cardHtml).join("");
    const bundledThemes = (state.bundledThemes || []).map(bundledCardHtml).join("");
    const pets = (state.pets || []).map(petHtml).join("");
    const libraries = state.libraries.map((source) => `<div class="dtm-source"><strong>${escapeHtml(source.label)}${source.type === "repository" ? ' <span class="dtm-chip">GitHub</span>' : ""}</strong><span class="dtm-path" title="${escapeHtml(source.location)}">${escapeHtml(source.location)}</span><span class="dtm-row"><button class="dtm-button" data-library-open="${escapeHtml(source.id)}">读取</button><button class="dtm-button dtm-button-danger" data-library-remove="${escapeHtml(source.id)}">移除</button></span></div>`).join("");
    panel.innerHTML = `<div class="dtm-wrap"><div class="dtm-head"><div><h1>主题</h1><p>主题管理工具独立安装；主题、图片和可选宠物都在本页安装与启用。</p></div><div class="dtm-status"><span class="dtm-dot"></span>${state.paused ? "官方外观" : `当前：${escapeHtml(state.active?.name || "主题")}`} · ${state.hotReload ? "热重载已开启" : "自动刷新"}</div></div><div class="dtm-row"><button class="dtm-button ${state.paused ? "dtm-button-primary" : "dtm-button-danger"}" data-official ${state.paused && !state.canEnableActive ? "disabled" : ""}>${state.paused ? (state.canEnableActive ? "启用当前主题" : "请先安装主题") : "还原官方外观"}</button><button class="dtm-button" data-refresh>立即刷新</button><p>新安装的管理工具默认保持官方外观；还原不会删除已安装主题、宠物或主题库配置。</p></div><section class="dtm-section"><h2>可安装主题</h2>${bundledThemes ? `<div class="dtm-grid">${bundledThemes}</div>` : '<div class="dtm-empty">安装包中没有内置主题，可从下方仓库或主题库安装。</div>'}</section><section class="dtm-section"><h2>已安装主题</h2>${themes ? `<div class="dtm-grid">${themes}</div>` : '<div class="dtm-empty">暂无已安装主题。请先在“可安装主题”或主题库中点击安装。</div>'}</section><section class="dtm-section"><h2>主题宠物</h2><p style="margin-bottom:12px">选择后会把标准 v2 宠物的 <code>pet.json</code> 与 <code>spritesheet.webp</code> 复制进当前主题。通过本地主题库或 GitHub 换机安装并启用时，会自动安装并选中同一只宠物。</p>${pets ? `<div class="dtm-grid">${pets}</div><div class="dtm-row" style="margin-top:12px"><button class="dtm-button ${state.selectedPet ? "dtm-button-danger" : ""}" data-pet-clear ${state.selectedPet ? "" : "disabled"}>从主题移除宠物</button></div>` : '<div class="dtm-empty">没有发现有效的 Codex v2 宠物包。</div>'}</section><section class="dtm-section"><h2>从 GitHub 仓库安装</h2><p style="margin-bottom:12px">公开仓库根目录放置 <code>theme-library.json</code> 后，可直接添加仓库并读取主题；无需手填 Raw 地址。</p><div class="dtm-row"><div class="dtm-grow"><input data-repository-location placeholder="https://github.com/owner/repository"></div><div style="min-width:150px"><input data-repository-label placeholder="名称（可选）"></div><button class="dtm-button dtm-button-primary" data-repository-add>添加仓库</button></div></section><section class="dtm-section"><h2>主题库</h2><p style="margin-bottom:12px">也支持本地主题包目录，或 HTTPS 远程索引。主题包包含可执行渲染脚本，只添加你信任的来源。远程索引格式为 <code>{ "themes": [{ "id", "name", "themeUrl" }] }</code>。</p><div class="dtm-row"><div class="dtm-grow"><input data-library-location placeholder="本地主题包目录或 https://…/index.json"></div><div style="min-width:150px"><input data-library-label placeholder="名称（可选）"></div><button class="dtm-button dtm-button-primary" data-library-add>添加主题库</button></div><div style="margin-top:12px">${libraries || '<div class="dtm-empty">尚未配置主题库。</div>'}</div></section>${catalogHtml()}${message ? `<div class="dtm-message">${escapeHtml(message)}</div>` : ""}</div>`;
  };
  const refreshState = async () => { state = await call("getState"); render(); };
  const act = async (operation, success) => {
    message = "处理中…"; render();
    try { state = await operation(); message = success; render(); }
    catch (error) { message = error.message || String(error); render(); }
  };
  const onPanelClick = (event) => {
    const target = event.target.closest("button"); if (!target) return;
    if (target.hasAttribute("data-official")) act(() => call("setPaused", { paused: !state.paused }), state.paused ? "主题已重新启用" : "已恢复 Codex 官方外观");
    else if (target.hasAttribute("data-refresh")) act(() => call("getState"), "主题状态已刷新");
    else if (target.dataset.themeUse) act(() => call("useTheme", { key: target.dataset.themeUse }), "主题已启用");
    else if (target.dataset.bundledInstall) act(() => call("installBundledTheme", { key: target.dataset.bundledInstall }), "主题安装完成，可在“已安装主题”中启用");
    else if (target.dataset.petSelect) act(() => call("selectPet", { petId: target.dataset.petSelect }), "宠物已复制进主题并设为 Codex 当前宠物");
    else if (target.hasAttribute("data-pet-clear")) act(() => call("selectPet", { petId: "" }), "主题内的宠物副本已移除");
    else if (target.hasAttribute("data-repository-add")) {
      const panel = document.getElementById(PANEL_ID); const location = panel.querySelector("[data-repository-location]")?.value || ""; const label = panel.querySelector("[data-repository-label]")?.value || "";
      act(() => call("addRepository", { location, label }), "GitHub 主题仓库已添加");
    }
    else if (target.hasAttribute("data-library-add")) {
      const panel = document.getElementById(PANEL_ID); const location = panel.querySelector("[data-library-location]")?.value || ""; const label = panel.querySelector("[data-library-label]")?.value || "";
      act(() => call("addLibrary", { location, label }), "主题库已添加");
    } else if (target.dataset.libraryRemove) { catalog = null; act(() => call("removeLibrary", { id: target.dataset.libraryRemove }), "主题库已移除"); }
    else if (target.dataset.libraryOpen) act(async () => { catalog = await call("getCatalog", { id: target.dataset.libraryOpen }); return call("getState"); }, "主题库读取完成");
    else if (target.dataset.libraryInstall) act(() => call("installLibraryTheme", { sourceId: target.dataset.sourceId, key: target.dataset.libraryInstall }), "主题安装完成");
  };
  const show = async (button, nav) => {
    showing = true; message = ""; catalog = null; getStyle(); setSelected(button);
    let panel = document.getElementById(PANEL_ID);
    if (!panel) { panel = document.createElement("section"); panel.id = PANEL_ID; panel.setAttribute("aria-label", "主题"); panel.addEventListener("click", onPanelClick); document.body.appendChild(panel); }
    positionPanel(panel, nav); panel.hidden = false; panel.innerHTML = '<div class="dtm-wrap"><div class="dtm-empty">正在读取主题…</div></div>';
    try { await refreshState(); } catch (error) { panel.innerHTML = `<div class="dtm-wrap"><h1>主题</h1><div class="dtm-empty">${escapeHtml(error.message || error)}</div></div>`; }
  };
  const hide = () => { showing = false; const panel = document.getElementById(PANEL_ID); if (panel) panel.hidden = true; };
  const ensure = () => {
    const nav = document.querySelector('nav[aria-label="设置"],nav[aria-label="Settings"]');
    if (!nav) { hide(); return false; }
    let button = nav.querySelector(`button[data-settings-panel-slug="${NAV_SLUG}"]`);
    if (!button) {
      const appearance = nav.querySelector('button[data-settings-panel-slug="appearance"],button[aria-label="外观"],button[aria-label="Appearance"]');
      if (!appearance) return false;
      button = appearance.cloneNode(true);
      button.removeAttribute("aria-current"); button.dataset.settingsPanelSlug = NAV_SLUG; button.setAttribute("aria-label", "主题");
      const content = button.firstElementChild || button;
      content.innerHTML = `${navIcon}<span>主题</span>`;
      button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); show(button, nav); });
      appearance.insertAdjacentElement("afterend", button);
    }
    if (showing) { const panel = document.getElementById(PANEL_ID); if (panel) positionPanel(panel, nav); }
    return true;
  };
  const onDocumentClick = (event) => {
    const settingsButton = event.target.closest?.('button[data-settings-panel-slug]');
    if (settingsButton && settingsButton.dataset.settingsPanelSlug !== NAV_SLUG) hide();
  };
  document.addEventListener("click", onDocumentClick, true);
  let scheduled = null;
  const observer = new MutationObserver((records) => {
    if (records.some((record) => [...record.addedNodes].some((node) => node.nodeType === 1 && (node.matches?.('nav[aria-label="设置"],nav[aria-label="Settings"]') || node.querySelector?.('nav[aria-label="设置"],nav[aria-label="Settings"]'))))) {
      clearTimeout(scheduled); scheduled = setTimeout(ensure, 120);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const timer = setInterval(ensure, 4000);
  const cleanup = () => { observer.disconnect(); clearInterval(timer); clearTimeout(scheduled); window.removeEventListener(RESPONSE, onResponse); document.removeEventListener("click", onDocumentClick, true); document.getElementById(PANEL_ID)?.remove(); document.getElementById(STYLE_ID)?.remove(); delete window[KEY]; };
  window[KEY] = { ensure, cleanup, observer, timer, version: VERSION };
  ensure();
  return true;
})()
