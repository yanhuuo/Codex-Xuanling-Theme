"use strict";
(() => {
    const KEY = "__CODEX_DREAM_THEME_MANAGER__";
    const VERSION = "1.7.0";
    const BINDING = "__codexDreamThemeControl";
    const RESPONSE = "__codexDreamThemeResponse";
    const STYLE_ID = "codex-dream-theme-manager-style";
    const PANEL_ID = "codex-dream-theme-manager-panel";
    const NAV_SLUG = "dream-theme-manager";
    const prior = window[KEY];
    if (prior?.version === VERSION && prior?.ensure) {
        prior.ensure();
        return true;
    }
    prior?.cleanup?.();
    const bird = `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M11.7 10.8C8.5 9.8 5.1 6.6 2.3 1.8c.1 4.8 2.4 8.8 7.2 11.2" fill="#55c6eb" stroke="#d9b85f" stroke-width=".9"/><path d="M12.1 9.9c1.2-4 3.6-7 7.1-8.7.1 4.3-1.6 7.8-5.2 10.4" fill="#276ba9" stroke="#d9b85f" stroke-width=".9"/><path d="M9.2 12.3c2.1-2.4 4.5-3.3 7.1-2.6l2.7-1.2 2.7 1.1-2.9 1.1c-1.2 2.7-3.8 4-7.5 3.7-1.6-.1-2.3-1.1-2.1-2.1Z" fill="#f5fdff" stroke="#2c78ae" stroke-width=".85"/><circle cx="18.2" cy="9.7" r=".55" fill="#143d72"/><path d="M11.8 14.1C9.6 16 7.6 18.8 5.9 22.4M13.1 14.2c1.6 2.8 4 5.2 7.1 7.2" fill="none" stroke="#d9b85f" stroke-width="1.05" stroke-linecap="round"/></svg>`;
    const palette = `<svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.5A9.5 9.5 0 0 0 2.5 12c0 5.2 4.1 9.5 9.2 9.5 1.7 0 2.6-1 2.6-2.1 0-.8-.4-1.3-.4-2 0-1.1.9-2 2-2h1.5c2.5 0 4.1-1.8 4.1-4.1C21.5 6.4 17.2 2.5 12 2.5Z" fill="#143552" stroke="#d9b85f"/><circle cx="8" cy="8" r="1.4" fill="#6edaf2"/><circle cx="12.6" cy="6.5" r="1.4" fill="#f5fdff"/><circle cx="16.7" cy="9.1" r="1.4" fill="#5e86d8"/><circle cx="7" cy="13" r="1.4" fill="#d9b85f"/></svg>`;
    const css = `
    #${PANEL_ID}{--dream-manager-accent:var(--dream-accent,#6edaf2);--dtm-surface:var(--dream-surface,var(--main-surface-primary,#0d151f));--dtm-raised:var(--dream-surface-raised,var(--main-surface-secondary,#13212c));--dtm-text:var(--dream-text,var(--text-primary,#edf7fb));--dtm-muted:var(--dream-text-muted,var(--text-secondary,#9bb0bc));--dtm-line:var(--dream-line,var(--border-light,#263642));position:fixed;z-index:29;overflow:auto;background:color-mix(in oklab,var(--dtm-surface) 94%,transparent);color:var(--dtm-text);padding:28px 34px 48px;box-sizing:border-box;font-family:inherit;backdrop-filter:blur(18px)}
    #${PANEL_ID} *{box-sizing:border-box} #${PANEL_ID} .dtm-wrap{max-width:1040px;margin:0 auto}
    #${PANEL_ID} .dtm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:24px}
    #${PANEL_ID} h1{font-size:26px;line-height:1.2;margin:0 0 8px;font-weight:650} #${PANEL_ID} h2{font-size:17px;margin:0 0 12px}
    #${PANEL_ID} p{margin:0;color:var(--dtm-muted);font-size:13px;line-height:1.55}
    #${PANEL_ID} .dtm-status{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 35%,transparent);border-radius:999px;background:color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 9%,transparent);font-size:12px;white-space:nowrap}
    #${PANEL_ID} .dtm-dot{width:7px;height:7px;border-radius:50%;background:var(--dream-manager-accent,#6edaf2);box-shadow:0 0 10px var(--dream-manager-accent,#6edaf2)}
    #${PANEL_ID} .dtm-tabs{display:inline-flex;gap:4px;margin:14px 0 2px;padding:4px;border:1px solid var(--dtm-line);border-radius:12px;background:color-mix(in srgb,var(--dtm-raised) 75%,transparent)}
    #${PANEL_ID} .dtm-tab{border:0;border-radius:8px;padding:7px 14px;background:transparent;color:var(--dtm-muted);font-size:13px}
    #${PANEL_ID} .dtm-tab[aria-selected="true"]{background:color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 18%,transparent);color:var(--dtm-text);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 34%,transparent)}
    #${PANEL_ID} .dtm-section{margin-top:24px;padding-top:20px;border-top:1px solid var(--dtm-line)}
    #${PANEL_ID} .dtm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:14px}
    #${PANEL_ID} .dtm-card{overflow:hidden;border:1px solid var(--dtm-line);border-radius:14px;background:color-mix(in srgb,var(--dtm-raised) 90%,transparent)}
    #${PANEL_ID} .dtm-create-card{width:100%;padding:0;color:inherit;text-align:left;transition:border-color .16s ease,transform .16s ease}
    #${PANEL_ID} .dtm-create-card:hover{border-color:var(--dream-manager-accent,#6edaf2);transform:translateY(-1px)}
    #${PANEL_ID} .dtm-create-card .dtm-preview{background:linear-gradient(135deg,#10263d,#1b5264 58%,#13202d)}
    #${PANEL_ID} .dtm-preview{height:122px;background:linear-gradient(135deg,#10263d,#173957 55%,#0c1828);position:relative;overflow:hidden}
    #${PANEL_ID} .dtm-preview img{width:100%;height:100%;display:block;object-fit:cover} #${PANEL_ID} .dtm-preview>svg{position:absolute;width:54px;height:54px;left:50%;top:50%;transform:translate(-50%,-50%)}
    #${PANEL_ID} .dtm-card-body{padding:13px} #${PANEL_ID} .dtm-card-line{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    #${PANEL_ID} .dtm-card-main{min-width:0;flex:1} #${PANEL_ID} .dtm-title{font-size:14px;font-weight:600;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #${PANEL_ID} .dtm-chip{font-size:10px;font-weight:500;color:#8ee8f8;border:1px solid #397a8d;border-radius:999px;padding:2px 7px}
    #${PANEL_ID} button{font:inherit;cursor:pointer} #${PANEL_ID} .dtm-button{border:1px solid var(--dtm-line);border-radius:9px;padding:7px 12px;color:inherit;background:var(--dtm-raised);font-size:12px;white-space:nowrap}
    #${PANEL_ID} .dtm-button:hover{border-color:var(--dream-manager-accent,#6edaf2);background:color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 12%,var(--dtm-raised))}
    #${PANEL_ID} .dtm-button-primary{background:#397e91;border-color:#5ac7e1;color:#f5fdff} #${PANEL_ID} .dtm-button-danger{border-color:#95534e;color:#ffc0b8}
    #${PANEL_ID} .dtm-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap} #${PANEL_ID} .dtm-row .dtm-grow{flex:1;min-width:220px}
    #${PANEL_ID} input,#${PANEL_ID} select{width:100%;height:36px;border:1px solid var(--dtm-line);border-radius:9px;background:color-mix(in oklab,var(--dtm-raised) 94%,transparent);color:inherit;padding:0 11px;outline:none;font:inherit;font-size:12px}
    #${PANEL_ID} input:focus,#${PANEL_ID} select:focus{border-color:var(--dream-manager-accent,#6edaf2);box-shadow:0 0 0 2px color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 18%,transparent)}
    #${PANEL_ID} .dtm-local-form{display:grid;gap:16px}
    #${PANEL_ID} .dtm-form-section{display:grid;gap:12px;padding:16px;border:1px solid var(--dtm-line);border-radius:13px;background:color-mix(in oklab,var(--dtm-raised) 64%,transparent)}
    #${PANEL_ID} .dtm-form-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
    #${PANEL_ID} .dtm-form-section-head h3{margin:0 0 4px;font-size:14px}
    #${PANEL_ID} .dtm-form-section-head p{font-size:12px}
    #${PANEL_ID} .dtm-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    #${PANEL_ID} .dtm-form-grid .dtm-wide{grid-column:1/-1}
    #${PANEL_ID} .dtm-modal-layer{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px}
    #${PANEL_ID} .dtm-modal-backdrop{position:absolute;inset:0;border:0;background:#02070db8;padding:0}
    #${PANEL_ID} .dtm-dialog{position:relative;display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(980px,calc(100vw - 40px));max-height:calc(100vh - 40px);overflow:hidden;border:1px solid var(--dtm-line);border-radius:18px;background:var(--dtm-surface);box-shadow:0 24px 80px #000b}
    #${PANEL_ID} .dtm-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:22px 24px 16px;border-bottom:1px solid var(--dtm-line)}
    #${PANEL_ID} .dtm-dialog-head h2{margin:0 0 6px}
    #${PANEL_ID} .dtm-dialog-close{width:32px;height:32px;padding:0;font-size:19px;line-height:1}
    #${PANEL_ID} .dtm-dialog-body{min-height:0;overflow:auto;padding:18px 24px}
    #${PANEL_ID} .dtm-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 24px;border-top:1px solid var(--dtm-line);background:color-mix(in oklab,var(--dtm-surface) 92%,var(--dtm-raised))}
    #${PANEL_ID} .dtm-form-error{padding:9px 12px;border:1px solid #a95b55;border-radius:10px;background:#5c252859;color:#ffc7c2;font-size:12px}
    #${PANEL_ID} .dtm-field{display:grid;gap:7px}
    #${PANEL_ID} .dtm-field>span{font-size:12px;font-weight:600;color:var(--dtm-muted)}
    #${PANEL_ID} .dtm-file-box{display:flex;align-items:center;gap:10px;min-height:44px;padding:7px;border:1px solid var(--dtm-line);border-radius:10px;background:color-mix(in oklab,var(--dtm-raised) 94%,transparent)}
    #${PANEL_ID} .dtm-file-box .dtm-button{flex:none}
    #${PANEL_ID} .dtm-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dtm-muted);font-size:12px}
    #${PANEL_ID} .dtm-icon-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    #${PANEL_ID} .dtm-icon-field{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:60px;padding:9px 10px;border:1px solid var(--dtm-line);border-radius:11px;background:color-mix(in oklab,var(--dtm-surface) 55%,transparent)}
    #${PANEL_ID} .dtm-icon-field[data-overridden="true"]{border-color:color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 58%,var(--dtm-line));background:color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 7%,var(--dtm-surface))}
    #${PANEL_ID} .dtm-icon-preview{display:grid;place-items:center;width:38px;height:38px;overflow:hidden;border:1px solid var(--dtm-line);border-radius:9px;background:color-mix(in oklab,var(--dtm-raised) 90%,transparent);color:var(--dtm-text)}
    #${PANEL_ID} .dtm-icon-preview svg{display:block;width:22px;height:22px}
    #${PANEL_ID} .dtm-icon-preview-placeholder{font-size:12px;font-weight:700;color:var(--dtm-muted)}
    #${PANEL_ID} .dtm-icon-meta{min-width:0}
    #${PANEL_ID} .dtm-icon-label{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #${PANEL_ID} .dtm-icon-key,#${PANEL_ID} .dtm-icon-file{font-size:10px;color:var(--dtm-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #${PANEL_ID} .dtm-icon-controls{display:flex;align-items:center;gap:6px}
    #${PANEL_ID} .dtm-icon-controls .dtm-button{padding:6px 9px}
    #${PANEL_ID} .dtm-icon-remove{width:28px;height:28px;padding:0;border:1px solid var(--dtm-line);border-radius:8px;background:transparent;color:var(--dtm-muted);line-height:1}
    #${PANEL_ID} input[type="file"][hidden]{display:none}
    #${PANEL_ID} .dtm-source{display:grid;grid-template-columns:minmax(120px,180px) minmax(220px,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--border-light,#263642) 65%,transparent);font-size:12px}
    #${PANEL_ID} .dtm-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary,#9bb0bc)}
    #${PANEL_ID} .dtm-empty{padding:20px;border:1px dashed var(--border-heavy,#38505f);border-radius:12px;color:var(--text-secondary,#9bb0bc);font-size:12px;text-align:center}
    #${PANEL_ID} .dtm-message{position:sticky;bottom:12px;margin:20px auto 0;width:max-content;max-width:90%;padding:8px 13px;border-radius:9px;background:#142c3b;border:1px solid #4daac1;box-shadow:0 8px 24px #0008;font-size:12px}
    @media(max-width:780px){#${PANEL_ID}{padding:20px}#${PANEL_ID} .dtm-head{display:block}#${PANEL_ID} .dtm-status{margin-top:12px;width:max-content}#${PANEL_ID} .dtm-source,#${PANEL_ID} .dtm-form-grid,#${PANEL_ID} .dtm-icon-form{grid-template-columns:1fr}#${PANEL_ID} .dtm-form-grid .dtm-wide{grid-column:auto}#${PANEL_ID} .dtm-modal-layer{padding:10px}#${PANEL_ID} .dtm-dialog{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}#${PANEL_ID} .dtm-dialog-head,#${PANEL_ID} .dtm-dialog-body,#${PANEL_ID} .dtm-dialog-actions{padding-left:16px;padding-right:16px} }
  `;
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const safePreview = (value) => typeof value === "string" && (/^data:image\/(?:png|jpeg|webp);base64,/i.test(value) || /^https:\/\//i.test(value)) ? value : "";
    const safeIconSvg = (value) => typeof value === "string" && value.length <= 16384 &&
        /^<svg\b[\s\S]*<\/svg>$/i.test(value.trim()) && !/<script\b|on[a-z]+\s*=|javascript:/i.test(value)
        ? value.trim() : "";
    const pending = new Map();
    let sequence = 0;
    let state = null;
    let catalog = null;
    let message = "";
    let showing = false;
    let activeTab = "themes";
    let localModalOpen = false;
    let localThemeName = "";
    let localBaseKey = "";
    let localDraftError = "";
    let localImageFile = null;
    let localIconsJsonFile = null;
    const localIconFiles = new Map();
    const localIconSvgs = new Map();
    const localJsonIcons = new Map();
    const iconSlots = [
        ["bird", "主题标志（玄翎）"], ["seraph", "主题标志（蕾米埃尔）"], ["chevron", "展开"],
        ["search", "搜索"], ["compose", "新建任务"], ["quick", "快速操作"], ["branch", "分支"],
        ["sites", "网站"], ["clock", "历史"], ["plugins", "插件"], ["folder", "文件夹"],
        ["more", "更多"], ["add", "添加"], ["pin", "固定"], ["archive", "归档"], ["help", "帮助"],
        ["shield", "权限"], ["permissionAsk", "询问权限"], ["permissionAgent", "代理权限"],
        ["permissionFull", "完整权限"], ["mic", "麦克风"], ["send", "发送"],
    ];
    const resetLocalDraft = () => {
        localThemeName = "";
        localBaseKey = "";
        localDraftError = "";
        localImageFile = null;
        localIconsJsonFile = null;
        localIconFiles.clear();
        localIconSvgs.clear();
        localJsonIcons.clear();
    };
    const preserveLocalTextFields = () => {
        const panel = document.getElementById(PANEL_ID);
        localThemeName = panel?.querySelector("[data-local-theme-name]")?.value || localThemeName;
        localBaseKey = panel?.querySelector("[data-local-theme-base]")?.value || localBaseKey;
    };
    const fileToBase64 = async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        return btoa(binary);
    };
    const call = (command, payload = {}) => new Promise((resolve, reject) => {
        const requestId = `theme-${Date.now()}-${++sequence}`;
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error("主题服务响应超时")); }, 15000);
        pending.set(requestId, { resolve, reject, timer });
        try {
            if (typeof window[BINDING] !== "function")
                throw new Error("主题服务尚未连接，请稍后重试");
            window[BINDING](JSON.stringify({ requestId, command, payload }));
        }
        catch (error) {
            clearTimeout(timer);
            pending.delete(requestId);
            reject(error);
        }
    });
    const onResponse = (event) => {
        try {
            const response = JSON.parse(event.detail);
            const item = pending.get(response.requestId);
            if (!item)
                return;
            clearTimeout(item.timer);
            pending.delete(response.requestId);
            if (response.ok)
                item.resolve(response.result);
            else
                item.reject(new Error(response.error || "主题操作失败"));
        }
        catch { }
    };
    window.addEventListener(RESPONSE, onResponse);
    const getStyle = () => {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement("style");
            style.id = STYLE_ID;
            style.textContent = css;
            document.head?.appendChild(style);
        }
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
        panel.style.right = "0";
        panel.style.bottom = "0";
    };
    const cardHtml = (theme) => {
        const preview = safePreview(theme.preview);
        const active = state && !state.paused && state.active?.id === theme.id;
        const meta = [theme.author, theme.version].filter(Boolean).map(escapeHtml).join(" · ");
        return `<article class="dtm-card"><div class="dtm-preview">${preview ? `<img src="${escapeHtml(preview)}" alt="">` : bird}</div><div class="dtm-card-body"><div class="dtm-card-line"><div class="dtm-card-main"><div class="dtm-title">${escapeHtml(theme.name)}</div><div class="dtm-row">${theme.localOnly ? '<span class="dtm-chip">仅本地</span>' : ""}${meta ? `<p>${meta}</p>` : ""}</div></div><button class="dtm-button ${active ? "" : "dtm-button-primary"}" data-theme-use="${escapeHtml(theme.key)}" ${active ? "disabled" : ""}>${active ? "当前主题" : "启用主题"}</button></div></div></article>`;
    };
    const bundledCardHtml = (theme) => {
        const preview = safePreview(theme.preview);
        const installed = Boolean(state?.themes?.some((item) => item.id === theme.id));
        const meta = [theme.author, theme.version].filter(Boolean).map(escapeHtml).join(" · ");
        return `<article class="dtm-card"><div class="dtm-preview">${preview ? `<img src="${escapeHtml(preview)}" alt="">` : bird}</div><div class="dtm-card-body"><div class="dtm-card-line"><div class="dtm-card-main"><div class="dtm-title">${escapeHtml(theme.name)}</div>${meta ? `<p>${meta}</p>` : ""}</div><button class="dtm-button ${installed ? "" : "dtm-button-primary"}" data-bundled-install="${escapeHtml(theme.key)}" ${installed ? "disabled" : ""}>${installed ? "已安装" : "安装主题"}</button></div></div></article>`;
    };
    const localCreatorCardHtml = () => `<button class="dtm-card dtm-create-card" type="button" data-local-theme-open><div class="dtm-preview">${palette}</div><div class="dtm-card-body"><div class="dtm-card-line"><div class="dtm-card-main"><div class="dtm-title">本地自定义主题</div><p>选择背景与图标，另存到本机</p></div><span class="dtm-button dtm-button-primary">设置</span></div></div></button>`;
    const localCreatorDialogHtml = (baseOptions) => {
        if (!localModalOpen)
            return "";
        const baseTheme = state?.bundledThemes?.find((theme) => theme.key === localBaseKey) || state?.bundledThemes?.[0];
        const baseIcons = baseTheme?.icons || {};
        const availableKeys = new Set([
            ...Object.keys(baseIcons),
            ...localJsonIcons.keys(),
            ...localIconFiles.keys(),
        ]);
        const orderedKeys = [
            ...iconSlots.map(([key]) => key).filter((key) => availableKeys.has(key)),
            ...[...availableKeys].filter((key) => !iconSlots.some(([known]) => known === key)).sort(),
        ];
        const iconFields = orderedKeys.map((key) => {
            const label = iconSlots.find(([known]) => known === key)?.[1] || key;
            const selectedFile = localIconFiles.get(key);
            const fromJson = localJsonIcons.has(key);
            const svg = safeIconSvg(localIconSvgs.get(key) || localJsonIcons.get(key) || baseIcons[key]);
            const source = selectedFile ? selectedFile.name : (fromJson ? `${localIconsJsonFile?.name || "icons.json"} · JSON 覆盖` : "继承基础主题");
            return `<div class="dtm-icon-field" data-icon-key="${escapeHtml(key)}" data-overridden="${Boolean(selectedFile || fromJson)}"><span class="dtm-icon-preview">${svg || `<span class="dtm-icon-preview-placeholder">${escapeHtml(key.slice(0, 2).toUpperCase())}</span>`}</span><span class="dtm-icon-meta"><span class="dtm-icon-label">${escapeHtml(label)}</span><span class="dtm-icon-key">${escapeHtml(key)}</span><span class="dtm-icon-file" title="${escapeHtml(source)}">${escapeHtml(source)}</span></span><span class="dtm-icon-controls"><label class="dtm-button">${selectedFile ? "更换" : "选择 SVG"}<input hidden type="file" accept=".svg,image/svg+xml" data-local-icon-file="${escapeHtml(key)}"></label>${selectedFile ? `<button class="dtm-icon-remove" type="button" data-local-icon-remove="${escapeHtml(key)}" aria-label="清除 ${escapeHtml(label)}">×</button>` : ""}</span></div>`;
        }).join("");
        return `<div class="dtm-modal-layer" role="presentation"><button class="dtm-modal-backdrop" type="button" data-local-theme-close aria-label="关闭弹窗"></button><section class="dtm-dialog" role="dialog" aria-modal="true" aria-labelledby="dtm-local-title"><div class="dtm-dialog-head"><div><h2 id="dtm-local-title">本地自定义主题</h2><p>配置只保存在本机。所有图标都以独立表单项显示，可直观看到基础图标和替换结果。</p></div><button class="dtm-button dtm-dialog-close" type="button" data-local-theme-close aria-label="关闭">×</button></div><div class="dtm-dialog-body"><div class="dtm-local-form">${localDraftError ? `<div class="dtm-form-error">${escapeHtml(localDraftError)}</div>` : ""}<section class="dtm-form-section"><div class="dtm-form-section-head"><div><h3>基本信息</h3><p>填写名称、选择基础主题和背景图片。</p></div></div><div class="dtm-form-grid"><label class="dtm-field"><span>主题名称</span><input data-local-theme-name value="${escapeHtml(localThemeName)}" placeholder="例如：我的夜空"></label><label class="dtm-field"><span>基础主题</span><select data-local-theme-base aria-label="基础主题">${baseOptions}</select></label><label class="dtm-field dtm-wide"><span>背景图片</span><span class="dtm-file-box"><label class="dtm-button dtm-button-primary">选择图片<input hidden type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" data-local-theme-image-file></label><span class="dtm-file-name" data-local-theme-image-name>${localImageFile ? escapeHtml(localImageFile.name) : "支持 PNG、JPG、WebP，最大 16 MB"}</span></span></label></div></section><section class="dtm-form-section"><div class="dtm-form-section-head"><div><h3>图标</h3><p>每项显示当前图标；上传 SVG 后会立即显示替换预览。</p></div></div><div class="dtm-icon-form">${iconFields || '<div class="dtm-empty">基础主题没有可配置图标。</div>'}</div></section><section class="dtm-form-section"><div class="dtm-form-section-head"><div><h3>批量导入</h3><p>可导入完整或部分 <code>icons.json</code>，单项上传的 SVG 优先级更高。</p></div></div><span class="dtm-file-box"><label class="dtm-button">选择 icons.json<input hidden type="file" accept=".json,application/json" data-local-theme-icons-file></label><span class="dtm-file-name" data-local-theme-icons-name>${localIconsJsonFile ? escapeHtml(localIconsJsonFile.name) : "导入主题包 v3 的 icons.json；可只包含需要覆盖的图标"}</span>${localIconsJsonFile ? '<button class="dtm-button" type="button" data-local-icons-clear>清除</button>' : ""}</span></section></div></div><div class="dtm-dialog-actions"><button class="dtm-button" type="button" data-local-theme-close>取消</button><button class="dtm-button dtm-button-primary" type="button" data-local-theme-create>另存为本地主题</button></div></section></div>`;
    };
    const petHtml = (pet) => {
        const active = state?.selectedPet === pet.id;
        const selectable = Boolean(state?.canEnableActive);
        const chips = [`<span class="dtm-chip">宠物 v${escapeHtml(pet.spriteVersionNumber)}</span>`];
        if (pet.selectedInCodex)
            chips.push('<span class="dtm-chip">Codex 当前使用</span>');
        return `<article class="dtm-card"><div class="dtm-preview">${bird}</div><div class="dtm-card-body"><div class="dtm-card-line"><div class="dtm-card-main"><div class="dtm-title">${escapeHtml(pet.displayName)}</div><div class="dtm-row">${chips.join("")}</div>${pet.description ? `<p style="margin-top:8px">${escapeHtml(pet.description)}</p>` : ""}</div><button class="dtm-button ${active ? "" : "dtm-button-primary"}" data-pet-select="${escapeHtml(pet.id)}" ${active || !selectable ? "disabled" : ""}>${active ? "已绑定" : (selectable ? "绑定" : "需先启用主题")}</button></div></div></article>`;
    };
    const catalogHtml = () => {
        if (!catalog)
            return "";
        const cards = catalog.themes.map((theme) => {
            const preview = safePreview(theme.preview);
            return `<article class="dtm-card"><div class="dtm-preview">${preview ? `<img src="${escapeHtml(preview)}" alt="">` : bird}</div><div class="dtm-card-body"><div class="dtm-card-line"><div class="dtm-card-main"><div class="dtm-title">${escapeHtml(theme.name)}</div><span class="dtm-chip">库</span></div><button class="dtm-button dtm-button-primary" data-library-install="${escapeHtml(theme.key)}" data-source-id="${escapeHtml(catalog.source.id)}">安装</button></div></div></article>`;
        }).join("");
        return `<div class="dtm-section"><h2>${escapeHtml(catalog.source.label)} · 可安装主题</h2>${cards ? `<div class="dtm-grid">${cards}</div>` : '<div class="dtm-empty">这个主题库中没有找到有效主题。</div>'}</div>`;
    };
    const render = () => {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || !state)
            return;
        const installedThemeIds = new Set(state.themes.map((theme) => theme.id));
        const themes = [
            ...state.themes.map(cardHtml),
            ...(state.bundledThemes || [])
                .filter((theme) => !installedThemeIds.has(theme.id))
                .map(bundledCardHtml),
        ].join("") + localCreatorCardHtml();
        const pets = (state.pets || []).map(petHtml).join("");
        const libraries = state.libraries.map((source) => `<div class="dtm-source"><strong>${escapeHtml(source.label)}${source.type === "repository" ? ' <span class="dtm-chip">GitHub</span>' : ""}</strong><span class="dtm-path" title="${escapeHtml(source.location)}">${escapeHtml(source.location)}</span><span class="dtm-row"><button class="dtm-button" data-library-open="${escapeHtml(source.id)}">读取</button><button class="dtm-button dtm-button-danger" data-library-remove="${escapeHtml(source.id)}">移除</button></span></div>`).join("");
        if (localModalOpen && !localBaseKey)
            localBaseKey = state.bundledThemes?.[0]?.key || "";
        const baseOptions = (state.bundledThemes || []).map((theme) => `<option value="${escapeHtml(theme.key)}" ${theme.key === localBaseKey ? "selected" : ""}>${escapeHtml(theme.name)}</option>`).join("");
        const themePane = `<section class="dtm-section"><h2>主题</h2><div class="dtm-grid">${themes}</div></section><section class="dtm-section"><h2>从 GitHub 仓库安装</h2><p style="margin-bottom:12px">公开仓库根目录放置 <code>theme-library.json</code> 后，可直接添加仓库并读取主题；无需手填 Raw 地址。</p><div class="dtm-row"><div class="dtm-grow"><input data-repository-location placeholder="https://github.com/owner/repository"></div><div style="min-width:150px"><input data-repository-label placeholder="名称（可选）"></div><button class="dtm-button dtm-button-primary" data-repository-add>添加仓库</button></div></section><section class="dtm-section"><h2>主题库</h2><p style="margin-bottom:12px">也支持本地主题包目录，或 HTTPS 远程索引。主题包包含可执行渲染脚本，只添加你信任的来源。远程索引格式为 <code>{ "themes": [{ "id", "name", "themeUrl" }] }</code>。</p><div class="dtm-row"><div class="dtm-grow"><input data-library-location placeholder="本地主题包目录或 https://…/index.json"></div><div style="min-width:150px"><input data-library-label placeholder="名称（可选）"></div><button class="dtm-button dtm-button-primary" data-library-add>添加主题库</button></div><div style="margin-top:12px">${libraries || '<div class="dtm-empty">尚未配置主题库。</div>'}</div></section>${catalogHtml()}`;
        const petPane = `<section class="dtm-section"><h2>主题宠物</h2><p style="margin-bottom:12px">宠物库与主题库分离保存。选择后只把宠物 ID 绑定到当前主题；换机安装并启用主题时，会从主题包关联的独立宠物目录安装并选中同一只宠物。</p>${pets ? `<div class="dtm-grid">${pets}</div><div class="dtm-row" style="margin-top:12px"><button class="dtm-button ${state.selectedPet ? "dtm-button-danger" : ""}" data-pet-clear ${state.selectedPet ? "" : "disabled"}>解除主题宠物绑定</button></div>` : '<div class="dtm-empty">没有发现有效的 Codex v2 宠物包。</div>'}</section>`;
        panel.innerHTML = `<div class="dtm-wrap"><div class="dtm-head"><div><h1>主题</h1><p>主题管理工具独立安装；主题、背景图片和可选宠物都在本页安装与启用。</p></div><div class="dtm-status"><span class="dtm-dot"></span>${state.paused ? "官方外观" : `当前：${escapeHtml(state.active?.name || "主题")}`} · ${state.hotReload ? "热重载已开启" : "自动刷新"}</div></div><div class="dtm-row"><button class="dtm-button ${state.paused ? "dtm-button-primary" : "dtm-button-danger"}" data-official ${state.paused && !state.canEnableActive ? "disabled" : ""}>${state.paused ? (state.canEnableActive ? "启用当前主题" : "请先安装主题") : "还原官方外观"}</button><button class="dtm-button" data-refresh>立即刷新</button><p>新安装的管理工具默认保持官方外观；还原不会删除已安装主题、宠物或主题库配置。</p></div><div class="dtm-tabs" role="tablist" aria-label="主题内容"><button class="dtm-tab" role="tab" aria-selected="${activeTab === "themes"}" data-manager-tab="themes">主题</button><button class="dtm-tab" role="tab" aria-selected="${activeTab === "pets"}" data-manager-tab="pets">宠物</button></div>${activeTab === "pets" ? petPane : themePane}${message ? `<div class="dtm-message">${escapeHtml(message)}</div>` : ""}</div>${localCreatorDialogHtml(baseOptions)}`;
    };
    const refreshState = async () => { state = await call("getState"); render(); };
    const act = async (operation, success) => {
        message = "处理中…";
        render();
        try {
            state = await operation();
            message = success;
            render();
        }
        catch (error) {
            message = error.message || String(error);
            render();
        }
    };
    const onPanelClick = (event) => {
        const target = event.target?.closest("button");
        if (!target)
            return;
        if (target.dataset.managerTab) {
            activeTab = target.dataset.managerTab === "pets" ? "pets" : "themes";
            render();
        }
        else if (target.hasAttribute("data-local-theme-open")) {
            resetLocalDraft();
            localModalOpen = true;
            render();
        }
        else if (target.hasAttribute("data-local-theme-close")) {
            localModalOpen = false;
            resetLocalDraft();
            render();
        }
        else if (target.dataset.localIconRemove) {
            preserveLocalTextFields();
            localIconFiles.delete(target.dataset.localIconRemove);
            localIconSvgs.delete(target.dataset.localIconRemove);
            localDraftError = "";
            render();
        }
        else if (target.hasAttribute("data-local-icons-clear")) {
            preserveLocalTextFields();
            localIconsJsonFile = null;
            localJsonIcons.clear();
            localDraftError = "";
            render();
        }
        else if (target.hasAttribute("data-official"))
            act(() => call("setPaused", { paused: !state.paused }), state.paused ? "主题已重新启用" : "已恢复 Codex 官方外观");
        else if (target.hasAttribute("data-refresh"))
            act(() => call("getState"), "主题状态已刷新");
        else if (target.dataset.themeUse)
            act(() => call("useTheme", { key: target.dataset.themeUse }), "主题已启用");
        else if (target.dataset.bundledInstall)
            act(() => call("installBundledTheme", { key: target.dataset.bundledInstall }), "主题安装完成，可在主题列表中启用");
        else if (target.hasAttribute("data-local-theme-create")) {
            const panel = document.getElementById(PANEL_ID);
            const name = panel.querySelector("[data-local-theme-name]")?.value || "";
            const baseKey = panel.querySelector("[data-local-theme-base]")?.value || "";
            const imageFile = localImageFile;
            const iconsJsonFile = localIconsJsonFile;
            const iconFiles = [...localIconFiles.entries()];
            act(async () => {
                if (!imageFile)
                    throw new Error("请先选择一张背景图片");
                const iconOverrides = {};
                for (const [key, file] of iconFiles)
                    iconOverrides[key] = await file.text();
                const result = await call("createLocalTheme", {
                    name,
                    baseKey,
                    imageName: imageFile.name,
                    imageBase64: await fileToBase64(imageFile),
                    iconsJsonText: iconsJsonFile ? await iconsJsonFile.text() : "",
                    iconOverrides,
                });
                localModalOpen = false;
                resetLocalDraft();
                return result;
            }, "本地主题已另存，可在主题列表中启用");
        }
        else if (target.dataset.petSelect)
            act(() => call("selectPet", { petId: target.dataset.petSelect }), "宠物已绑定到主题并设为 Codex 当前宠物");
        else if (target.hasAttribute("data-pet-clear"))
            act(() => call("selectPet", { petId: "" }), "主题宠物绑定已解除");
        else if (target.hasAttribute("data-repository-add")) {
            const panel = document.getElementById(PANEL_ID);
            const location = panel.querySelector("[data-repository-location]")?.value || "";
            const label = panel.querySelector("[data-repository-label]")?.value || "";
            act(() => call("addRepository", { location, label }), "GitHub 主题仓库已添加");
        }
        else if (target.hasAttribute("data-library-add")) {
            const panel = document.getElementById(PANEL_ID);
            const location = panel.querySelector("[data-library-location]")?.value || "";
            const label = panel.querySelector("[data-library-label]")?.value || "";
            act(() => call("addLibrary", { location, label }), "主题库已添加");
        }
        else if (target.dataset.libraryRemove) {
            catalog = null;
            act(() => call("removeLibrary", { id: target.dataset.libraryRemove }), "主题库已移除");
        }
        else if (target.dataset.libraryOpen)
            act(async () => { catalog = await call("getCatalog", { id: target.dataset.libraryOpen }); return call("getState"); }, "主题库读取完成");
        else if (target.dataset.libraryInstall)
            act(() => call("installLibraryTheme", { sourceId: target.dataset.sourceId, key: target.dataset.libraryInstall }), "主题安装完成");
    };
    const onPanelChange = async (event) => {
        const input = event.target;
        if (!input)
            return;
        if (input.matches("[data-local-theme-name]"))
            localThemeName = input.value;
        else if (input.matches("[data-local-theme-base]")) {
            localBaseKey = input.value;
            localDraftError = "";
            render();
        }
        else if (input.matches("[data-local-theme-image-file]")) {
            localImageFile = input.files?.[0] || null;
            const label = document.querySelector(`#${PANEL_ID} [data-local-theme-image-name]`);
            if (label)
                label.textContent = localImageFile?.name || "支持 PNG、JPG、WebP，最大 16 MB";
        }
        else if (input.matches("[data-local-theme-icons-file]")) {
            const file = input.files?.[0] || null;
            if (!file)
                return;
            preserveLocalTextFields();
            try {
                const parsed = JSON.parse(await file.text());
                const source = parsed?.icons && typeof parsed.icons === "object" && !Array.isArray(parsed.icons)
                    ? parsed.icons : parsed;
                if (!source || typeof source !== "object" || Array.isArray(source))
                    throw new Error("JSON 必须是图标对象");
                const entries = Object.entries(source);
                if (entries.length > 128)
                    throw new Error("图标数量不能超过 128 个");
                const imported = new Map();
                for (const [key, value] of entries) {
                    const svg = safeIconSvg(value);
                    if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key) || !svg)
                        throw new Error(`图标 ${key} 不是有效 SVG`);
                    imported.set(key, svg);
                }
                localIconsJsonFile = file;
                localJsonIcons.clear();
                for (const [key, svg] of imported)
                    localJsonIcons.set(key, svg);
                localDraftError = "";
            }
            catch (error) {
                localIconsJsonFile = null;
                localJsonIcons.clear();
                localDraftError = error instanceof Error ? error.message : "无法读取 icons.json";
            }
            render();
        }
        else if (input.matches("[data-local-icon-file]")) {
            const file = input.files?.[0];
            if (!file)
                return;
            preserveLocalTextFields();
            const key = input.dataset.localIconFile || "";
            const svg = safeIconSvg(await file.text());
            if (!svg) {
                localDraftError = `${file.name} 不是有效的 SVG 图标`;
                render();
                return;
            }
            if (key) {
                localIconFiles.set(key, file);
                localIconSvgs.set(key, svg);
            }
            localDraftError = "";
            render();
        }
    };
    const show = async (button, nav) => {
        showing = true;
        message = "";
        catalog = null;
        getStyle();
        setSelected(button);
        let panel = document.getElementById(PANEL_ID);
        if (!panel) {
            panel = document.createElement("section");
            panel.id = PANEL_ID;
            panel.setAttribute("aria-label", "主题");
            panel.addEventListener("click", onPanelClick);
            panel.addEventListener("change", onPanelChange);
            document.body.appendChild(panel);
        }
        positionPanel(panel, nav);
        panel.hidden = false;
        panel.innerHTML = '<div class="dtm-wrap"><div class="dtm-empty">正在读取主题…</div></div>';
        try {
            await refreshState();
        }
        catch (error) {
            panel.innerHTML = `<div class="dtm-wrap"><h1>主题</h1><div class="dtm-empty">${escapeHtml(error.message || error)}</div></div>`;
        }
    };
    const hide = () => { showing = false; localModalOpen = false; resetLocalDraft(); const panel = document.getElementById(PANEL_ID); if (panel)
        panel.hidden = true; };
    const ensure = () => {
        const nav = document.querySelector('nav[aria-label="设置"],nav[aria-label="Settings"]');
        if (!nav) {
            hide();
            return false;
        }
        let button = nav.querySelector(`button[data-settings-panel-slug="${NAV_SLUG}"]`);
        if (!button) {
            const appearance = nav.querySelector('button[data-settings-panel-slug="appearance"],button[aria-label="外观"],button[aria-label="Appearance"]');
            if (!appearance)
                return false;
            button = appearance.cloneNode(true);
            button.removeAttribute("aria-current");
            button.dataset.settingsPanelSlug = NAV_SLUG;
            button.setAttribute("aria-label", "主题");
            const content = button.firstElementChild || button;
            content.innerHTML = `${navIcon}<span>主题</span>`;
            button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); show(button, nav); });
            appearance.insertAdjacentElement("afterend", button);
        }
        if (showing) {
            const panel = document.getElementById(PANEL_ID);
            if (panel)
                positionPanel(panel, nav);
        }
        return true;
    };
    const onDocumentClick = (event) => {
        const settingsButton = event.target?.closest?.('button[data-settings-panel-slug]');
        if (settingsButton && settingsButton.dataset.settingsPanelSlug !== NAV_SLUG)
            hide();
    };
    document.addEventListener("click", onDocumentClick, true);
    let scheduled = null;
    const observer = new MutationObserver((records) => {
        if (records.some((record) => [...record.addedNodes].some((node) => {
            const element = node instanceof Element ? node : null;
            return Boolean(element && (element.matches('nav[aria-label="设置"],nav[aria-label="Settings"]') ||
                element.querySelector('nav[aria-label="设置"],nav[aria-label="Settings"]')));
        }))) {
            clearTimeout(scheduled);
            scheduled = setTimeout(ensure, 120);
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timer = setInterval(ensure, 4000);
    const cleanup = () => { observer.disconnect(); clearInterval(timer); clearTimeout(scheduled); window.removeEventListener(RESPONSE, onResponse); document.removeEventListener("click", onDocumentClick, true); document.getElementById(PANEL_ID)?.remove(); document.getElementById(STYLE_ID)?.remove(); delete window[KEY]; };
    window[KEY] = { ensure, cleanup, observer, timer, version: VERSION };
    ensure();
    return true;
})();
