"use strict";
(() => {
    const KEY = "__CODEX_DREAM_THEME_MANAGER__";
    const VERSION = "1.9.1";
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
    #${PANEL_ID} .dtm-pet-sprite{position:absolute;left:50%;top:50%;width:76px;height:94px;transform:translate(-50%,-50%);background-image:var(--dtm-pet-image);background-repeat:no-repeat;background-position:center;background-size:contain;filter:drop-shadow(0 10px 18px #0008)}
    #${PANEL_ID} .dtm-bound-pet{position:absolute;right:14px;bottom:9px;width:52px;height:64px;padding:0;border:0;border-radius:0;background-color:transparent;background-image:var(--dtm-pet-image);background-repeat:no-repeat;background-position:center;background-size:contain;filter:drop-shadow(0 8px 12px #000b) drop-shadow(0 0 8px color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 28%,transparent))}
    #${PANEL_ID} .dtm-bound-pet::after{content:"";position:absolute;left:18%;right:18%;bottom:5px;height:9px;border-radius:50%;background:#0008;filter:blur(5px);z-index:-1}
    #${PANEL_ID} .dtm-pet-thumb-ready{background-position:center;background-size:contain}
    #${PANEL_ID} button.dtm-bound-pet:hover{transform:translateY(-2px) scale(1.04);filter:drop-shadow(0 12px 16px #000c) drop-shadow(0 0 14px var(--dream-manager-accent,#6edaf2))}
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
    #${PANEL_ID} .dtm-color-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    #${PANEL_ID} .dtm-color-field{position:relative;overflow:hidden;display:grid;gap:12px;padding:14px;border:1px solid color-mix(in srgb,var(--dtm-current-color,var(--dtm-line)) 38%,var(--dtm-line));border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--dtm-current-color,#6edaf2) 12%,var(--dtm-raised)),color-mix(in oklab,var(--dtm-surface) 70%,transparent));box-shadow:inset 0 1px 0 #ffffff12}
    #${PANEL_ID} .dtm-color-field::before{content:"";position:absolute;right:-36px;top:-46px;width:130px;height:130px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--dtm-current-color,#6edaf2) 55%,transparent),transparent 66%);opacity:.62;pointer-events:none}
    #${PANEL_ID} .dtm-color-head{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px}
    #${PANEL_ID} .dtm-color-title{font-size:13px;font-weight:700}
    #${PANEL_ID} .dtm-color-note{font-size:11px;color:var(--dtm-muted);margin-top:2px}
    #${PANEL_ID} .dtm-color-value{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:4px 8px;border:1px solid color-mix(in srgb,var(--dtm-current-color,#6edaf2) 45%,var(--dtm-line));border-radius:999px;background:#06101a78;color:var(--dtm-text);font-size:10px}
    #${PANEL_ID} .dtm-color-current{width:46px;height:46px;border:1px solid color-mix(in srgb,var(--dtm-current-color,#6edaf2) 58%,var(--dtm-line));border-radius:14px;background:var(--dtm-current-color);background-image:var(--dtm-transparent-grid,none);box-shadow:0 10px 24px color-mix(in srgb,var(--dtm-current-color,#6edaf2) 30%,transparent),inset 0 0 0 1px #ffffff30}
    #${PANEL_ID} .dtm-transparent-preview{--dtm-transparent-grid:linear-gradient(45deg,#ffffff44 25%,transparent 25%),linear-gradient(-45deg,#ffffff44 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ffffff44 75%),linear-gradient(-45deg,transparent 75%,#ffffff44 75%);background-color:#0000;background-size:10px 10px;background-position:0 0,0 5px,5px -5px,-5px 0}
    #${PANEL_ID} .dtm-swatches{position:relative;display:flex;flex-wrap:wrap;gap:8px;padding:10px;border:1px solid color-mix(in srgb,var(--dtm-line) 64%,transparent);border-radius:13px;background:#03091142}
    #${PANEL_ID} .dtm-swatch{width:28px;height:28px;padding:0;border:1px solid color-mix(in srgb,var(--dtm-line) 76%,#ffffff40);border-radius:999px;background:var(--dtm-swatch-color);box-shadow:inset 0 0 0 1px #ffffff2e,0 5px 12px #0005;transition:transform .12s ease,border-color .12s ease}
    #${PANEL_ID} .dtm-swatch:hover{transform:translateY(-1px);border-color:var(--dream-manager-accent,#6edaf2)}
    #${PANEL_ID} .dtm-swatch[aria-pressed="true"]{outline:2px solid var(--dream-manager-accent,#6edaf2);outline-offset:2px}
    #${PANEL_ID} .dtm-swatch-text{width:auto;min-width:48px;padding:0 10px;background-color:#0000;color:var(--dtm-text);font-size:11px}
    #${PANEL_ID} .dtm-color-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    #${PANEL_ID} .dtm-color-picker{position:relative;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 10px;border:1px solid var(--dtm-line);border-radius:10px;background:color-mix(in oklab,var(--dtm-raised) 92%,transparent);color:var(--dtm-text);font-size:12px;overflow:hidden}
    #${PANEL_ID} .dtm-color-picker input[type="color"]{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
    #${PANEL_ID} .dtm-color-picker-dot{width:14px;height:14px;border-radius:50%;background:var(--dtm-current-color);box-shadow:inset 0 0 0 1px #ffffff55}
    #${PANEL_ID} input[type="color"]{width:40px;height:30px;padding:2px}
    #${PANEL_ID} .dtm-advanced-color{font-size:11px;color:var(--dtm-muted)}
    #${PANEL_ID} .dtm-advanced-color summary{cursor:pointer;margin-bottom:6px}
    #${PANEL_ID} .dtm-advanced-color input{height:32px}
    #${PANEL_ID} .dtm-manual-icon-add{display:grid;grid-template-columns:minmax(140px,1fr) auto;gap:10px;align-items:end;margin-bottom:10px;padding:12px;border:1px solid color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 22%,var(--dtm-line));border-radius:13px;background:linear-gradient(135deg,color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 8%,transparent),#03091136)}
    #${PANEL_ID} .dtm-modal-layer{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px}
    #${PANEL_ID} .dtm-modal-backdrop{position:absolute;inset:0;border:0;background:#02070db8;padding:0}
    #${PANEL_ID} .dtm-dialog{position:relative;display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(980px,calc(100vw - 40px));max-height:calc(100vh - 40px);overflow:hidden;border:1px solid var(--dtm-line);border-radius:18px;background:var(--dtm-surface);box-shadow:0 24px 80px #000b}
    #${PANEL_ID} .dtm-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:22px 24px 16px;border-bottom:1px solid var(--dtm-line)}
    #${PANEL_ID} .dtm-dialog-head>div:first-child{min-width:0;flex:1;pointer-events:auto}
    #${PANEL_ID} .dtm-dialog-head h2{margin:0 0 6px}
    #${PANEL_ID} .dtm-dialog-close{width:32px;height:32px;padding:0;font-size:19px;line-height:1}
    #${PANEL_ID} .dtm-close-hit{appearance:none;position:relative;display:block;flex:0 0 48px;width:48px;height:48px;min-width:48px;min-height:48px;margin:0;padding:0;border:1px solid var(--dtm-line);border-radius:15px;background:color-mix(in oklab,var(--dtm-raised) 90%,transparent);color:var(--dtm-text);font-size:0;line-height:0;cursor:pointer;user-select:none;touch-action:manipulation;z-index:20;isolation:isolate;overflow:hidden;pointer-events:auto!important}
    #${PANEL_ID} .dtm-close-hit::before{content:"";position:absolute;inset:0;border-radius:inherit;background:transparent;pointer-events:none;z-index:0}
    #${PANEL_ID} .dtm-close-hit::after{content:"";position:absolute;left:50%;top:50%;width:20px;height:20px;transform:translate(-50%,-50%);background:linear-gradient(45deg,transparent calc(50% - 1.2px),currentColor calc(50% - 1.2px),currentColor calc(50% + 1.2px),transparent calc(50% + 1.2px)),linear-gradient(-45deg,transparent calc(50% - 1.2px),currentColor calc(50% - 1.2px),currentColor calc(50% + 1.2px),transparent calc(50% + 1.2px));pointer-events:none;z-index:1}
    #${PANEL_ID} .dtm-close-hit:hover,#${PANEL_ID} .dtm-close-hit.dtm-close-hover{border-color:var(--dream-manager-accent,#6edaf2);background:color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 16%,var(--dtm-raised));box-shadow:0 0 0 3px color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 12%,transparent),0 10px 24px #0005}
    #${PANEL_ID} .dtm-close-hit:active{transform:translateY(1px);background:color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 24%,var(--dtm-raised))}
    #${PANEL_ID} .dtm-close-hit:focus-visible{outline:2px solid var(--dream-manager-accent,#6edaf2);outline-offset:2px}
    #${PANEL_ID} .dtm-dialog-body{min-height:0;overflow:auto;padding:18px 24px}
    #${PANEL_ID} .dtm-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 24px;border-top:1px solid var(--dtm-line);background:color-mix(in oklab,var(--dtm-surface) 92%,var(--dtm-raised))}
    #${PANEL_ID} .dtm-form-error{padding:9px 12px;border:1px solid #a95b55;border-radius:10px;background:#5c252859;color:#ffc7c2;font-size:12px}
    #${PANEL_ID} .dtm-field{display:grid;gap:7px}
    #${PANEL_ID} .dtm-field>span{font-size:12px;font-weight:600;color:var(--dtm-muted)}
    #${PANEL_ID} .dtm-file-box{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;min-height:44px;padding:7px 8px 7px 12px;border:1px solid var(--dtm-line);border-radius:10px;background:color-mix(in oklab,var(--dtm-raised) 94%,transparent)}
    #${PANEL_ID} .dtm-file-box .dtm-button{flex:none}
    #${PANEL_ID} .dtm-file-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px}
    #${PANEL_ID} .dtm-file-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dtm-muted);font-size:12px}
    #${PANEL_ID} .dtm-loading-card{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border:1px solid var(--dtm-line);border-radius:14px;background:color-mix(in oklab,var(--dtm-raised) 82%,transparent)}
    #${PANEL_ID} .dtm-loading-copy{display:flex;align-items:center;gap:11px;color:var(--dtm-muted);font-size:13px}
    #${PANEL_ID} .dtm-loading-spinner{width:16px;height:16px;border-radius:50%;border:2px solid color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 26%,transparent);border-top-color:var(--dream-manager-accent,#6edaf2);animation:dtm-spin .8s linear infinite}
    @keyframes dtm-spin{to{transform:rotate(360deg)}}
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
    #${PANEL_ID} .dtm-image-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
    #${PANEL_ID} .dtm-image-choice{display:grid;gap:8px;padding:10px;border:1px solid var(--dtm-line);border-radius:12px;background:color-mix(in oklab,var(--dtm-surface) 55%,transparent)}
    #${PANEL_ID} .dtm-image-choice[aria-checked="true"]{border-color:var(--dream-manager-accent,#6edaf2);box-shadow:0 0 0 2px color-mix(in srgb,var(--dream-manager-accent,#6edaf2) 16%,transparent)}
    #${PANEL_ID} .dtm-image-thumb{height:86px;border-radius:9px;background:linear-gradient(135deg,#10263d,#173957);background-image:var(--dtm-image-thumb);background-position:center;background-size:cover;background-repeat:no-repeat;border:1px solid var(--dtm-line)}
    #${PANEL_ID} .dtm-image-choice input{width:auto;height:auto}
    #${PANEL_ID} input[type="file"][hidden]{display:none}
    #${PANEL_ID} .dtm-source{display:grid;grid-template-columns:minmax(120px,180px) minmax(220px,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--border-light,#263642) 65%,transparent);font-size:12px}
    #${PANEL_ID} .dtm-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary,#9bb0bc)}
    #${PANEL_ID} .dtm-empty{padding:20px;border:1px dashed var(--border-heavy,#38505f);border-radius:12px;color:var(--text-secondary,#9bb0bc);font-size:12px;text-align:center}
    #${PANEL_ID} .dtm-message{position:sticky;bottom:12px;margin:20px auto 0;width:max-content;max-width:90%;padding:8px 13px;border-radius:9px;background:#142c3b;border:1px solid #4daac1;box-shadow:0 8px 24px #0008;font-size:12px}
    @media(max-width:780px){#${PANEL_ID}{padding:20px}#${PANEL_ID} .dtm-head{display:block}#${PANEL_ID} .dtm-status{margin-top:12px;width:max-content}#${PANEL_ID} .dtm-source,#${PANEL_ID} .dtm-form-grid,#${PANEL_ID} .dtm-color-grid,#${PANEL_ID} .dtm-icon-form,#${PANEL_ID} .dtm-manual-icon-add{grid-template-columns:1fr}#${PANEL_ID} .dtm-form-grid .dtm-wide{grid-column:auto}#${PANEL_ID} .dtm-modal-layer{padding:10px}#${PANEL_ID} .dtm-dialog{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}#${PANEL_ID} .dtm-dialog-head,#${PANEL_ID} .dtm-dialog-body,#${PANEL_ID} .dtm-dialog-actions{padding-left:16px;padding-right:16px} }
  `;
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const safePreview = (value) => typeof value === "string" && (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value) || /^https:\/\//i.test(value)) ? value : "";
    const hasPetPreview = (value) => Boolean(safePreview(value));
    const cssUrl = (value) => `url("${String(value).replace(/["\\\n\r\f]/g, "")}")`;
    const themePreviewCache = new Map();
    const petPreviewCache = new Map();
    const themePreviewDataUrl = (scope, key) => {
        const normalizedScope = scope === "bundled" ? "bundled" : "installed";
        const normalizedKey = String(key || "").trim();
        if (!normalizedKey || normalizedKey.length > 160 || /[\\/:*?"<>]|\.\./.test(normalizedKey))
            return Promise.resolve("");
        const cacheKey = `${normalizedScope}:${normalizedKey}`;
        if (!themePreviewCache.has(cacheKey)) {
            themePreviewCache.set(cacheKey, call("getThemePreview", { scope: normalizedScope, key: normalizedKey }).then((result) => safePreview(result?.preview)).catch(() => ""));
        }
        return themePreviewCache.get(cacheKey);
    };
    const petThumbCache = new Map();
    const petPreviewDataUrl = (petId) => {
        const normalizedPetId = String(petId || "").trim();
        if (!/^[A-Za-z0-9._-]{1,80}$/.test(normalizedPetId))
            return Promise.resolve("");
        if (!petPreviewCache.has(normalizedPetId)) {
            petPreviewCache.set(normalizedPetId, call("getPetPreview", { petId: normalizedPetId }).then((result) => safePreview(result?.preview)).catch(() => ""));
        }
        return petPreviewCache.get(normalizedPetId);
    };
    const petThumbDataUrl = (preview) => {
        if (!petThumbCache.has(preview)) {
            petThumbCache.set(preview, new Promise((resolve, reject) => {
                const image = new Image();
                const timer = setTimeout(() => reject(new Error("宠物预览生成超时")), 6000);
                image.onload = () => {
                    try {
                        clearTimeout(timer);
                        const codexPetAtlas = image.naturalWidth === 1536 && (image.naturalHeight === 1872 || image.naturalHeight === 2288);
                        const columns = codexPetAtlas ? 8 : 12;
                        const rows = codexPetAtlas ? Math.round(image.naturalHeight / 208) : 16;
                        const sourceWidth = Math.max(1, Math.floor(image.naturalWidth / columns));
                        const sourceHeight = Math.max(1, Math.floor(image.naturalHeight / rows));
                        const sourceCanvas = document.createElement("canvas");
                        sourceCanvas.width = image.naturalWidth;
                        sourceCanvas.height = image.naturalHeight;
                        const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
                        if (!sourceContext)
                            throw new Error("无法读取宠物图集");
                        sourceContext.drawImage(image, 0, 0);
                        let best = { score: 0, x: 0, y: 0, width: sourceWidth, height: sourceHeight };
                        const readFrameBounds = (frameX, frameY) => {
                            const data = sourceContext.getImageData(frameX, frameY, sourceWidth, sourceHeight).data;
                            let minX = sourceWidth, minY = sourceHeight, maxX = -1, maxY = -1;
                            for (let pixel = 0; pixel < data.length; pixel += 4) {
                                if (data[pixel + 3] < 8)
                                    continue;
                                const index = pixel / 4;
                                const px = index % sourceWidth;
                                const py = Math.floor(index / sourceWidth);
                                if (px < minX)
                                    minX = px;
                                if (py < minY)
                                    minY = py;
                                if (px > maxX)
                                    maxX = px;
                                if (py > maxY)
                                    maxY = py;
                            }
                            if (maxX < minX || maxY < minY)
                                return null;
                            const pad = codexPetAtlas ? 4 : 2;
                            minX = Math.max(0, minX - pad);
                            minY = Math.max(0, minY - pad);
                            maxX = Math.min(sourceWidth - 1, maxX + pad);
                            maxY = Math.min(sourceHeight - 1, maxY + pad);
                            return {
                                x: frameX + minX,
                                y: frameY + minY,
                                width: maxX - minX + 1,
                                height: maxY - minY + 1,
                            };
                        };
                        if (codexPetAtlas) {
                            const firstFrame = readFrameBounds(0, 0);
                            if (firstFrame)
                                best = { ...firstFrame, score: firstFrame.width * firstFrame.height };
                        }
                        for (let row = 0; row < rows; row += 1) {
                            for (let column = 0; column < columns; column += 1) {
                                if (codexPetAtlas && best.score > 0)
                                    continue;
                                const x = column * sourceWidth;
                                const y = row * sourceHeight;
                                const bounds = readFrameBounds(x, y);
                                if (!bounds)
                                    continue;
                                const { width, height } = bounds;
                                const area = width * height;
                                const centerPenalty = row * 70 + column * 12;
                                const score = area - centerPenalty;
                                if (score > best.score)
                                    best = { score, ...bounds };
                            }
                        }
                        const canvas = document.createElement("canvas");
                        canvas.width = 92;
                        canvas.height = 112;
                        const context = canvas.getContext("2d");
                        if (!context)
                            throw new Error("无法创建宠物预览画布");
                        context.clearRect(0, 0, canvas.width, canvas.height);
                        const padding = 6;
                        const scale = Math.min((canvas.width - padding * 2) / best.width, (canvas.height - padding * 2) / best.height);
                        const width = Math.max(1, Math.round(best.width * scale));
                        const height = Math.max(1, Math.round(best.height * scale));
                        const dx = Math.round((canvas.width - width) / 2);
                        const dy = Math.round(canvas.height - height - padding);
                        context.drawImage(image, best.x, best.y, best.width, best.height, dx, dy, width, height);
                        resolve(canvas.toDataURL("image/png"));
                    }
                    catch (error) {
                        reject(error);
                    }
                };
                image.onerror = () => { clearTimeout(timer); reject(new Error("宠物预览图片无法加载")); };
                image.src = preview;
            }));
        }
        return petThumbCache.get(preview);
    };
    const applyPetPreviewStyles = (panel) => {
        if (!state)
            return;
        panel.querySelectorAll("[data-dtm-pet-preview-pet]").forEach((element) => {
            const petId = element.dataset.dtmPetPreviewPet || "";
            petPreviewDataUrl(petId).then((preview) => preview ? petThumbDataUrl(preview) : "").then((thumb) => {
                if (!thumb)
                    return;
                if (!element.isConnected)
                    return;
                element.style.setProperty("--dtm-pet-image", cssUrl(thumb));
                element.classList.add("dtm-pet-thumb-ready");
            }).catch(() => { });
        });
    };
    const applyThemePreviewImages = (panel) => {
        panel.querySelectorAll("[data-dtm-theme-preview-key]").forEach((image) => {
            const scope = image.dataset.dtmThemePreviewScope || "installed";
            const key = image.dataset.dtmThemePreviewKey || "";
            themePreviewDataUrl(scope, key).then((preview) => {
                if (!preview || !image.isConnected)
                    return;
                image.src = preview;
                image.hidden = false;
                image.parentElement?.querySelector(":scope > svg")?.remove();
            }).catch(() => { });
        });
    };
    const safeIconSvg = (value) => typeof value === "string" && value.length <= 16384 &&
        /^<svg\b[\s\S]*<\/svg>$/i.test(value.trim()) && !/<script\b|on[a-z]+\s*=|javascript:/i.test(value)
        ? value.trim() : "";
    const pending = new Map();
    let sequence = 0;
    let state = null;
    let message = "";
    let showing = false;
    let showSequence = 0;
    let activeTab = "themes";
    let localModalOpen = false;
    let localThemeName = "";
    let localBaseKey = "";
    let localAccent = "#6edaf2";
    let localDetail = "#d9b85f";
    let localSendBase = "#17395b";
    let localProcessingBase = "#143653";
    let localDraftError = "";
    let localImageFile = null;
    let localIconsJsonFile = null;
    let petPickerTheme = null;
    let imageSettingsTheme = null;
    let imageSettingsError = "";
    let imageSettingsFiles = [];
    const localIconFiles = new Map();
    const localIconSvgs = new Map();
    const localJsonIcons = new Map();
    const iconSlots = [
        ["bird", "主题标志（玄翎）"], ["seraph", "主题标志（蕾米埃尔）"], ["chevron", "展开"],
        ["search", "搜索"], ["compose", "新建任务"], ["quick", "快速操作"], ["branch", "分支"],
        ["sites", "网站"], ["clock", "历史"], ["plugins", "插件"], ["folder", "文件夹"],
        ["more", "更多"], ["add", "添加"], ["pin", "固定"], ["archive", "归档"], ["help", "帮助"],
        ["shield", "权限"], ["permissionAsk", "询问权限"], ["permissionAgent", "代理权限"],
        ["permissionFull", "完整权限"], ["mic", "麦克风"], ["send", "发送"], ["processing", "执行中动图"], ["spinner", "加载转圈"],
    ];
    const colorFields = [
        ["accent", "强调色", "localAccent", "data-local-theme-accent"],
        ["detail", "细节点缀色", "localDetail", "data-local-theme-detail"],
        ["sendBase", "发送按钮底色", "localSendBase", "data-local-theme-send-base"],
        ["processingBase", "执行/加载底色", "localProcessingBase", "data-local-theme-processing-base"],
    ];
    const colorPresets = ["#6edaf2", "#5ac7e1", "#77d9ff", "#d9b85f", "#ffe08a", "#ff7ab6", "#8b5cf6", "#22c55e", "#123456", "#17395b", "#143653", "#0d151f"];
    const defaultIconLibrary = [
        ["bird", "玄鸟", bird],
        ["palette", "调色盘", palette],
        ["spark", "星芒", '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l2.2 7.1L21 12l-6.8 2.9L12 22l-2.2-7.1L3 12l6.8-2.9L12 2Z" fill="#f8d76b" stroke="#fff3b0" stroke-width="1"/></svg>'],
        ["moon", "月亮", '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M18.7 15.8A8.1 8.1 0 0 1 8.2 5.3a8.6 8.6 0 1 0 10.5 10.5Z" fill="#b8d7ff" stroke="#f3fbff" stroke-width="1.2"/></svg>'],
        ["flower", "花", '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="#ff8fc7" stroke="#ffe3f1" stroke-width=".8"><circle cx="12" cy="7" r="3.2"/><circle cx="16.4" cy="10.6" r="3.2"/><circle cx="14.7" cy="16" r="3.2"/><circle cx="9.3" cy="16" r="3.2"/><circle cx="7.6" cy="10.6" r="3.2"/></g><circle cx="12" cy="12" r="2.3" fill="#ffe08a"/></svg>'],
        ["bolt", "闪电", '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13.7 2 5 13h6l-1 9 9-12h-6l.7-8Z" fill="#8ee8f8" stroke="#f5fdff" stroke-width="1"/></svg>'],
        ["orbit", "执行中圆环", '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="7.2" fill="none" stroke="#6edaf2" stroke-width="1.5" stroke-dasharray="26 18"/><circle cx="18.5" cy="6.5" r="2.1" fill="#f5fdff" stroke="#d9b85f" stroke-width=".8"/></svg>'],
        ["spinner", "加载转圈", '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a9 9 0 1 1-8.2 5.3" fill="none" stroke="#6edaf2" stroke-width="2" stroke-linecap="round"/><path d="M3.8 8.3 4.2 3l4.1 3.3" fill="none" stroke="#d9b85f" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
    ];
    let localNewIconKey = "";
    const iconLibraryLabels = new Map();
    const resetLocalDraft = () => {
        localThemeName = "";
        localBaseKey = "";
        localAccent = "#6edaf2";
        localDetail = "#d9b85f";
        localSendBase = "#17395b";
        localProcessingBase = "#143653";
        localNewIconKey = "";
        localDraftError = "";
        localImageFile = null;
        localIconsJsonFile = null;
        petPickerTheme = null;
        localIconFiles.clear();
        localIconSvgs.clear();
        localJsonIcons.clear();
        iconLibraryLabels.clear();
    };
    const preserveLocalTextFields = () => {
        const panel = document.getElementById(PANEL_ID);
        localThemeName = panel?.querySelector("[data-local-theme-name]")?.value || localThemeName;
        localBaseKey = panel?.querySelector("[data-local-theme-base]")?.value || localBaseKey;
        localAccent = panel?.querySelector("[data-local-theme-accent]")?.value || localAccent;
        localDetail = panel?.querySelector("[data-local-theme-detail]")?.value || localDetail;
        localSendBase = panel?.querySelector("[data-local-theme-send-base]")?.value || localSendBase;
        localProcessingBase = panel?.querySelector("[data-local-theme-processing-base]")?.value || localProcessingBase;
        localNewIconKey = panel?.querySelector("[data-local-new-icon-key]")?.value || localNewIconKey;
    };
    const localColorValue = (key) => key === "accent" ? localAccent : key === "detail" ? localDetail :
        key === "sendBase" ? localSendBase : localProcessingBase;
    const setLocalColorValue = (key, value) => {
        if (key === "accent")
            localAccent = value;
        else if (key === "detail")
            localDetail = value;
        else if (key === "sendBase")
            localSendBase = value;
        else if (key === "processingBase")
            localProcessingBase = value;
    };
    const colorPickerValue = (value) => /^#[\da-f]{6}$/i.test(value) ? value :
        /^#[\da-f]{3}$/i.test(value) ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : "#6edaf2";
    const colorControlHtml = (key, label, value) => {
        const notes = {
            accent: "按钮、边框和高亮的主色",
            detail: "小装饰、描边和点缀光",
            sendBase: "发送/确认按钮的底色",
            processingBase: "执行中、加载态的底色",
        };
        const swatches = [...colorPresets, "transparent"].map((color) => {
            const transparent = color === "transparent";
            const active = value.toLowerCase() === color.toLowerCase();
            return `<button class="dtm-swatch ${transparent ? "dtm-transparent-preview dtm-swatch-text" : ""}" type="button" data-local-color-preset="${escapeHtml(key)}" data-color-value="${escapeHtml(color)}" style="${transparent ? "" : `--dtm-swatch-color:${escapeHtml(color)}`}" title="${transparent ? "透明" : color}" aria-label="${transparent ? "透明" : color}" aria-pressed="${active}">${transparent ? "透明" : ""}</button>`;
        }).join("");
        const currentStyle = value === "transparent" ? "" : `--dtm-current-color:${escapeHtml(value)}`;
        return `<div class="dtm-color-field" style="${currentStyle}"><div class="dtm-color-head"><span class="dtm-color-current ${value === "transparent" ? "dtm-transparent-preview" : ""}" style="${currentStyle}"></span><span><span class="dtm-color-title">${escapeHtml(label)}</span><span class="dtm-color-note">${escapeHtml(notes[key] || "主题颜色")}</span></span><span class="dtm-color-value">${escapeHtml(value)}</span></div><div class="dtm-swatches">${swatches}</div><div class="dtm-color-actions"><label class="dtm-color-picker"><span class="dtm-color-picker-dot" style="${currentStyle}"></span><span>打开选色卡</span><input type="color" data-local-color-picker="${escapeHtml(key)}" value="${escapeHtml(colorPickerValue(value))}"></label><details class="dtm-advanced-color"><summary>高级 CSS 值</summary><input ${key === "accent" ? "data-local-theme-accent" : key === "detail" ? "data-local-theme-detail" : key === "sendBase" ? "data-local-theme-send-base" : "data-local-theme-processing-base"} value="${escapeHtml(value)}" placeholder="#6edaf2 / transparent / oklch(...)"></details></div></div>`;
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
    const themePreviewUrl = (theme) => {
        const cardPreview = safePreview(theme.cardPreview);
        if (cardPreview)
            return cardPreview;
        const direct = safePreview(theme.preview);
        if (direct)
            return direct;
        const images = Array.isArray(theme.images) ? theme.images : [];
        const active = images.find((image) => image.id === theme.defaultImage) || images[0];
        return safePreview(active?.preview);
    };
    const themePreviewHtml = (theme, scope) => {
        const preview = themePreviewUrl(theme);
        if (preview)
            return `<img src="${escapeHtml(preview)}" alt="">`;
        return `<img data-dtm-theme-preview-scope="${escapeHtml(scope)}" data-dtm-theme-preview-key="${escapeHtml(theme.key)}" alt="" hidden>${bird}`;
    };
    const cardHtml = (theme) => {
        const active = state && !state.paused && state.active?.id === theme.id;
        const meta = [theme.author, theme.version].filter(Boolean).map(escapeHtml).join(" · ");
        const petButton = theme.petId ? `<button class="dtm-bound-pet" type="button" data-theme-pet-edit="${escapeHtml(theme.key)}" data-dtm-pet-preview-pet="${escapeHtml(theme.petId)}" title="${escapeHtml(theme.petName || "")}" aria-label="编辑 ${escapeHtml(theme.name)} 的宠物"></button>` : "";
        return `<article class="dtm-card"><div class="dtm-preview">${themePreviewHtml(theme, "installed")}${petButton}</div><div class="dtm-card-body"><div class="dtm-card-line"><div class="dtm-card-main"><div class="dtm-title">${escapeHtml(theme.name)}</div><div class="dtm-row">${theme.localOnly ? '<span class="dtm-chip">仅本地</span>' : ""}${meta ? `<p>${meta}</p>` : ""}</div></div><span class="dtm-row"><button class="dtm-button" type="button" data-theme-images-edit="${escapeHtml(theme.key)}">图片</button><button class="dtm-button ${active ? "" : "dtm-button-primary"}" data-theme-use="${escapeHtml(theme.key)}" ${active ? "disabled" : ""}>${active ? "当前主题" : "启用主题"}</button></span></div></div></article>`;
    };
    const bundledCardHtml = (theme) => {
        const installed = Boolean(state?.themes?.some((item) => item.id === theme.id));
        const meta = [theme.author, theme.version].filter(Boolean).map(escapeHtml).join(" · ");
        return `<article class="dtm-card"><div class="dtm-preview">${themePreviewHtml(theme, "bundled")}${theme.petId ? `<span class="dtm-bound-pet" data-dtm-pet-preview-pet="${escapeHtml(theme.petId)}" title="${escapeHtml(theme.petName || "")}" aria-hidden="true"></span>` : ""}</div><div class="dtm-card-body"><div class="dtm-card-line"><div class="dtm-card-main"><div class="dtm-title">${escapeHtml(theme.name)}</div><div class="dtm-row">${meta ? `<p>${meta}</p>` : ""}</div></div><button class="dtm-button ${installed ? "" : "dtm-button-primary"}" data-bundled-install="${escapeHtml(theme.key)}" ${installed ? "disabled" : ""}>${installed ? "已安装" : "安装主题"}</button></div></div></article>`;
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
            ...iconSlots.map(([key]) => key),
            ...[...availableKeys].filter((key) => !iconSlots.some(([known]) => known === key)).sort(),
        ];
        const colorControls = [
            ["accent", "强调色", localAccent],
            ["detail", "细节点缀色", localDetail],
            ["sendBase", "发送按钮底色", localSendBase],
            ["processingBase", "执行/加载底色", localProcessingBase],
        ].map(([key, label, value]) => colorControlHtml(key, label, value)).join("");
        const iconLibraryOptions = `<option value="">从图标库选择…</option>${defaultIconLibrary.map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`).join("")}`;
        const iconFields = orderedKeys.map((key) => {
            const label = iconSlots.find(([known]) => known === key)?.[1] || key;
            const selectedFile = localIconFiles.get(key);
            const fromJson = localJsonIcons.has(key);
            const svg = safeIconSvg(localIconSvgs.get(key) || localJsonIcons.get(key) || baseIcons[key]);
            const fromLibrary = iconLibraryLabels.has(key);
            const source = selectedFile ? selectedFile.name : (fromJson ? `${localIconsJsonFile?.name || "icons.json"} · JSON 覆盖` : fromLibrary ? `${iconLibraryLabels.get(key)} · 图标库` : "继承基础主题");
            return `<div class="dtm-icon-field" data-icon-key="${escapeHtml(key)}" data-overridden="${Boolean(selectedFile || fromJson || fromLibrary)}"><span class="dtm-icon-preview">${svg || `<span class="dtm-icon-preview-placeholder">${escapeHtml(key.slice(0, 2).toUpperCase())}</span>`}</span><span class="dtm-icon-meta"><span class="dtm-icon-label">${escapeHtml(label)}</span><span class="dtm-icon-key">${escapeHtml(key)}</span><span class="dtm-icon-file" title="${escapeHtml(source)}">${escapeHtml(source)}</span><select data-local-icon-library="${escapeHtml(key)}" aria-label="为 ${escapeHtml(label)} 选择默认图标">${iconLibraryOptions}</select></span><span class="dtm-icon-controls"><label class="dtm-button">${selectedFile ? "更换" : "选择 SVG"}<input hidden type="file" accept=".svg,image/svg+xml" data-local-icon-file="${escapeHtml(key)}"></label>${selectedFile || fromLibrary ? `<button class="dtm-icon-remove" type="button" data-local-icon-remove="${escapeHtml(key)}" aria-label="清除 ${escapeHtml(label)}">×</button>` : ""}</span></div>`;
        }).join("");
        return `<div class="dtm-modal-layer" role="presentation"><button class="dtm-modal-backdrop" type="button" data-local-theme-close aria-label="关闭弹窗"></button><section class="dtm-dialog" role="dialog" aria-modal="true" aria-labelledby="dtm-local-title"><div class="dtm-dialog-head"><div><h2 id="dtm-local-title">本地自定义主题</h2><p>配置只保存在本机。颜色用预设色块或选色卡配置；图标可从默认库选择，也可手动添加 SVG。</p></div><button class="dtm-close-hit" type="button" data-local-theme-close aria-label="Close"></button></div><div class="dtm-dialog-body"><div class="dtm-local-form">${localDraftError ? `<div class="dtm-form-error">${escapeHtml(localDraftError)}</div>` : ""}<section class="dtm-form-section"><div class="dtm-form-section-head"><div><h3>基本信息</h3><p>填写名称、选择基础主题和背景图片。</p></div></div><div class="dtm-form-grid"><label class="dtm-field"><span>主题名称</span><input data-local-theme-name value="${escapeHtml(localThemeName)}" placeholder="例如：我的夜空"></label><label class="dtm-field"><span>基础主题</span><select data-local-theme-base aria-label="基础主题">${baseOptions}</select></label><label class="dtm-field dtm-wide"><span>背景图片</span><span class="dtm-file-box"><span class="dtm-file-name" data-local-theme-image-name>${localImageFile ? escapeHtml(localImageFile.name) : "支持 PNG、JPG、WebP、GIF，最大 16 MB"}</span><span class="dtm-file-actions"><label class="dtm-button dtm-button-primary">选择图片<input hidden type="file" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" data-local-theme-image-file></label></span></span></label></div></section><section class="dtm-form-section"><div class="dtm-form-section-head"><div><h3>主题色</h3><p>点击固定色块或透明按钮；需要精细调整时使用系统选色卡。</p></div></div><div class="dtm-color-grid">${colorControls}</div></section><section class="dtm-form-section"><div class="dtm-form-section-head"><div><h3>图标</h3><p>每项显示当前图标；可从默认图标库套用，也可上传 SVG 替换。</p></div></div><div class="dtm-manual-icon-add"><label class="dtm-field"><span>手动添加图标键</span><input data-local-new-icon-key value="${escapeHtml(localNewIconKey)}" placeholder="例如：customLogo"></label><label class="dtm-button">添加 SVG<input hidden type="file" accept=".svg,image/svg+xml" data-local-new-icon-file></label></div><div class="dtm-icon-form">${iconFields || '<div class="dtm-empty">基础主题没有可配置图标。</div>'}</div></section><section class="dtm-form-section"><div class="dtm-form-section-head"><div><h3>批量导入</h3><p>可导入完整或部分 <code>icons.json</code>，单项上传和图标库选择优先级更高。</p></div></div><span class="dtm-file-box"><span class="dtm-file-name" data-local-theme-icons-name>${localIconsJsonFile ? escapeHtml(localIconsJsonFile.name) : "导入主题包 v3 的 icons.json；可只包含需要覆盖的图标"}</span><span class="dtm-file-actions"><label class="dtm-button">选择 icons.json<input hidden type="file" accept=".json,application/json" data-local-theme-icons-file></label>${localIconsJsonFile ? '<button class="dtm-button" type="button" data-local-icons-clear>清除</button>' : ""}</span></span></section></div></div><div class="dtm-dialog-actions"><button class="dtm-button" type="button" data-local-theme-close>取消</button><button class="dtm-button dtm-button-primary" type="button" data-local-theme-create>另存为本地主题</button></div></section></div>`;
    };
    const petPickerDialogHtml = () => {
        if (!petPickerTheme)
            return "";
        const pets = (state?.pets || []).map((pet) => {
            const active = petPickerTheme?.petId === pet.id;
            return `<button class="dtm-card dtm-create-card" type="button" data-theme-pet-pick="${escapeHtml(pet.id)}" data-theme-key="${escapeHtml(petPickerTheme.key)}" aria-pressed="${active}"><div class="dtm-preview">${pet.id ? `<span class="dtm-pet-sprite" data-dtm-pet-preview-pet="${escapeHtml(pet.id)}" aria-hidden="true"></span>` : bird}</div><div class="dtm-card-body"><div class="dtm-card-line"><div class="dtm-card-main"><div class="dtm-title">${escapeHtml(pet.displayName)}</div><div class="dtm-row">${active ? '<span class="dtm-chip">当前绑定</span>' : ""}</div></div><span class="dtm-button ${active ? "" : "dtm-button-primary"}">${active ? "已选中" : "选中"}</span></div></div></button>`;
        }).join("");
        return `<div class="dtm-modal-layer" role="presentation"><button class="dtm-modal-backdrop" type="button" data-theme-pet-close aria-label="关闭弹窗"></button><section class="dtm-dialog" role="dialog" aria-modal="true" aria-labelledby="dtm-pet-title"><div class="dtm-dialog-head"><div><h2 id="dtm-pet-title">编辑主题宠物</h2><p>${escapeHtml(petPickerTheme.name)} 的宠物绑定会写入这个主题包配置。</p></div><button class="dtm-close-hit" type="button" data-theme-pet-close aria-label="Close"></button></div><div class="dtm-dialog-body">${pets ? `<div class="dtm-grid">${pets}</div>` : '<div class="dtm-empty">没有发现有效的 Codex v2 宠物包。</div>'}</div><div class="dtm-dialog-actions"><button class="dtm-button ${petPickerTheme.petId ? "dtm-button-danger" : ""}" type="button" data-theme-pet-clear="${escapeHtml(petPickerTheme.key)}" ${petPickerTheme.petId ? "" : "disabled"}>解除绑定</button><button class="dtm-button" type="button" data-theme-pet-close>取消</button></div></section></div>`;
    };
    const imageSettingsDialogHtml = () => {
        if (!imageSettingsTheme)
            return "";
        const display = imageSettingsTheme.display || {};
        const rotation = display.rotation || {};
        const images = (imageSettingsTheme.images?.length ? imageSettingsTheme.images : [{
                id: imageSettingsTheme.defaultImage || "default",
                label: "默认图",
                path: "image",
            }]).map((image) => {
            const active = (imageSettingsTheme?.defaultImage || "default") === image.id;
            const preview = safePreview(image.preview) || (active ? themePreviewUrl(imageSettingsTheme) : "") || safePreview(imageSettingsTheme?.preview || "");
            const thumb = preview ? ` style="--dtm-image-thumb:url('${escapeHtml(preview)}')"` : "";
            return `<label class="dtm-image-choice" aria-checked="${active}"><span class="dtm-image-thumb"${thumb}></span><span class="dtm-row"><input type="radio" name="dtm-default-image" value="${escapeHtml(image.id)}" ${active ? "checked" : ""}><span><span class="dtm-title">${escapeHtml(image.label || image.id)}</span><p>${escapeHtml(image.path)}</p></span></span></label>`;
        }).join("");
        const option = (value, label, current) => `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
        return `<div class="dtm-modal-layer" role="presentation"><button class="dtm-modal-backdrop" type="button" data-theme-images-close aria-label="关闭弹窗"></button><section class="dtm-dialog" role="dialog" aria-modal="true" aria-labelledby="dtm-images-title"><div class="dtm-dialog-head"><div><h2 id="dtm-images-title">主题图片</h2><p>${escapeHtml(imageSettingsTheme.name)} 的图片、显示方式和轮换配置会写入这个已安装主题。</p></div><button class="dtm-close-hit" type="button" data-theme-images-close aria-label="Close"></button></div><div class="dtm-dialog-body"><div class="dtm-local-form">${imageSettingsError ? `<div class="dtm-form-error">${escapeHtml(imageSettingsError)}</div>` : ""}<section class="dtm-form-section"><div class="dtm-form-section-head"><div><h3>图片列表</h3><p>单图也会作为图片列表中的一项显示；追加图片后可开启定时轮换。</p></div></div><div class="dtm-image-list">${images}</div><span class="dtm-file-box"><span class="dtm-file-name">${imageSettingsFiles.length ? imageSettingsFiles.map((file) => escapeHtml(file.name)).join("、") : "追加 PNG、JPG、WebP、GIF，可多选"}</span><span class="dtm-file-actions"><label class="dtm-button">追加图片<input hidden multiple type="file" accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" data-theme-images-file></label></span></span></section><section class="dtm-form-section"><div class="dtm-form-section-head"><div><h3>显示方式</h3><p>控制背景适配方式、位置和平铺；这些设置只作用于当前主题。</p></div></div><div class="dtm-form-grid"><label class="dtm-field"><span>适配</span><select data-theme-image-fit>${option("cover", "填充裁切 cover", display.fit || "cover")}${option("contain", "完整显示 contain", display.fit || "cover")}${option("stretch", "拉伸铺满 stretch", display.fit || "cover")}${option("auto", "原始尺寸 auto", display.fit || "cover")}</select></label><label class="dtm-field"><span>位置</span><select data-theme-image-position>${["auto", "center", "left", "right", "top", "bottom", "left top", "left center", "left bottom", "right top", "right center", "right bottom", "center top", "center bottom"].map((value) => option(value, value, display.position || "auto")).join("")}</select></label><label class="dtm-field"><span>平铺</span><select data-theme-image-repeat>${option("no-repeat", "不平铺", display.repeat || "no-repeat")}${option("repeat", "双向平铺", display.repeat || "no-repeat")}${option("repeat-x", "横向平铺", display.repeat || "no-repeat")}${option("repeat-y", "纵向平铺", display.repeat || "no-repeat")}</select></label><label class="dtm-field"><span>轮换间隔（秒）</span><input data-theme-image-interval type="number" min="5" max="3600" value="${escapeHtml(String(rotation.intervalSeconds || 45))}"></label><label class="dtm-field dtm-wide"><span class="dtm-row"><input data-theme-image-rotation type="checkbox" ${rotation.enabled ? "checked" : ""}> 开启多图定时轮换</span></label></div></section></div></div><div class="dtm-dialog-actions"><button class="dtm-button" type="button" data-theme-images-close>取消</button><button class="dtm-button dtm-button-primary" type="button" data-theme-images-save="${escapeHtml(imageSettingsTheme.key)}">保存图片设置</button></div></section></div>`;
    };
    const petHtml = (pet) => {
        const active = state?.selectedPet === pet.id;
        const selectable = Boolean(state?.canEnableActive);
        const chips = [`<span class="dtm-chip">宠物 v${escapeHtml(pet.spriteVersionNumber)}</span>`];
        if (pet.selectedInCodex)
            chips.push('<span class="dtm-chip">Codex 当前使用</span>');
        return `<article class="dtm-card"><div class="dtm-preview">${pet.id ? `<span class="dtm-pet-sprite" data-dtm-pet-preview-pet="${escapeHtml(pet.id)}" aria-hidden="true"></span>` : bird}</div><div class="dtm-card-body"><div class="dtm-card-line"><div class="dtm-card-main"><div class="dtm-title">${escapeHtml(pet.displayName)}</div><div class="dtm-row">${chips.join("")}</div>${pet.description ? `<p style="margin-top:8px">${escapeHtml(pet.description)}</p>` : ""}</div><button class="dtm-button ${active ? "" : "dtm-button-primary"}" data-pet-select="${escapeHtml(pet.id)}" ${active || !selectable ? "disabled" : ""}>${active ? "已绑定" : (selectable ? "绑定" : "需先启用主题")}</button></div></div></article>`;
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
        if (localModalOpen && !localBaseKey) {
            localBaseKey = state.bundledThemes?.[0]?.key || "";
            localAccent = state.bundledThemes?.[0]?.accent || localAccent;
        }
        const baseOptions = (state.bundledThemes || []).map((theme) => `<option value="${escapeHtml(theme.key)}" ${theme.key === localBaseKey ? "selected" : ""}>${escapeHtml(theme.name)}</option>`).join("");
        const themePane = `<section class="dtm-section"><h2>主题</h2><div class="dtm-grid">${themes}</div></section>`;
        const petPane = `<section class="dtm-section"><h2>主题宠物</h2><p style="margin-bottom:12px">宠物独立保存在本机。选择后只把宠物 ID 绑定到当前主题；主题卡片会直接显示绑定宠物的样子。</p>${pets ? `<div class="dtm-grid">${pets}</div><div class="dtm-row" style="margin-top:12px"><button class="dtm-button ${state.selectedPet ? "dtm-button-danger" : ""}" data-pet-clear ${state.selectedPet ? "" : "disabled"}>解除主题宠物绑定</button></div>` : '<div class="dtm-empty">没有发现有效的 Codex v2 宠物包。</div>'}</section>`;
        panel.innerHTML = `<div class="dtm-wrap"><div class="dtm-head"><div><h1>主题</h1><p>主题管理工具独立安装；主题、背景图片和可选宠物都在本页安装与启用。</p></div><div class="dtm-row"><div class="dtm-status"><span class="dtm-dot"></span>${state.paused ? "官方外观" : `当前：${escapeHtml(state.active?.name || "主题")}`} · ${state.hotReload ? "热重载已开启" : "自动刷新"}</div><button class="dtm-close-hit" type="button" data-manager-close aria-label="Close"></button></div></div><div class="dtm-row"><button class="dtm-button ${state.paused ? "dtm-button-primary" : "dtm-button-danger"}" data-official ${state.paused && !state.canEnableActive ? "disabled" : ""}>${state.paused ? (state.canEnableActive ? "启用当前主题" : "请先安装主题") : "还原官方外观"}</button><button class="dtm-button" data-refresh>立即刷新</button><p>新安装的管理工具默认保持官方外观；还原不会删除已安装主题、宠物或自定义配置。</p></div><div class="dtm-tabs" role="tablist" aria-label="主题内容"><button class="dtm-tab" role="tab" aria-selected="${activeTab === "themes"}" data-manager-tab="themes">主题</button><button class="dtm-tab" role="tab" aria-selected="${activeTab === "pets"}" data-manager-tab="pets">宠物</button></div>${activeTab === "pets" ? petPane : themePane}${message ? `<div class="dtm-message">${escapeHtml(message)}</div>` : ""}</div>${localCreatorDialogHtml(baseOptions)}${petPickerDialogHtml()}${imageSettingsDialogHtml()}`;
        applyThemePreviewImages(panel);
        applyPetPreviewStyles(panel);
    };
    const refreshState = async () => { state = await call("getState"); if (showing)
        render(); };
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
    const closeButtonFromPoint = (event) => {
        const panel = document.getElementById(PANEL_ID);
        if (!panel)
            return null;
        for (const button of Array.from(panel.querySelectorAll(".dtm-close-hit[data-manager-close],.dtm-close-hit[data-local-theme-close],.dtm-close-hit[data-theme-pet-close],.dtm-close-hit[data-theme-images-close]"))) {
            const rect = button.getBoundingClientRect();
            if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom)
                return button;
        }
        return null;
    };
    const runCloseAction = (closeTarget) => {
        if (closeTarget.hasAttribute("data-manager-close")) {
            hide();
            return true;
        }
        if (closeTarget.hasAttribute("data-local-theme-close")) {
            localModalOpen = false;
            resetLocalDraft();
            render();
            return true;
        }
        if (closeTarget.hasAttribute("data-theme-pet-close")) {
            petPickerTheme = null;
            render();
            return true;
        }
        if (closeTarget.hasAttribute("data-theme-images-close")) {
            imageSettingsTheme = null;
            imageSettingsError = "";
            imageSettingsFiles = [];
            render();
            return true;
        }
        return false;
    };
    const onPanelPointerMove = (event) => {
        const panel = document.getElementById(PANEL_ID);
        if (!panel)
            return;
        const hovered = closeButtonFromPoint(event);
        panel.querySelectorAll(".dtm-close-hit").forEach((button) => {
            button.classList.toggle("dtm-close-hover", button === hovered);
        });
    };
    const onPanelPointerLeave = () => {
        document.querySelectorAll(`#${PANEL_ID} .dtm-close-hit.dtm-close-hover`).forEach((button) => button.classList.remove("dtm-close-hover"));
    };
    const onPanelClick = (event) => {
        const pointCloseTarget = closeButtonFromPoint(event);
        if (pointCloseTarget) {
            event.preventDefault();
            event.stopPropagation();
            if (runCloseAction(pointCloseTarget))
                return;
        }
        const element = event.target;
        const closeTarget = element?.closest("[data-manager-close],[data-local-theme-close],[data-theme-pet-close],[data-theme-images-close]");
        if (closeTarget && runCloseAction(closeTarget))
            return;
        const target = element?.closest("button");
        if (!target)
            return;
        if (target.dataset.managerTab) {
            activeTab = target.dataset.managerTab === "pets" ? "pets" : "themes";
            render();
        }
        else if (target.hasAttribute("data-local-theme-open")) {
            resetLocalDraft();
            petPickerTheme = null;
            localModalOpen = true;
            render();
        }
        else if (target.dataset.themeImagesEdit) {
            imageSettingsTheme = state?.themes?.find((theme) => theme.key === target.dataset.themeImagesEdit) || null;
            imageSettingsError = "";
            imageSettingsFiles = [];
            localModalOpen = false;
            petPickerTheme = null;
            render();
            if (imageSettingsTheme?.key) {
                const key = imageSettingsTheme.key;
                call("getThemeImages", { key }).then((result) => {
                    if (!result?.images?.length || imageSettingsTheme?.key !== key)
                        return;
                    imageSettingsTheme = {
                        ...imageSettingsTheme,
                        defaultImage: result.defaultImage || imageSettingsTheme.defaultImage,
                        images: result.images,
                    };
                    render();
                }).catch(() => { });
            }
        }
        else if (target.dataset.themePetEdit) {
            petPickerTheme = state?.themes?.find((theme) => theme.key === target.dataset.themePetEdit) || null;
            localModalOpen = false;
            render();
        }
        else if (target.dataset.themePetPick) {
            const key = target.dataset.themeKey || petPickerTheme?.key || "";
            const petId = target.dataset.themePetPick || "";
            act(async () => {
                const result = await call("updateThemePet", { key, petId });
                petPickerTheme = null;
                return result;
            }, "主题宠物已更新");
        }
        else if (target.dataset.themePetClear) {
            const key = target.dataset.themePetClear || petPickerTheme?.key || "";
            act(async () => {
                const result = await call("updateThemePet", { key, petId: "" });
                petPickerTheme = null;
                return result;
            }, "主题宠物绑定已解除");
        }
        else if (target.dataset.localIconRemove) {
            preserveLocalTextFields();
            localIconFiles.delete(target.dataset.localIconRemove);
            localIconSvgs.delete(target.dataset.localIconRemove);
            iconLibraryLabels.delete(target.dataset.localIconRemove);
            localDraftError = "";
            render();
        }
        else if (target.dataset.localColorPreset) {
            preserveLocalTextFields();
            setLocalColorValue(target.dataset.localColorPreset, target.dataset.colorValue || "");
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
        else if (target.dataset.themeImagesSave) {
            const panel = document.getElementById(PANEL_ID);
            const defaultImage = panel.querySelector("input[name='dtm-default-image']:checked")?.value || imageSettingsTheme?.defaultImage || "";
            const fit = panel.querySelector("[data-theme-image-fit]")?.value || "cover";
            const position = panel.querySelector("[data-theme-image-position]")?.value || "auto";
            const repeat = panel.querySelector("[data-theme-image-repeat]")?.value || "no-repeat";
            const intervalSeconds = Number(panel.querySelector("[data-theme-image-interval]")?.value || 45);
            const rotationEnabled = Boolean(panel.querySelector("[data-theme-image-rotation]")?.checked);
            act(async () => {
                const addedImages = await Promise.all(imageSettingsFiles.map(async (file) => ({
                    name: file.name,
                    label: file.name.replace(/\.[^.]+$/, ""),
                    base64: await fileToBase64(file),
                })));
                const result = await call("updateThemeImages", {
                    key: target.dataset.themeImagesSave,
                    defaultImage,
                    addedImages,
                    display: { fit, position, repeat, rotation: { enabled: rotationEnabled, intervalSeconds } },
                });
                imageSettingsTheme = null;
                imageSettingsFiles = [];
                imageSettingsError = "";
                return result;
            }, "主题图片设置已保存");
        }
        else if (target.hasAttribute("data-local-theme-create")) {
            const panel = document.getElementById(PANEL_ID);
            const name = panel.querySelector("[data-local-theme-name]")?.value || "";
            const baseKey = panel.querySelector("[data-local-theme-base]")?.value || "";
            const imageFile = localImageFile;
            const iconsJsonFile = localIconsJsonFile;
            act(async () => {
                if (!imageFile)
                    throw new Error("请先选择一张背景图片");
                const iconOverrides = {};
                for (const [key, svg] of localIconSvgs.entries())
                    iconOverrides[key] = svg;
                const result = await call("createLocalTheme", {
                    name,
                    baseKey,
                    imageName: imageFile.name,
                    imageBase64: await fileToBase64(imageFile),
                    iconsJsonText: iconsJsonFile ? await iconsJsonFile.text() : "",
                    iconOverrides,
                    palette: {
                        accent: localAccent,
                        detail: localDetail,
                        sendBase: localSendBase,
                        processingBase: localProcessingBase,
                    },
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
    };
    const onPanelKeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ")
            return;
        const closeTarget = event.target?.closest(".dtm-close-hit[data-manager-close],.dtm-close-hit[data-local-theme-close],.dtm-close-hit[data-theme-pet-close],.dtm-close-hit[data-theme-images-close]");
        if (!closeTarget)
            return;
        event.preventDefault();
        closeTarget.click();
    };
    const onPanelChange = async (event) => {
        const input = event.target;
        if (!input)
            return;
        if (input.matches("[data-local-theme-name]"))
            localThemeName = input.value;
        else if (input.matches("[data-local-theme-base]")) {
            localBaseKey = input.value;
            const baseTheme = state?.bundledThemes?.find((theme) => theme.key === localBaseKey);
            localAccent = baseTheme?.accent || localAccent;
            localDraftError = "";
            render();
        }
        else if (input.matches("[data-local-color-picker]")) {
            preserveLocalTextFields();
            setLocalColorValue(input.dataset.localColorPicker || "", input.value);
            localDraftError = "";
            render();
        }
        else if (input.matches("[data-local-theme-accent]"))
            localAccent = input.value;
        else if (input.matches("[data-local-theme-detail]"))
            localDetail = input.value;
        else if (input.matches("[data-local-theme-send-base]"))
            localSendBase = input.value;
        else if (input.matches("[data-local-theme-processing-base]"))
            localProcessingBase = input.value;
        else if (input.matches("[data-local-new-icon-key]"))
            localNewIconKey = input.value;
        else if (input.matches("[data-local-icon-library]")) {
            preserveLocalTextFields();
            const key = input.dataset.localIconLibrary || "";
            const libraryId = input.value;
            const item = defaultIconLibrary.find(([id]) => id === libraryId);
            if (key && item) {
                localIconFiles.delete(key);
                localIconSvgs.set(key, item[2]);
                iconLibraryLabels.set(key, item[1]);
            }
            localDraftError = "";
            render();
        }
        else if (input.matches("[data-local-theme-image-file]")) {
            localImageFile = input.files?.[0] || null;
            const label = document.querySelector(`#${PANEL_ID} [data-local-theme-image-name]`);
            if (label)
                label.textContent = localImageFile?.name || "支持 PNG、JPG、WebP、GIF，最大 16 MB";
        }
        else if (input.matches("[data-theme-images-file]")) {
            imageSettingsFiles = Array.from(input.files || []).slice(0, 8);
            imageSettingsError = "";
            render();
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
                iconLibraryLabels.delete(key);
            }
            localDraftError = "";
            render();
        }
        else if (input.matches("[data-local-new-icon-file]")) {
            const file = input.files?.[0];
            if (!file)
                return;
            preserveLocalTextFields();
            const key = localNewIconKey.trim();
            const svg = safeIconSvg(await file.text());
            if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key)) {
                localDraftError = "请先填写有效图标键：字母开头，只能包含字母、数字、下划线和短横线";
                render();
                return;
            }
            if (!svg) {
                localDraftError = `${file.name} 不是有效的 SVG 图标`;
                render();
                return;
            }
            localIconFiles.set(key, file);
            localIconSvgs.set(key, svg);
            iconLibraryLabels.delete(key);
            localNewIconKey = "";
            localDraftError = "";
            render();
        }
    };
    const show = async (button, nav) => {
        const token = ++showSequence;
        showing = true;
        message = "";
        getStyle();
        setSelected(button);
        let panel = document.getElementById(PANEL_ID);
        if (!panel) {
            panel = document.createElement("section");
            panel.id = PANEL_ID;
            panel.setAttribute("aria-label", "主题");
            panel.addEventListener("click", onPanelClick, true);
            panel.addEventListener("pointermove", onPanelPointerMove, true);
            panel.addEventListener("pointerleave", onPanelPointerLeave, true);
            panel.addEventListener("keydown", onPanelKeydown);
            panel.addEventListener("change", onPanelChange);
            document.body.appendChild(panel);
        }
        positionPanel(panel, nav);
        panel.hidden = false;
        panel.innerHTML = '<div class="dtm-wrap"><div class="dtm-loading-card"><div class="dtm-loading-copy"><span class="dtm-loading-spinner" aria-hidden="true"></span><span>正在读取主题…</span></div><button class="dtm-close-hit" type="button" data-manager-close aria-label="Close"></button></div></div>';
        try {
            const nextState = await call("getState");
            if (!showing || token !== showSequence)
                return;
            state = nextState;
            render();
        }
        catch (error) {
            if (!showing || token !== showSequence)
                return;
            panel.innerHTML = `<div class="dtm-wrap"><div class="dtm-head"><div><h1>主题</h1></div><button class="dtm-close-hit" type="button" data-manager-close aria-label="Close"></button></div><div class="dtm-empty">${escapeHtml(error.message || error)}</div></div>`;
        }
    };
    const hide = () => { showSequence += 1; showing = false; localModalOpen = false; resetLocalDraft(); const panel = document.getElementById(PANEL_ID); if (panel)
        panel.hidden = true; };
    const ensure = () => {
        const nav = document.querySelector('nav[aria-label="设置"],nav[aria-label="Settings"]');
        if (!nav) {
            hide();
            return false;
        }
        let button = nav.querySelector(`button[data-settings-panel-slug="${NAV_SLUG}"]`);
        if (button && button.dataset.dreamThemeManagerVersion !== VERSION) {
            button.remove();
            button = null;
        }
        if (!button) {
            const appearance = nav.querySelector('button[data-settings-panel-slug="appearance"],button[aria-label="外观"],button[aria-label="Appearance"]');
            if (!appearance)
                return false;
            button = appearance.cloneNode(true);
            button.removeAttribute("aria-current");
            button.dataset.settingsPanelSlug = NAV_SLUG;
            button.setAttribute("aria-label", "主题");
            button.dataset.dreamThemeManagerVersion = VERSION;
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
