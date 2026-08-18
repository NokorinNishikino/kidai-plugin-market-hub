window.__ModuleLoader__.load({
	id: "kidai-plugin-market-hub",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _client_runtime = require("@deepseek-ai/dsh-client-runtime/client");
		//#region PluginMarket.module.css
		const css = ".dshm_section{width:100%;max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex}.dshm_toolbar{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.dshm_search{flex:1;min-width:200px;color:var(--dsw-alias-label-tertiary);align-items:center;display:flex;position:relative}.dshm_search>svg{pointer-events:none;position:absolute;left:12px}.dshm_search input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:36px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;padding:0 34px 0 36px;font-size:13px}.dshm_search input::placeholder{color:var(--dsw-alias-label-tertiary)}.dshm_search input:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent)}.dshm_sort{color:var(--dsw-alias-label-tertiary);align-items:center;gap:6px;font-size:12px;display:flex}.dshm_sort select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);height:32px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 8px;font-size:12px}.dshm_refresh{border:1px solid var(--dsw-alias-border-l2);background:0 0;height:32px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:8px;align-items:center;gap:6px;padding:0 10px;font-size:12px;display:flex}.dshm_refresh:hover{color:var(--dsw-alias-label-primary)}.dshm_catalogHeading{align-items:baseline;gap:7px;padding:0 2px;display:flex}.dshm_catalogHeading h3{font-size:13px;font-weight:600;line-height:20px;margin:0}.dshm_catalogHeading span{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:12px;line-height:18px}.dshm_sourceLine{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:0}.dshm_views{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:flex-end;gap:18px;display:flex}.dshm_view{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;padding:6px 1px 8px;font-size:13px;line-height:20px;position:relative}.dshm_view:hover,.dshm_view[data-active=true]{color:var(--dsw-alias-label-primary)}.dshm_view[data-active=true]:after{background:var(--dsw-alias-label-primary);content:\"\";border-radius:2px 2px 0 0;height:2px;position:absolute;bottom:-1px;left:0;right:0}.dshm_filters{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.dshm_rows{flex-direction:column;gap:8px;margin:0;padding:0;list-style:none;display:flex}.dshm_row{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;min-width:0;align-items:center;gap:12px;padding:10px 14px;display:flex}.dshm_rowText{min-width:0;flex:1;flex-direction:column;gap:2px;display:flex}.dshm_rowName{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:1.4;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.dshm_rowMeta{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums;flex-wrap:wrap;align-items:center;gap:6px;display:flex}.dshm_badgeEnabled{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 16%,transparent);color:var(--dsw-alias-state-success-primary);white-space:nowrap;align-items:center;gap:5px;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;line-height:17px;display:inline-flex}.dshm_badgeEnabled::before{background:currentColor;content:\"\";border-radius:50%;width:6px;height:6px}.dshm_badgeDisabled{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-tertiary);white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px;display:inline-flex}.dshm_rowActions{flex:none;align-items:center;gap:8px;display:flex}.dshm_rowActions button{appearance:none;font:inherit;cursor:pointer;border-radius:8px;padding:4px 12px;font-size:12px;line-height:1.5}.dshm_danger{border:1px solid var(--dsw-alias-state-error-primary);background:0 0;color:var(--dsw-alias-state-error-primary)}.dshm_danger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}.dshm_danger:disabled{cursor:default;opacity:.5}.dshm_rowHead{min-width:0;align-items:baseline;gap:8px;display:flex}.dshm_rowDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;margin:2px 0 0;-webkit-box-orient:vertical;-webkit-line-clamp:1;display:-webkit-box;overflow:hidden}.dshm_rowNarrow{padding-top:8px;padding-bottom:8px}.dshm_rowNarrow .dshm_rowName{white-space:normal;text-overflow:clip;overflow-wrap:anywhere;overflow:visible}.dshm_iconBtn{padding:5px 9px!important;align-items:center;justify-content:center;display:inline-flex}.dshm_iconBtn svg{flex:none}.dshm_viewToggle{flex:none;align-items:center;gap:4px;display:flex}.dshm_viewToggleBtn{border:1px solid var(--dsw-alias-border-l2);background:0 0;height:28px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:6px;padding:0 10px;font-size:12px}.dshm_viewToggleBtn:hover{color:var(--dsw-alias-label-primary)}.dshm_viewToggleBtn[data-active=true]{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);color:var(--dsw-alias-label-primary)}.dshm_restartBtn{border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:#fff;font:inherit;cursor:pointer;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;white-space:nowrap;line-height:1.4}.dshm_restartBtn:hover{filter:brightness(1.06)}.dshm_restartConfirm{border-color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-state-error-primary)}.dshm_settingsActions{flex:none;align-items:center;gap:8px;display:flex}.dshm_submitted{border:1px dashed var(--dsw-alias-label-dimmed);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:8px;padding:4px 12px;font-size:12px;line-height:1.5}.dshm_submitted:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-state-error-primary)}.dshm_toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:1100;max-width:min(560px,92vw);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);box-shadow:var(--dsw-shadow-lv1);border-radius:10px;padding:10px 14px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5;align-items:flex-start;gap:10px;display:flex;animation:dshm_toastIn .22s ease-out;cursor:pointer}.dshm_toastSuccess{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 50%,transparent)}.dshm_toastError{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 50%,transparent)}.dshm_toastLeaving{opacity:0;transform:translateX(-50%) translateY(-8px);transition:opacity .18s ease,transform .18s ease;animation:none}.dshm_toastIcon{border-radius:50%;width:18px;height:18px;flex:none;font-size:11px;font-weight:700;align-items:center;justify-content:center;display:flex;margin-top:2px}.dshm_toastIconOk{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 18%,transparent);color:var(--dsw-alias-state-success-primary)}.dshm_toastIconErr{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 18%,transparent);color:var(--dsw-alias-state-error-primary)}.dshm_toastText{min-width:0;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;flex:1}.dshm_toastClose{color:var(--dsw-alias-label-tertiary);flex:none;font-size:14px;line-height:16px;padding:0 2px}.dshm_toastClose:hover{color:var(--dsw-alias-label-primary)}@keyframes dshm_toastIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%)}}.dshm_scroll{max-height:62vh;overscroll-behavior:contain;overflow-y:auto;padding:2px;margin:-2px}.dshm_cards{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));align-items:start;gap:10px;margin:0;padding:0;list-style:none;display:grid}.dshm_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;min-width:0;flex-direction:column;gap:8px;padding:12px 14px;display:flex;overflow:hidden}.dshm_cardHead{min-width:0;align-items:center;gap:10px;display:flex}.dshm_icon{background:var(--dsw-alias-bg-module-platform);border-radius:8px;flex:none;object-fit:cover;width:36px;height:36px}.dshm_iconFallback{background:var(--dsw-alias-bg-module-platform);border-radius:8px;flex:none;width:36px;height:36px;color:var(--dsw-alias-label-tertiary);font-size:14px;font-weight:600;align-items:center;justify-content:center;display:flex}.dshm_cardText{min-width:0;flex:1;flex-direction:column;gap:2px;display:flex}.dshm_cardName{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:1.4;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.dshm_cardMeta{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:11px;line-height:16px}.dshm_cardDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;margin:0;-webkit-box-orient:vertical;-webkit-line-clamp:2;display:-webkit-box;overflow:hidden}.dshm_tags{flex-wrap:wrap;gap:6px;display:flex}.dshm_tag{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:10px;line-height:16px}.dshm_actions{flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:2px;display:flex}.dshm_actions button{appearance:none;font:inherit;cursor:pointer;border-radius:8px;padding:5px 12px;font-size:12px;line-height:1.5}.dshm_primary{border:1px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:#fff;border-radius:8px}.dshm_primary:hover:not(:disabled){filter:brightness(1.05)}.dshm_primary:disabled{cursor:default;opacity:.5}.dshm_ghost{border:1px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary)}.dshm_ghost:hover{color:var(--dsw-alias-label-primary)}.dshm_installed{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);border-radius:8px;padding:5px 12px;font-size:12px;display:inline-flex}.dshm_status{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;margin:0}.dshm_failure{color:var(--dsw-alias-state-error-primary);font-size:13px;align-items:center;gap:10px;margin:0;display:flex}.dshm_failure button{border:1px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:6px;padding:4px 10px}.dshm_notice{margin:0;font-size:12px;line-height:1.5;border-radius:8px;padding:8px 12px}.dshm_noticeInfo{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}.dshm_noticeSuccess{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 10%,transparent);color:var(--dsw-alias-state-success-primary)}.dshm_noticeError{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary)}.dshm_visuallyHidden{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}";
		const tagId = "kidai-plugin-market-hub/PluginMarket.module.css";
		const extraCss = ".dshm_badge{font-size:11px;line-height:16px;border-radius:999px;padding:0 7px;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);white-space:nowrap}.dshm_badgeOk{color:#2e7d32;border-color:color-mix(in srgb,#2e7d32 45%,transparent)}.dshm_badgeTier{font-variant-numeric:tabular-nums;letter-spacing:.02em}.dshm_cardTitleRow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.dshm_favBtn{border:0;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:15px;line-height:1;padding:2px 4px}.dshm_favBtn[aria-pressed=\"true\"]{color:#e8a33d}.dshm_favBtn:hover{color:var(--dsw-alias-label-primary)}.dshm_updatesBar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dshm_updatesHint{color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}.dshm_overlay{position:fixed;inset:0;background:color-mix(in srgb,#000 55%,transparent);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px}.dshm_modal{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;max-width:560px;width:100%;max-height:80vh;overflow:auto;padding:16px 18px;display:flex;flex-direction:column;gap:10px}.dshm_modalWide{max-width:820px}.dshm_modalHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.dshm_modal h3{margin:0;font-size:14px;font-weight:600}.dshm_readme{margin:0;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-primary);max-height:60vh;overflow:auto}.dshm_auditLead{color:#c0392b;font-size:12px;margin:0}.dshm_auditList{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;max-height:40vh;overflow:auto}.dshm_auditItem{display:flex;align-items:baseline;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary)}.dshm_auditItem code{font-size:11px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);padding:1px 5px;border-radius:4px;white-space:nowrap}.dshm_auditSeverity{font-size:10px;font-weight:600;border-radius:4px;padding:1px 6px;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2)}.dshm_auditSeverityBlock{color:#c0392b;border-color:#c0392b}.dshm_hubOverlay{position:fixed;inset:0;z-index:500;background:color-mix(in srgb,#000 45%,transparent);display:flex;align-items:center;justify-content:center;padding:40px 56px;box-sizing:border-box}.dshm_hubPanel{width:100%;max-width:1080px;height:min(680px,calc(100vh - 80px));background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}.dshm_hubHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l2)}.dshm_hubTitle{margin:0;font-size:17px;font-weight:600;color:var(--dsw-alias-label-primary)}.dshm_hubHeaderActions{display:flex;align-items:center;gap:12px}.dshm_hubClose{width:36px;height:36px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;padding:0}.dshm_hubClose:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary)}.dshm_hubBody{flex:1;min-height:0;overflow:auto;padding:16px 18px 24px}.dshm_hubBody .dshm_section{max-width:none}.dshm_hubToast{top:64px;z-index:1100}.dshm_hubLauncher.dshm_hubLauncher{box-sizing:border-box;height:42px;border-radius:12px;padding:0 10px 0 8px;gap:8px;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}.dshm_hubLauncher.dshm_hubLauncher:not([data-wide=\"true\"]){width:36px;height:36px;border-radius:50%;justify-content:center;gap:0;padding:0;margin:8px 0 10px}.dshm_hubLauncher.dshm_hubLauncher[data-wide=\"true\"]{width:calc(100% + 4px);margin:4px -2px;justify-content:flex-start}.dshm_hubLauncher.dshm_hubLauncher[data-wide=\"true\"]:hover{background:var(--dsw-alias-interactive-bg-hover)}.dshm_hubHeader .dshm_restartBtn{height:38px;padding:0 18px;font-size:13px;border-radius:10px}.dshm_cards{align-items:stretch}.dshm_card{min-height:168px}.dshm_cardDesc{-webkit-line-clamp:3;flex:1 1 auto}.dshm_cardHot{border-color:color-mix(in srgb,#f0a020 55%,transparent);background:linear-gradient(180deg,color-mix(in srgb,#f0a020 9%,transparent),var(--dsw-alias-bg-layer-3) 46%)}.dshm_cardHot .dshm_cardMeta{color:#e8a33d}";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "kidai-plugin-market-hub";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css + extraCss;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region wire codecs (hand-written strict schemas; zod-free by design)
		/** Validate one value; returns it unchanged on success, throws otherwise. */
		function strict(message, check) {
			return {
				parse(value) {
					if (!check(value)) throw new TypeError(message);
					return value;
				}
			};
		}
		const boolCodec = strict("expected a boolean", (value) => typeof value === "boolean");
		const stringCodec = strict("expected a string", (value) => typeof value === "string");
		const stringArrayCodec = strict("expected an array of strings", (value) => Array.isArray(value) && value.every((item) => typeof item === "string"));
		const catalogViewCodec = strict("expected a catalog view", (value) => value !== null && typeof value === "object" && Array.isArray(value.entries) && typeof value.fetchedAt === "string");
		const installedViewCodec = strict("expected an installed view", (value) => value !== null && typeof value === "object" && Array.isArray(value.dependencies) && Array.isArray(value.bundles) && typeof value.profileDir === "string");
		const installResultCodec = strict("expected an install result", (value) => value !== null && typeof value === "object" && typeof value.ok === "boolean" && typeof value.message === "string");
		const optionsCodec = strict("expected install options", (value) => value === void 0 || value === null || (typeof value === "object" && !Array.isArray(value)));
		const auditViewCodec = strict("expected an audit view", (value) => value !== null && typeof value === "object" && typeof value.blocked === "boolean" && Array.isArray(value.findings));
		const updatesViewCodec = strict("expected an updates view", (value) => value !== null && typeof value === "object" && Array.isArray(value.updates));
		const readmeViewCodec = strict("expected a readme view", (value) => value !== null && typeof value === "object" && typeof value.ok === "boolean" && typeof value.text === "string");
		/** Generated-style Remote descriptors the api-gateway client mounts. */
		const TYPERT_REMOTE = {
			package: "kidai-plugin-market-hub",
			descriptors: [
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/listPublished",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "listPublished",
					invocation: { kind: "direct" },
					parameters: [{
						name: "force",
						wire: "force",
						source: "json",
						codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#force", schema: boolCodec }
					}, {
						name: "sort",
						wire: "sort",
						source: "json",
						codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#sort", schema: stringCodec }
					}],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#CatalogView", schema: catalogViewCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/installed",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "installed",
					invocation: { kind: "direct" },
					parameters: [],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#InstalledView", schema: installedViewCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/installPlugin",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "installPlugin",
					invocation: { kind: "direct" },
					parameters: [{
						name: "spec",
						wire: "spec",
						source: "json",
						codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#spec", schema: stringCodec }
					}, {
						name: "options",
						wire: "options",
						source: "json",
						codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#options", schema: optionsCodec }
					}],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#InstallResult", schema: installResultCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/setEnabled",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "setEnabled",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "entryId",
							wire: "entryId",
							source: "json",
							codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#entryId", schema: stringCodec }
						},
						{
							name: "enabled",
							wire: "enabled",
							source: "json",
							codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#enabled", schema: boolCodec }
						}
					],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#SetEnabledResult", schema: installResultCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/openLocal",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "openLocal",
					invocation: { kind: "direct" },
					parameters: [{
						name: "packageName",
						wire: "packageName",
						source: "json",
						codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#packageName", schema: stringCodec }
					}],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#OpenLocalResult", schema: installResultCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/restartApp",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "restartApp",
					invocation: { kind: "direct" },
					parameters: [],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#RestartResult", schema: installResultCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/cancelEnabled",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "cancelEnabled",
					invocation: { kind: "direct" },
					parameters: [{
						name: "entryId",
						wire: "entryId",
						source: "json",
						codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#entryId", schema: stringCodec }
					}],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#CancelResult", schema: installResultCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/checkUpdates",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "checkUpdates",
					invocation: { kind: "direct" },
					parameters: [],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#UpdatesView", schema: updatesViewCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/updatePlugin",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "updatePlugin",
					invocation: { kind: "direct" },
					parameters: [{
						name: "packageName",
						wire: "packageName",
						source: "json",
						codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#packageName", schema: stringCodec }
					}],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#UpdateResult", schema: installResultCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/fetchReadme",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "fetchReadme",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "owner",
							wire: "owner",
							source: "json",
							codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#owner", schema: stringCodec }
						},
						{
							name: "repo",
							wire: "repo",
							source: "json",
							codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#repo", schema: stringCodec }
						}
					],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#ReadmeView", schema: readmeViewCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				},
				{
					id: "kidai-plugin-market-hub#pluginMarketHub/auditPackage",
					service: "pluginMarketHub",
					namespace: "pluginMarketHub",
					method: "auditPackage",
					invocation: { kind: "direct" },
					parameters: [{
						name: "spec",
						wire: "spec",
						source: "json",
						codec: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#spec", schema: stringCodec }
					}],
					result: { mode: "strict", typeSymbol: "kidai-plugin-market-hub#AuditView", schema: auditViewCodec },
					sourceLocation: { file: "lib/index.js", line: 1, column: 1 }
				}
			]
		};
		//#endregion
		//#region locales
		/** Dictionary namespace owned by this plugin. Unique per package: the
		* original kidai-plugin-market owns "settings.pluginMarket", so the Hub
		* must not reuse it or the second locale registration fails the entry. */
		const NS = "settings.pluginMarketHub";
		/** Simplified Chinese dictionary (key source of truth). */
		const zh = {
			tab: "插件市场",
			loading: "正在获取插件列表…",
			error: "暂时无法获取插件列表。",
			retry: "重试",
			search: "搜索插件名称或功能",
			sort: "排序",
			sortUpdated: "最近更新",
			sortStars: "星标最多",
			sortName: "名称",
			refresh: "刷新",
			catalog: "已发布的 DSH 插件",
			source: "数据来源",
			stale: "（离线缓存）",
			empty: "暂未获取到插件。",
			emptySearch: "没有匹配的插件。",
			stars: "星标",
			updated: "更新于",
			releasePage: "查看发布页",
			install: "安装到本地",
			confirmInstall: "再次点击确认安装",
			installed: "已安装",
			installing: "安装中…",
			confirmHint: "将把该插件安装到当前 DSH 配置目录，重启后生效。",
			restartHint: "安装成功，重启 DSH 后生效。",
			noHost: "当前部署没有可用的安装通道，请手动执行命令",
			linkHint: "在新窗口打开该插件的发布页。",
			viewMarket: "插件市场",
			viewInstalled: "已安装",
			filterStatus: "状态",
			statusAll: "全部",
			statusInstalled: "已安装",
			statusNotInstalled: "未安装",
			filterSource: "来源",
			sourceAll: "全部",
			sourceGithub: "GitHub",
			sourceNpm: "npm",
			installedTitle: "已安装第三方插件",
			installedEmpty: "暂无已安装的第三方插件。",
			enable: "启用",
			disable: "停用",
			openLocal: "打开本地目录",
			enabledTag: "已启用",
			disabledTag: "已停用",
			noHostManage: "当前部署没有可用的管理通道。",
			openLocalHint: "在文件管理器中打开该插件的安装目录。",
			sortTime: "按获取时间",
			sortStatus: "按状态",
			originFilter: "类型",
			originAll: "全部",
			originThirdParty: "第三方",
			originNative: "原生",
			viewWide: "宽横条",
			viewNarrow: "窄横条",
			thirdPartyTag: "第三方插件",
			nativeTag: "原生插件",
			installedAt: "获取于",
			submitted: "已提交",
			restartNow: "立即重启",
			restartConfirm: "确认重启",
			restarting: "正在重启 DSH…",
			toastClose: "关闭",
			cancelSubmit: "取消？",
			verified: "已验证",
			notVerified: "未验证",
			onlyVerified: "只看已验证",
			favorite: "收藏",
			favorited: "已收藏",
			favoritesOnly: "只看收藏",
			details: "详情",
			readmeTitle: "README",
			closeReadme: "关闭",
			readmeEmpty: "该仓库没有 README。",
			readmeOpen: "查看 README",
			auditTitle: "静态安全审计",
			auditBlocked: "审计发现高危风险，已拦截安装",
			auditFindings: "审计发现",
			auditNone: "未发现明显风险",
			auditBlock: "高危",
			auditWarn: "提示",
			stillInstall: "仍要安装，自负风险",
			cancelInstall: "取消",
			checkUpdates: "检查更新",
			update: "更新",
			updating: "更新中…",
			updatable: "可更新",
			noUpdates: "全部为最新版本",
			updateOk: "已更新，重启 DSH 后生效。",
			updateSkippedLocal: "本地源码安装，跳过",
			updateSkippedCore: "核心插件，跳过",
			cooling: "（GitHub 限流，暂用缓存）",
			backupNote: "已自动备份",
			hubButton: "纪代市场",
			hubTitle: "纪代市场",
			hubClose: "关闭"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			tab: "Plugin marketplace",
			loading: "Fetching the plugin catalog…",
			error: "The plugin catalog is temporarily unavailable.",
			retry: "Retry",
			search: "Search plugins by name or description",
			sort: "Sort",
			sortUpdated: "Recently updated",
			sortStars: "Most starred",
			sortName: "Name",
			refresh: "Refresh",
			catalog: "Published DSH plugins",
			source: "Source",
			stale: " (offline cache)",
			empty: "No plugins were fetched.",
			emptySearch: "No matching plugins.",
			stars: "stars",
			updated: "updated",
			releasePage: "Release page",
			install: "Install locally",
			confirmInstall: "Click again to confirm install",
			installed: "Installed",
			installing: "Installing…",
			confirmHint: "The plugin will be installed into the active DSH profile; it activates after a restart.",
			restartHint: "Installed — restart DSH to activate it.",
			noHost: "This deployment exposes no install channel; run the command manually",
			linkHint: "Open the plugin's release page in a new window.",
			viewMarket: "Marketplace",
			viewInstalled: "Installed",
			filterStatus: "Status",
			statusAll: "All",
			statusInstalled: "Installed",
			statusNotInstalled: "Not installed",
			filterSource: "Source",
			sourceAll: "All",
			sourceGithub: "GitHub",
			sourceNpm: "npm",
			installedTitle: "Installed third-party plugins",
			installedEmpty: "No third-party plugins are installed.",
			enable: "Enable",
			disable: "Disable",
			openLocal: "Open local folder",
			enabledTag: "Enabled",
			disabledTag: "Disabled",
			noHostManage: "This deployment exposes no management channel.",
			openLocalHint: "Open the plugin's install directory in the file manager.",
			sortTime: "By install time",
			sortStatus: "By status",
			originFilter: "Type",
			originAll: "All",
			originThirdParty: "Third-party",
			originNative: "Native",
			viewWide: "Wide rows",
			viewNarrow: "Narrow rows",
			thirdPartyTag: "Third-party plugin",
			nativeTag: "Native plugin",
			installedAt: "installed",
			submitted: "Submitted",
			restartNow: "Restart now",
			restartConfirm: "Confirm restart",
			restarting: "Restarting DSH…",
			toastClose: "Dismiss",
			cancelSubmit: "Cancel?",
			verified: "Verified",
			notVerified: "Unverified",
			onlyVerified: "Verified only",
			favorite: "Favorite",
			favorited: "Favorited",
			favoritesOnly: "Favorites only",
			details: "Details",
			readmeTitle: "README",
			closeReadme: "Close",
			readmeEmpty: "This repository has no README.",
			readmeOpen: "View README",
			auditTitle: "Static security audit",
			auditBlocked: "The audit found high-risk patterns; install was blocked",
			auditFindings: "Audit findings",
			auditNone: "No obvious risks found",
			auditBlock: "block",
			auditWarn: "warn",
			stillInstall: "Install anyway, at my own risk",
			cancelInstall: "Cancel",
			checkUpdates: "Check for updates",
			update: "Update",
			updating: "Updating…",
			updatable: "Update available",
			noUpdates: "All plugins are up to date",
			updateOk: "Updated — restart DSH to activate.",
			updateSkippedLocal: "Local source; skipped",
			updateSkippedCore: "Core plugin; skipped",
			cooling: " (GitHub rate-limited; using cache)",
			backupNote: "Auto-backup enabled",
			hubButton: "Kidai Market",
			hubTitle: "Kidai Market",
			hubClose: "Close"
		};
		//#endregion
		//#region built-in Chinese experience (offline, no LLM)
		/** Hand-curated Chinese names/descriptions for well-known plugins. */
		const ZH_NAMES = {
			"dsh-plugin-market": { name: "纪代插件市场", desc: "设置页内的插件市场：GitHub/npm 多源目录、按排序拉取、一键安装、已装管理" },
			"kidai-plugin-market-hub": { name: "纪代插件市场", desc: "设置页内的插件市场：GitHub/npm 多源目录、按排序拉取、一键安装、已装管理" },
			"dsh-novelweb": { name: "小说写作", desc: "联网续写与剧情策划的小说创作插件" },
			"dsh-config-manager": { name: "配置管理器", desc: "管理 DSH 配置文件的插件" },
			"dsh-feed": { name: "插件聚合数据", desc: "把 GitHub dsh-plugin 与 npm 归一化为开放 JSON 索引" },
			"dsh-insight": { name: "插件评测中心", desc: "需求推荐、健康评分、安全审计与安装结论" },
			"dsh-need-finder": { name: "需求导购", desc: "按自然语言需求语义匹配插件与环境配方" },
			"dsh-plugin-audit": { name: "插件生态体检", desc: "四维质量评分与安全一票否决的评分目录" },
			"dsh-plugin-recommend": { name: "插件推荐器", desc: "按需求、分类与标签搜索排序插件并给出理由" },
			"dsh-recipe": { name: "场景配方", desc: "把插件打包成可组合的环境配方" },
			"dsh-plugin-advisor": { name: "质量感知发现", desc: "零 LLM 成本的规则排序与每日全量快照" },
			"dsh-find-plugin": { name: "快速找插件", desc: "会话内按关键词搜索精选 registry 并给出安装命令" },
			"awesome-dsh": { name: "全量目录检索", desc: "2600+ 仓库的 AI 中文翻译目录与相关度检索" },
			"dsh-plugin-mall": { name: "开放式市场", desc: "GitHub 话题实时搜索、真插件验证徽章、防抢注安装" },
			"dsh-store": { name: "插件商店", desc: "npm 权威目录 + awesome 精选与 dsh 字段质量验证" },
			"dsh-plugin-panel": { name: "插件面板", desc: "语义搜索、中文翻译、收藏与完整安装生命周期" },
			"dsh-workshop": { name: "创意工坊", desc: "镜像加速、进度 UI、安全检测与中文描述的插件商店" },
			"dsh-plugin-workshop": { name: "工坊式浏览器", desc: "飙升榜、中文关键词映射、机翻与安装分级" },
			"dsh-market": { name: "插件市场", desc: "设置页内逛/搜全部社区插件,分类筛选与一键安装" },
			"dsh-extension-hub": { name: "扩展中心", desc: "技能/MCP/插件一体化管理与内置市场" },
			"dsh-mcp-market": { name: "MCP 商场", desc: "浏览并一键安装 MCP 服务器,免重启生效" },
			"dsh-plugin-manager": { name: "插件管理器", desc: "已装插件管理与启停" },
			"dsh-plugin-hub": { name: "插件面板", desc: "已装插件启停与内置市场" },
			"dsh-theme-switch": { name: "主题切换", desc: "已装皮肤一键互斥切换与官方回退" },
			"dsh-skin-manager": { name: "皮肤管理器", desc: "自动发现皮肤、独立设置页一键切换" },
			"dsh-starter-pack": { name: "精选启动包", desc: "一键批量安装并配置社区插件" },
			"dsh-forge": { name: "扩展套件", desc: "跨会话邮箱、代理团队、市场、技能管理器" },
			"dsh-subscribe": { name: "订阅式商店", desc: "Steam 风格订阅工作流与零依赖 CLI" },
			"dsh-plugin-toggle": { name: "插件启停", desc: "运行时启停、删除与持久化" },
			"plugin-switch": { name: "滑块开关", desc: "插件清单实时启停、撤销与自动备份" },
			"dsh-recipe": { name: "场景配方", desc: "插件组合成环境配方" }
		};
		/** Chinese keyword → English search terms (client-side synonym expansion). */
		const ZH_KEYWORDS = {
			"市场": "market", "商店": "store", "安装": "install", "更新": "update", "卸载": "uninstall", "卸载": "remove",
			"皮肤": "theme skin", "主题": "theme skin", "切换": "switch toggle", "技能": "skill", "搜索": "search",
			"备份": "backup", "恢复": "restore", "安全": "security audit", "审计": "audit", "评分": "score rank",
			"推荐": "recommend", "配方": "recipe", "评测": "insight review", "翻译": "translate", "收藏": "favorite",
			"邮件": "mail", "团队": "team agent", "代理": "agent", "管理": "manage manager", "启停": "toggle enable disable",
			"重启": "restart", "导入": "import", "导出": "export", "同步": "sync", "监控": "monitor"
		};
		/** Expand a query with Chinese synonyms so zh input matches en catalogs. */
		function expandQueryZh(query) {
			const q = query.trim().toLocaleLowerCase();
			if (!/[\u4e00-\u9fff]/.test(q)) return q;
			let expanded = q;
			for (const [zhWord, enWords] of Object.entries(ZH_KEYWORDS)) {
				if (q.includes(zhWord)) expanded += ` ${enWords}`;
			}
			return expanded;
		}
		/** Chinese display metadata for an entry (falls back to the raw name). */
		function zhOf(entry) {
			const meta = ZH_NAMES[entry.name] ?? (typeof entry.name === "string" ? ZH_NAMES[entry.name.toLocaleLowerCase()] : void 0);
			if (meta === void 0) return { name: entry.name, desc: entry.description ?? "" };
			return { name: meta.name, desc: meta.desc || entry.description || "" };
		}
		/** Minimal safe README rendering: escape HTML, keep line structure. */
		function renderReadmeText(text) {
			return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r\n/g, "\n");
		}
		//#endregion
		//#region browser fallback catalog (used when the host half is unavailable)
		/** Whether an npm package name follows the DSH plugin naming conventions. */
		function isPluginPackageName(name) {
			return /^dsh-plugin-/i.test(name)
				|| /^dsh-[a-z0-9]/i.test(name)
				|| /^@[^/]+\/dsh-plugin-/i.test(name)
				|| /deepseek[-_ ]?harness[-_ ]?plugin/i.test(name);
		}
		/** Normalize one npm search result into the catalog entry shape. */
		function npmBrowserEntry(pkg) {
			const links = pkg?.links ?? {};
			let repository = typeof links.repository === "string" ? links.repository : "";
			if (repository === "" && links.repository !== null && typeof links.repository === "object") repository = String(links.repository.url ?? "");
			const homepage = typeof links.homepage === "string" ? links.homepage : "";
			const githubUrl = repository !== "" && /github\.com/.test(repository) ? repository.replace(/^git\+/, "") : "";
			return {
				id: pkg.name,
				name: pkg.name,
				owner: "",
				description: typeof pkg.description === "string" ? pkg.description : "",
				iconUrl: "",
				url: githubUrl !== "" ? githubUrl : homepage !== "" ? homepage : `https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}`,
				homepage,
				topics: [],
				stars: 0,
				updatedAt: typeof pkg.date === "string" ? pkg.date : ""
			};
		}
		/** Parse awesome-dsh-plugin README bullets (`- [owner/repo](url) - desc`, incl. `#subpackage`) into browser catalog entries. */
		function parseAwesomeMarkdown(text) {
			const re = /^\s*[-*]\s+\[([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:#([A-Za-z0-9_.-]+))?\]\((https?:\/\/[^)]+)\)\s*(?:-\s*(.*))?$/;
			const entries = [];
			const seen = new Set();
			for (const line of String(text ?? "").split(/\r?\n/)) {
				const m = re.exec(line);
				if (m === null) continue;
				const [ , fullName, sub, url, description ] = m;
				const slash = fullName.indexOf("/");
				const name = typeof sub === "string" && sub.length > 0 ? sub : fullName.slice(slash + 1);
				if (name.length === 0 || seen.has(name)) continue;
				seen.add(name);
				entries.push({
					id: sub ? `${fullName}#${sub}` : fullName,
					name,
					owner: fullName.slice(0, slash),
					description: typeof description === "string" ? description.trim() : "",
					iconUrl: "",
					url,
					homepage: "",
					topics: ["awesome-dsh-plugin"],
					stars: 0,
					updatedAt: "",
					sourceTier: "AWESOME"
				});
			}
			return entries;
		}
		/** Browser-side catalog: GitHub (topic + name) then npm (several queries), merged. `sort` is `"stars"` or anything else → `"updated"` server-side; the caller re-sorts by name locally. */
		async function fetchDirectCatalog(sort) {
			const githubSort = sort === "stars" ? "stars" : "updated";
			const seen = new Set();
			const entries = [];
			const families = new Set();
			const push = (batch, kind) => {
				for (const entry of batch) if (!seen.has(entry.name)) {
					seen.add(entry.name);
					entries.push({ ...entry, kind });
				}
			};
			try {
				for (const query of ["topic%3Adsh-plugin", "dsh-plugin%20in%3Aname"]) {
					const response = await fetch(`https://api.github.com/search/repositories?q=${query}&sort=${githubSort}&order=desc&per_page=100`, {
						headers: { "Accept": "application/vnd.github+json" }
					});
					if (response.ok) {
						const data = await response.json();
						push((Array.isArray(data.items) ? data.items : []).map((repo) => ({
							id: typeof repo.full_name === "string" ? repo.full_name : String(repo.id ?? ""),
							name: typeof repo.name === "string" ? repo.name : "",
							owner: typeof repo.owner?.login === "string" ? repo.owner.login : "",
							description: typeof repo.description === "string" ? repo.description : "",
							iconUrl: typeof repo.owner?.avatar_url === "string" ? repo.owner.avatar_url : "",
							url: typeof repo.html_url === "string" ? repo.html_url : `https://github.com/${repo.full_name}`,
							homepage: typeof repo.homepage === "string" && repo.homepage.length > 0 ? repo.homepage : "",
							topics: Array.isArray(repo.topics) ? repo.topics.filter((topic) => typeof topic === "string").slice(0, 6) : [],
							stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
							updatedAt: typeof repo.updated_at === "string" ? repo.updated_at : ""
						})), "github");
						families.add("github");
					}
				}
			} catch (_githubUnavailable) { /* fall through to npm */ }
			for (const registry of ["https://registry.npmjs.org/-/v1/search", "https://registry.npmmirror.com/-/v1/search"]) {
				let got = 0;
				for (const query of ["dsh-plugin", "dsh", "deepseek-harness"]) {
					try {
						const response = await fetch(`${registry}?text=${encodeURIComponent(query)}&size=250`);
						if (!response.ok) continue;
						const data = await response.json();
						const batch = (Array.isArray(data.objects) ? data.objects : [])
							.map((item) => item?.package)
							.filter((pkg) => pkg !== null && typeof pkg?.name === "string" && isPluginPackageName(pkg.name))
							.map(npmBrowserEntry);
						got += batch.length;
						push(batch, "npm");
					} catch (_npmUnavailable) { /* try next */ }
				}
				if (got > 0) {
					families.add(registry.includes("npmmirror") ? "npm-mirror" : "npm");
					break;
				}
			}
			// awesome-dsh-plugin curated list: parse `- [owner/repo](url) - desc`
			// bullets from the community-maintained README (fail-soft).
			try {
				for (const url of [
					"https://cdn.jsdelivr.net/gh/awesome-dsh-plugin/awesome-dsh-plugin@main/README.md",
					"https://raw.githubusercontent.com/awesome-dsh-plugin/awesome-dsh-plugin/main/README.md"
				]) {
					const response = await fetch(url);
					if (!response.ok) continue;
					const batch = parseAwesomeMarkdown(await response.text());
					if (batch.length > 0) {
						push(batch, "github");
						families.add("awesome");
						break;
					}
				}
			} catch (_awesomeUnavailable) { /* optional source */ }
			if (entries.length === 0) throw new Error("catalog sources failed (github, npm)");
			return { entries, fetchedAt: new Date().toISOString(), source: [...families].join("+") };
		}
		//#endregion
		//#region PluginMarketTab
		/** One plugin card. */
		function PluginCard({ entry, t, installed, confirming, installing, onOpen, onInstall, onFavorite, favorited, onDetails }) {
			const [iconBroken, setIconBroken] = (0, react.useState)(false);
			const zh = zhOf(entry);
			const topicTags = entry.topics.length > 0 ? (0, react_jsx_runtime.jsx)("div", {
				className: "dshm_tags",
				children: entry.topics.slice(0, 4).map((topic) => (0, react_jsx_runtime.jsx)("span", { className: "dshm_tag", children: topic }, topic))
			}) : null;
			const metaParts = [];
			if (entry.stars > 0) metaParts.push(`${entry.stars.toLocaleString()} ${t("stars")}`);
			if (entry.updatedAt !== "") metaParts.push(`${t("updated")} ${String(entry.updatedAt).slice(0, 10)}`);
			const badge = entry.verified === true ? (0, react_jsx_runtime.jsx)("span", { className: "dshm_badge dshm_badgeOk", children: `✓ ${t("verified")}` }) : (0, react_jsx_runtime.jsx)("span", { className: "dshm_badge", children: t("notVerified") });
			const tier = typeof entry.sourceTier === "string" ? (0, react_jsx_runtime.jsx)("span", { className: "dshm_badge dshm_badgeTier", children: entry.sourceTier }) : null;
			const action = installed ? (0, react_jsx_runtime.jsx)("span", { className: "dshm_installed", children: t("installed") }) : (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "dshm_primary",
				disabled: installing,
				onClick: () => {
					onInstall(entry);
				},
				children: installing ? t("installing") : confirming ? t("confirmInstall") : t("install")
			});
			const iconElement = entry.iconUrl !== "" && !iconBroken ? (0, react_jsx_runtime.jsx)("img", {
				className: "dshm_icon",
				src: entry.iconUrl,
				alt: "",
				loading: "lazy",
				referrerPolicy: "no-referrer",
				onError: () => {
					setIconBroken(true);
				}
			}) : (0, react_jsx_runtime.jsx)("span", { className: "dshm_iconFallback", "aria-hidden": "true", children: String(zh.name).charAt(0).toUpperCase() });
			const hot = entry.stars >= 100;
			return (0, react_jsx_runtime.jsxs)("li", {
				className: hot ? "dshm_card dshm_cardHot" : "dshm_card",
				"data-plugin-entry": entry.id,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_cardHead",
						children: [
							iconElement,
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshm_cardText",
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dshm_cardTitleRow",
										children: [
											(0, react_jsx_runtime.jsx)("strong", { className: "dshm_cardName", title: entry.id, children: zh.name }),
											badge,
											tier
										]
									}),
									metaParts.length > 0 ? (0, react_jsx_runtime.jsx)("span", { className: "dshm_cardMeta", children: metaParts.join(" · ") }) : null
								]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm_favBtn",
								"aria-pressed": favorited,
								title: favorited ? t("favorited") : t("favorite"),
								onClick: () => {
									onFavorite(entry);
								},
								children: favorited ? "★" : "☆"
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("p", { className: "dshm_cardDesc", children: zh.desc !== "" ? zh.desc : "—" }),
					topicTags,
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_actions",
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm_ghost",
								onClick: () => {
									onDetails(entry);
								},
								children: t("readmeOpen")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm_ghost",
								title: t("linkHint"),
								onClick: () => {
									onOpen(entry);
								},
								children: t("releasePage")
							}),
							action
						]
					})
				]
			}, entry.id);
		}
		/** Deterministic letter-avatar color for installed rows without a catalog icon. */
		const LETTER_COLORS = ["#5b8def", "#7c6fe0", "#4fb3a6", "#e0963f", "#d96f8b", "#6aa84f", "#a97bd0", "#5aa7c8"];
		function letterColor(name) {
			let hash = 0;
			for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
			return LETTER_COLORS[hash % LETTER_COLORS.length];
		}
		/** Row icon: catalog avatar when available, otherwise a colored letter. */
		function RowIcon({ entry, name }) {
			const [broken, setBroken] = (0, react.useState)(false);
			if (entry?.iconUrl !== void 0 && entry.iconUrl !== "" && !broken) {
				return (0, react_jsx_runtime.jsx)("img", {
					className: "dshm_icon",
					src: entry.iconUrl,
					alt: "",
					loading: "lazy",
					referrerPolicy: "no-referrer",
					onError: () => {
						setBroken(true);
					}
				});
			}
			return (0, react_jsx_runtime.jsx)("span", {
				className: "dshm_iconFallback",
				style: { background: letterColor(name) },
				"aria-hidden": "true",
				children: String(name).charAt(0).toUpperCase()
			});
		}
		/** Top-right settings header action: restart DSH (left of the core's 打开配置文件). */
		function SettingsActions({ t, restartApp, installed }) {
			const [restartSupported, setRestartSupported] = (0, react.useState)(false);
			const [confirmRestart, setConfirmRestart] = (0, react.useState)(false);
			const [restarting, setRestarting] = (0, react.useState)(false);
			const [toast, setToast] = (0, react.useState)(null);
			const [toastLeaving, setToastLeaving] = (0, react.useState)(false);
			const toastTimer = (0, react.useRef)(null);
			const revertTimer = (0, react.useRef)(null);
			const showToast = (kind, text) => {
				setToast({ kind, text });
				setToastLeaving(false);
				if (toastTimer.current !== null) clearTimeout(toastTimer.current);
				const duration = kind === "error" ? 4500 : 2800;
				toastTimer.current = setTimeout(() => {
					setToastLeaving(true);
					toastTimer.current = setTimeout(() => setToast(null), 220);
				}, duration);
			};
			(0, react.useEffect)(() => {
				let current = true;
				installed().then((view) => {
					if (current) setRestartSupported(view.restartSupported === true);
				}, () => {
					/* keep the default (hidden) */
				});
				return () => {
					current = false;
				};
			}, [installed]);
			(0, react.useEffect)(() => () => {
				if (toastTimer.current !== null) clearTimeout(toastTimer.current);
				if (revertTimer.current !== null) clearTimeout(revertTimer.current);
			}, []);
			const onRestart = async () => {
				if (!confirmRestart) {
					setConfirmRestart(true);
					if (revertTimer.current !== null) clearTimeout(revertTimer.current);
					revertTimer.current = setTimeout(() => {
						setConfirmRestart(false);
					}, 6000);
					return;
				}
				setConfirmRestart(false);
				if (revertTimer.current !== null) clearTimeout(revertTimer.current);
				setRestarting(true);
				showToast("info", t("restarting"));
				try {
					const result = await restartApp();
					if (!result.ok) showToast("error", result.message || t("error"));
				} catch (error) {
					showToast("error", error instanceof Error ? error.message : String(error));
				} finally {
					setRestarting(false);
				}
			};
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
				children: [
					restartSupported ? (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: confirmRestart ? "dshm_restartBtn dshm_restartConfirm" : "dshm_restartBtn",
						title: t("restartHint"),
						disabled: restarting,
						onClick: () => {
							onRestart();
						},
						children: confirmRestart ? t("restartConfirm") : t("restartNow")
					}) : null,
					toast !== null ? (0, react_jsx_runtime.jsxs)("div", {
						className: `dshm_toast dshm_toast${toast.kind === "success" ? "Success" : toast.kind === "error" ? "Error" : "Info"}${toastLeaving ? " dshm_toastLeaving" : ""}`,
						role: "status",
						"aria-live": "polite",
						onClick: () => {
							setToast(null);
						},
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: toast.kind === "success" ? "dshm_toastIcon dshm_toastIconOk" : toast.kind === "error" ? "dshm_toastIcon dshm_toastIconErr" : "dshm_toastIcon",
								"aria-hidden": "true",
								children: toast.kind === "success" ? "✓" : toast.kind === "error" ? "!" : "i"
							}),
							(0, react_jsx_runtime.jsx)("span", { className: "dshm_toastText", children: toast.text }),
							(0, react_jsx_runtime.jsx)("span", { className: "dshm_toastClose", "aria-hidden": "true", children: "×" })
						]
					}) : null
				]
			});
		}
		//#region MarketHub: sidebar launcher + standalone overlay page
		/** Shared open/close store between the sidebar launcher and the overlay. */
		function createMarketHubStore() {
			return _client_runtime.defineStore({
				init: () => ({ open: false }),
				actions: {
					open: (draft) => {
						draft.open = true;
					},
					close: (draft) => {
						draft.open = false;
					}
				}
			});
		}
		/** Sidebar footer launcher, rendered above the 设置 button. */
		function MarketHubLauncher({ wide, useStore, actions, t }) {
			const open = useStore((state) => state.open);
			return (0, react_jsx_runtime.jsx)(_primitives.Tooltip, {
				label: t("hubButton"),
				delayMs: 500,
				disabled: wide,
				children: (0, react_jsx_runtime.jsx)(_primitives.Button, {
					variant: "ghost",
					className: "dshm_hubLauncher",
					"data-wide": wide,
					"aria-label": t("hubButton"),
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					icon: (0, react_jsx_runtime.jsx)(_primitives.IconCordisPluginOutline14, { size: wide ? 16 : 18 }),
					onClick: () => {
						actions.open();
					},
					children: wide ? t("hubButton") : null
				})
			});
		}
		/** Standalone full-screen hub page: header (restart + close) + the two-tab marketplace UI. */
		function MarketHubOverlay({ useStore, actions, t, restartApp, installed, listPublished, install, setEnabled, openLocal, cancelEnabled, auditPackage, checkUpdates, updatePlugin, fetchReadme }) {
			const open = useStore((state) => state.open);
			const [confirmRestart, setConfirmRestart] = (0, react.useState)(false);
			const [restarting, setRestarting] = (0, react.useState)(false);
			const [toast, setToast] = (0, react.useState)(null);
			const [toastLeaving, setToastLeaving] = (0, react.useState)(false);
			const toastTimer = (0, react.useRef)(null);
			const revertTimer = (0, react.useRef)(null);
			(0, react.useEffect)(() => () => {
				if (toastTimer.current !== null) clearTimeout(toastTimer.current);
				if (revertTimer.current !== null) clearTimeout(revertTimer.current);
			}, []);
			const showToast = (kind, text) => {
				setToast({ kind, text });
				setToastLeaving(false);
				if (toastTimer.current !== null) clearTimeout(toastTimer.current);
				const duration = kind === "error" ? 4500 : 2800;
				toastTimer.current = setTimeout(() => {
					setToastLeaving(true);
					toastTimer.current = setTimeout(() => setToast(null), 220);
				}, duration);
			};
			const onRestart = async () => {
				if (!confirmRestart) {
					setConfirmRestart(true);
					if (revertTimer.current !== null) clearTimeout(revertTimer.current);
					revertTimer.current = setTimeout(() => {
						setConfirmRestart(false);
					}, 6000);
					return;
				}
				setConfirmRestart(false);
				if (revertTimer.current !== null) clearTimeout(revertTimer.current);
				setRestarting(true);
				showToast("info", t("restarting"));
				try {
					const result = await restartApp();
					if (!result.ok) showToast("error", result.message || t("error"));
				} catch (error) {
					showToast("error", error instanceof Error ? error.message : String(error));
				} finally {
					setRestarting(false);
				}
			};
			if (!open) return null;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "dshm_hubOverlay",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_hubPanel",
						children: [
							(0, react_jsx_runtime.jsxs)("header", {
								className: "dshm_hubHeader",
								children: [
									(0, react_jsx_runtime.jsx)("h1", { className: "dshm_hubTitle", children: t("hubTitle") }),
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dshm_hubHeaderActions",
										children: [
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: confirmRestart ? "dshm_restartBtn dshm_restartConfirm" : "dshm_restartBtn",
												title: t("restartHint"),
												disabled: restarting,
												onClick: () => {
													onRestart();
												},
												children: confirmRestart ? t("restartConfirm") : t("restartNow")
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dshm_hubClose",
												"aria-label": t("hubClose"),
												title: t("hubClose"),
												onClick: () => {
													actions.close();
												},
												children: "×"
											})
										]
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: "dshm_hubBody",
								children: (0, react_jsx_runtime.jsx)(PluginMarketTab, {
									t,
									listPublished,
									installed,
									install,
									setEnabled,
									openLocal,
									cancelEnabled,
									auditPackage,
									checkUpdates,
									updatePlugin,
									fetchReadme
								})
							})
						]
					}),
					toast !== null ? (0, react_jsx_runtime.jsxs)("div", {
						className: `dshm_hubToast dshm_toast dshm_toast${toast.kind === "success" ? "Success" : toast.kind === "error" ? "Error" : "Info"}${toastLeaving ? " dshm_toastLeaving" : ""}`,
						role: "status",
						"aria-live": "polite",
						onClick: () => {
							setToast(null);
						},
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: toast.kind === "success" ? "dshm_toastIcon dshm_toastIconOk" : toast.kind === "error" ? "dshm_toastIcon dshm_toastIconErr" : "dshm_toastIcon",
								"aria-hidden": "true",
								children: toast.kind === "success" ? "✓" : toast.kind === "error" ? "!" : "i"
							}),
							(0, react_jsx_runtime.jsx)("span", { className: "dshm_toastText", children: toast.text }),
							(0, react_jsx_runtime.jsx)("span", { className: "dshm_toastClose", "aria-hidden": "true", children: "×" })
						]
					}) : null
				]
			});
		}
		//#endregion
		/** The marketplace tab: market grid + installed list, searchable/sortable/filterable. */
		function PluginMarketTab({ t, listPublished, installed, install, setEnabled, openLocal, cancelEnabled, auditPackage, checkUpdates, updatePlugin, fetchReadme }) {
			const [state, setState] = (0, react.useState)({ status: "loading" });
			const [view, setView] = (0, react.useState)("market");
			const [query, setQuery] = (0, react.useState)("");
			const [sort, setSort] = (0, react.useState)("updated");
			const [statusFilter, setStatusFilter] = (0, react.useState)("all");
			const [sourceFilter, setSourceFilter] = (0, react.useState)("all");
			const [verifyFilter, setVerifyFilter] = (0, react.useState)("all");
			const [installedSet, setInstalledSet] = (0, react.useState)(() => new Set());
			const [plugins, setPlugins] = (0, react.useState)([]);
			const [installedSort, setInstalledSort] = (0, react.useState)("time");
			const [originFilter, setOriginFilter] = (0, react.useState)("third-party");
			const [rowView, setRowView] = (0, react.useState)("wide");
			const [confirmingId, setConfirmingId] = (0, react.useState)(null);
			const [installingId, setInstallingId] = (0, react.useState)(null);
			const [togglingId, setTogglingId] = (0, react.useState)(null);
			const [doneId, setDoneId] = (0, react.useState)(null);
			const [toast, setToast] = (0, react.useState)(null);
			const [toastLeaving, setToastLeaving] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(null);
			const [request, setRequest] = (0, react.useState)(0);
			const [favorites, setFavorites] = (0, react.useState)(() => {
				try {
					const raw = window.localStorage.getItem("kidai-plugin-market-hub:favorites");
					return new Set(raw === null ? [] : JSON.parse(raw));
				} catch {
					return /* @__PURE__ */ new Set();
				}
			});
			const [favoritesOnly, setFavoritesOnly] = (0, react.useState)(false);
			const [readmeModal, setReadmeModal] = (0, react.useState)(null);
			const [auditState, setAuditState] = (0, react.useState)(null);
			const [updates, setUpdates] = (0, react.useState)(null);
			const [checkingUpdates, setCheckingUpdates] = (0, react.useState)(false);
			const [updatingId, setUpdatingId] = (0, react.useState)(null);
			const toastTimer = (0, react.useRef)(null);
			const showToast = (kind, text) => {
				setToast({ kind, text });
				setToastLeaving(false);
				if (toastTimer.current !== null) clearTimeout(toastTimer.current);
				const duration = kind === "error" ? 4500 : 2800;
				toastTimer.current = setTimeout(() => {
					setToastLeaving(true);
					toastTimer.current = setTimeout(() => setToast(null), 220);
				}, duration);
			};
			(0, react.useEffect)(() => () => {
				if (toastTimer.current !== null) clearTimeout(toastTimer.current);
			}, []);
			// Catalog: refetch from the source whenever the sort changes so the
			// server-side order (GitHub `sort=stars` vs `sort=updated`) matches
			// the selected sort, instead of re-sorting a stale snapshot.
			(0, react.useEffect)(() => {
				let current = true;
				setState({ status: "loading" });
				setNotice(null);
				listPublished({ force: false, sort }).then((catalog) => {
					if (!current) return;
					setState({ status: "ready", catalog });
				}, (error) => {
					if (!current) return;
					setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
				});
				return () => {
					current = false;
				};
			}, [listPublished, sort, request]);
			// Installed rows: stable across sort changes, fetched once.
			(0, react.useEffect)(() => {
				let current = true;
				installed().then((installedView) => {
					if (!current) return;
					setInstalledSet(new Set(installedView.dependencies));
					setPlugins(Array.isArray(installedView.plugins) ? installedView.plugins : []);
				}, (error) => {
					if (!current) return;
					setNotice(error instanceof Error ? error.message : String(error));
				});
				return () => {
					current = false;
				};
			}, [installed]);
			const normalizedQuery = expandQueryZh(query);
			const entries = (0, react.useMemo)(() => {
				if (state.status !== "ready") return [];
				const haystack = (entry) => [entry.name, entry.id, entry.description].join(" ").toLocaleLowerCase();
				let filtered = normalizedQuery.length === 0 ? state.catalog.entries : state.catalog.entries.filter((entry) => haystack(entry).includes(normalizedQuery));
				if (statusFilter === "installed") filtered = filtered.filter((entry) => installedSet.has(entry.name));
				else if (statusFilter === "not-installed") filtered = filtered.filter((entry) => !installedSet.has(entry.name));
				if (sourceFilter === "github") filtered = filtered.filter((entry) => entry.kind === "github");
				else if (sourceFilter === "npm") filtered = filtered.filter((entry) => entry.kind === "npm");
				if (verifyFilter === "verified") filtered = filtered.filter((entry) => entry.verified === true);
				if (favoritesOnly) filtered = filtered.filter((entry) => favorites.has(entry.name));
				const sorted = [...filtered];
				if (sort === "stars") sorted.sort((a, b) => b.stars - a.stars || (a.updatedAt < b.updatedAt ? 1 : -1));
				else if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
				else sorted.sort((a, b) => a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);
				return sorted;
			}, [state, normalizedQuery, sort, statusFilter, sourceFilter, verifyFilter, favoritesOnly, favorites, installedSet]);
			const catalogByName = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				if (state.status === "ready") for (const entry of state.catalog.entries) map.set(entry.name, entry);
				return map;
			}, [state]);
			const sortedPlugins = (0, react.useMemo)(() => {
				let rows = plugins;
				if (originFilter === "third-party") rows = rows.filter((plugin) => plugin.origin !== "native");
				else if (originFilter === "native") rows = rows.filter((plugin) => plugin.origin === "native");
				const sorted = [...rows];
				if (installedSort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
				else if (installedSort === "status") sorted.sort((a, b) => a.enabled === b.enabled ? a.name.localeCompare(b.name) : a.enabled ? -1 : 1);
				else sorted.sort((a, b) => (a.installedAt ?? "") < (b.installedAt ?? "") ? 1 : (a.installedAt ?? "") > (b.installedAt ?? "") ? -1 : a.name.localeCompare(b.name));
				return sorted;
			}, [plugins, originFilter, installedSort]);
			const thirdPartyCount = (0, react.useMemo)(() => plugins.reduce((count, plugin) => count + (plugin.origin !== "native" ? 1 : 0), 0), [plugins]);
			const refresh = () => {
				setRequest((value) => value + 1);
			};
			const retry = refresh;
			const openRelease = (entry) => {
				window.open(entry.url, "_blank", "noopener,noreferrer");
			};
			const onInstall = async (entry, force) => {
				if (confirmingId !== entry.id) {
					setConfirmingId(entry.id);
					showToast("info", `${t("confirmHint")} ${t("confirmInstall")}「${entry.name}」。`);
					return;
				}
				setConfirmingId(null);
				if (force !== true) {
					// Fail-closed audit gate: show the report when blocked.
					try {
						const audit = await auditPackage(entry.id);
						if (audit.blocked && audit.findings.length > 0) {
							setAuditState({ entry, findings: audit.findings });
							return;
						}
					} catch (_auditFailure) { /* proceed — the host re-audits anyway */ }
				}
				setInstallingId(entry.id);
				try {
					const result = await install(entry.id, { allowRisky: force === true });
					setInstallingId(null);
					if (result.ok) {
						showToast("success", result.message || t("restartHint"));
						refresh();
					} else if (result.auditBlocked) {
						setAuditState({ entry, findings: result.findings ?? [] });
						showToast("error", t("auditBlocked"));
					} else {
						showToast("error", result.message || t("error"));
					}
				} catch (error) {
					setInstallingId(null);
					showToast("error", error instanceof Error ? error.message : String(error));
				}
			};
			const toggleFavorite = (entry) => {
				setFavorites((prev) => {
					const next = new Set(prev);
					if (next.has(entry.name)) next.delete(entry.name);
					else next.add(entry.name);
					try {
						window.localStorage.setItem("kidai-plugin-market-hub:favorites", JSON.stringify([...next]));
					} catch { /* storage unavailable */ }
					return next;
				});
			};
			const openReadme = async (entry) => {
				setReadmeModal({ entry, text: "", loading: true });
				try {
					const view = await fetchReadme(entry.owner ?? "", entry.name);
					setReadmeModal({ entry, text: view.text ?? "", loading: false });
				} catch (error) {
					setReadmeModal({ entry, text: "", loading: false, error: error instanceof Error ? error.message : String(error) });
				}
			};
			const closeReadme = () => setReadmeModal(null);
			const runCheckUpdates = async () => {
				setCheckingUpdates(true);
				try {
					const view = await checkUpdates();
					setUpdates(view);
					if (view.updates.length === 0) showToast("success", t("noUpdates"));
				} catch (error) {
					showToast("error", error instanceof Error ? error.message : String(error));
				} finally {
					setCheckingUpdates(false);
				}
			};
			const runUpdate = async (packageName) => {
				if (updatingId !== null) return;
				setUpdatingId(packageName);
				try {
					const result = await updatePlugin(packageName);
					if (result.ok) {
						showToast("success", result.message || t("updateOk"));
						await runCheckUpdates();
					} else {
						showToast("error", result.message || t("error"));
					}
				} catch (error) {
					showToast("error", error instanceof Error ? error.message : String(error));
				} finally {
					setUpdatingId(null);
				}
			};
			const onToggle = async (plugin) => {
				if (togglingId === plugin.entryId || doneId === plugin.entryId) return;
				setTogglingId(plugin.entryId);
				try {
					const result = await setEnabled(plugin.entryId, !plugin.enabled);
					setTogglingId(null);
					if (result.ok) {
						// success: gray the button so it cannot be clicked again
						// until the deployment restarts; failure keeps it retryable
						setDoneId(plugin.entryId);
						showToast("success", result.message || t("restartHint"));
						refresh();
					} else {
						showToast("error", result.message || t("error"));
					}
				} catch (error) {
					setTogglingId(null);
					showToast("error", error instanceof Error ? error.message : String(error));
				}
			};
			const onCancelSubmit = async (plugin) => {
				try {
					const result = await cancelEnabled(plugin.entryId);
					if (result.ok) {
						setDoneId(null);
						showToast("success", result.message || t("restartHint"));
						refresh();
					} else {
						showToast("error", result.message || t("error"));
					}
				} catch (error) {
					showToast("error", error instanceof Error ? error.message : String(error));
				}
			};
			const onOpenLocal = async (plugin) => {
				try {
					const result = await openLocal(plugin.name);
					showToast(result.ok ? "success" : "error", result.message || (result.ok ? t("openLocalHint") : t("error")));
				} catch (error) {
					showToast("error", error instanceof Error ? error.message : String(error));
				}
			};
			const noticeElement = notice === null ? null : (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				className: `dshm_notice dshm_notice${notice.kind === "success" ? "Success" : notice.kind === "error" ? "Error" : "Info"}`,
				children: notice.text
			});
			const loadingElement = state.status === "loading" ? (0, react_jsx_runtime.jsx)("p", { className: "dshm_status", children: t("loading") }) : null;
			const errorElement = state.status === "error" ? (0, react_jsx_runtime.jsxs)("div", {
				className: "dshm_failure",
				children: [
					(0, react_jsx_runtime.jsx)("p", { role: "alert", children: `${t("error")}${state.error !== "" ? `（${state.error}）` : ""}` }),
					(0, react_jsx_runtime.jsx)("button", { type: "button", onClick: retry, children: t("retry") })
				]
			}) : null;
			const marketView = (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_toolbar",
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dshm_search",
								children: [
									(0, react_jsx_runtime.jsx)(_primitives.IconSearchOutline16, { "aria-hidden": "true" }),
									(0, react_jsx_runtime.jsx)("span", { className: "dshm_visuallyHidden", children: t("search") }),
									(0, react_jsx_runtime.jsx)("input", {
										type: "search",
										value: query,
										placeholder: t("search"),
										"aria-label": t("search"),
										onChange: (event) => {
											setQuery(event.currentTarget.value);
										}
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dshm_sort",
								children: [
									t("sort"),
									(0, react_jsx_runtime.jsx)("select", {
										value: sort,
										"aria-label": t("sort"),
										onChange: (event) => {
											setSort(event.currentTarget.value);
										},
										children: [
											(0, react_jsx_runtime.jsx)("option", { value: "updated", children: t("sortUpdated") }),
											(0, react_jsx_runtime.jsx)("option", { value: "stars", children: t("sortStars") }),
											(0, react_jsx_runtime.jsx)("option", { value: "name", children: t("sortName") })
										]
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm_refresh",
								onClick: refresh,
								children: [
									(0, react_jsx_runtime.jsx)(_primitives.IconRefreshOutline16, { size: 14, "aria-hidden": "true" }),
									t("refresh")
								]
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_filters",
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dshm_sort",
								children: [
									t("filterStatus"),
									(0, react_jsx_runtime.jsx)("select", {
										value: statusFilter,
										"aria-label": t("filterStatus"),
										onChange: (event) => {
											setStatusFilter(event.currentTarget.value);
										},
										children: [
											(0, react_jsx_runtime.jsx)("option", { value: "all", children: t("statusAll") }),
											(0, react_jsx_runtime.jsx)("option", { value: "installed", children: t("statusInstalled") }),
											(0, react_jsx_runtime.jsx)("option", { value: "not-installed", children: t("statusNotInstalled") })
										]
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dshm_sort",
								children: [
									t("filterSource"),
									(0, react_jsx_runtime.jsx)("select", {
										value: sourceFilter,
										"aria-label": t("filterSource"),
										onChange: (event) => {
											setSourceFilter(event.currentTarget.value);
										},
										children: [
											(0, react_jsx_runtime.jsx)("option", { value: "all", children: t("sourceAll") }),
											(0, react_jsx_runtime.jsx)("option", { value: "github", children: t("sourceGithub") }),
											(0, react_jsx_runtime.jsx)("option", { value: "npm", children: t("sourceNpm") })
										]
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dshm_sort",
								children: [
									t("onlyVerified"),
									(0, react_jsx_runtime.jsx)("select", {
										value: verifyFilter,
										"aria-label": t("onlyVerified"),
										onChange: (event) => {
											setVerifyFilter(event.currentTarget.value);
										},
										children: [
											(0, react_jsx_runtime.jsx)("option", { value: "all", children: t("statusAll") }),
											(0, react_jsx_runtime.jsx)("option", { value: "verified", children: t("verified") })
										]
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm_refresh",
								"aria-pressed": favoritesOnly,
								onClick: () => setFavoritesOnly((value) => !value),
								children: favoritesOnly ? t("favorited") : t("favorite")
							})
						]
					}),
					state.status === "ready" ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshm_catalogHeading",
								children: [
									(0, react_jsx_runtime.jsx)("h3", { children: t("catalog") }),
									(0, react_jsx_runtime.jsx)("span", { "data-plugin-count": entries.length, children: entries.length })
								]
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: "dshm_sourceLine",
								children: `${t("source")}: ${state.catalog.source}${state.catalog.stale === true ? ` ${t("stale")}` : ""}`
							}),
							state.catalog.entries.length === 0 ? (0, react_jsx_runtime.jsx)("p", { className: "dshm_status", children: t("empty") }) : null,
							state.catalog.entries.length > 0 && entries.length === 0 ? (0, react_jsx_runtime.jsx)("p", { className: "dshm_status", children: t("emptySearch") }) : null,
							entries.length > 0 ? (0, react_jsx_runtime.jsxs)("div", {
								className: "dshm_scroll",
								children: [
									(0, react_jsx_runtime.jsx)("ul", {
										className: "dshm_cards",
										children: entries.map((entry) => (0, react_jsx_runtime.jsx)(PluginCard, {
											entry,
											t,
											installed: installedSet.has(entry.name),
											confirming: confirmingId === entry.id,
											installing: installingId === entry.id,
											onOpen: openRelease,
											onInstall,
											onFavorite: toggleFavorite,
											favorited: favorites.has(entry.name),
											onDetails: openReadme
										}, entry.id))
									})
								]
							}) : null
						]
					}) : null
				]
			});
			const installedView = (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_filters",
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dshm_sort",
								children: [
									t("originFilter"),
									(0, react_jsx_runtime.jsx)("select", {
										value: originFilter,
										"aria-label": t("originFilter"),
										onChange: (event) => {
											setOriginFilter(event.currentTarget.value);
										},
										children: [
											(0, react_jsx_runtime.jsx)("option", { value: "all", children: t("originAll") }),
											(0, react_jsx_runtime.jsx)("option", { value: "third-party", children: t("originThirdParty") }),
											(0, react_jsx_runtime.jsx)("option", { value: "native", children: t("originNative") })
										]
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("label", {
								className: "dshm_sort",
								children: [
									t("sort"),
									(0, react_jsx_runtime.jsx)("select", {
										value: installedSort,
										"aria-label": t("sort"),
										onChange: (event) => {
											setInstalledSort(event.currentTarget.value);
										},
										children: [
											(0, react_jsx_runtime.jsx)("option", { value: "time", children: t("sortTime") }),
											(0, react_jsx_runtime.jsx)("option", { value: "name", children: t("sortName") }),
											(0, react_jsx_runtime.jsx)("option", { value: "status", children: t("sortStatus") })
										]
									})
								]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshm_viewToggle",
								role: "group",
								"aria-label": `${t("viewWide")}/${t("viewNarrow")}`,
								children: [
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dshm_viewToggleBtn",
										"data-active": rowView === "wide" ? "true" : void 0,
										onClick: () => {
											setRowView("wide");
										},
										children: t("viewWide")
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dshm_viewToggleBtn",
										"data-active": rowView === "narrow" ? "true" : void 0,
										onClick: () => {
											setRowView("narrow");
										},
										children: t("viewNarrow")
									})
								]
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_updatesBar",
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dshm_refresh",
								disabled: checkingUpdates,
								onClick: () => {
									runCheckUpdates();
								},
								children: checkingUpdates ? `${t("updating")}…` : t("checkUpdates")
							}),
							updates !== null && updates.updates.length > 0 ? (0, react_jsx_runtime.jsx)("span", { className: "dshm_updatesHint", children: updates.updates.map((entry) => `${entry.packageName} ${entry.current} → ${entry.latest}`).join(" · ") }) : null,
							updates !== null && updates.updates.length === 0 ? (0, react_jsx_runtime.jsx)("span", { className: "dshm_updatesHint", children: t("noUpdates") }) : null
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_catalogHeading",
						children: [
							(0, react_jsx_runtime.jsx)("h3", { children: t("installedTitle") }),
							(0, react_jsx_runtime.jsx)("span", { "data-plugin-count": sortedPlugins.length, children: sortedPlugins.length })
						]
					}),
					plugins.length === 0 ? (0, react_jsx_runtime.jsx)("p", { className: "dshm_status", children: t("installedEmpty") }) : sortedPlugins.length === 0 ? (0, react_jsx_runtime.jsx)("p", { className: "dshm_status", children: t("emptySearch") }) : (0, react_jsx_runtime.jsx)("div", {
						className: "dshm_scroll",
						children: [
							(0, react_jsx_runtime.jsx)("ul", {
								className: rowView === "wide" ? "dshm_cards" : "dshm_rows",
								children: sortedPlugins.map((plugin) => {
									const busy = togglingId === plugin.entryId;
									const done = doneId === plugin.entryId;
									const catalogEntry = catalogByName.get(plugin.name);
									const description = plugin.description !== "" ? plugin.description : (catalogEntry?.description ?? "");
									const originTag = plugin.origin === "native" ? t("nativeTag") : t("thirdPartyTag");
									const installedPart = plugin.installedAt !== "" ? ` · ${t("installedAt")} ${String(plugin.installedAt).slice(0, 10)}` : "";
									const updateInfo = updates !== null ? updates.updates.find((entry) => entry.packageName === plugin.name) : void 0;
									const updateButton = updateInfo !== void 0 ? (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dshm_primary",
										title: `${updateInfo.current} → ${updateInfo.latest}`,
										disabled: updatingId !== null,
										onClick: () => {
											runUpdate(plugin.name);
										},
										children: updatingId === plugin.name ? t("updating") : `${t("update")} ${updateInfo.latest}`
									}) : null;
									const statusBadge = (0, react_jsx_runtime.jsx)("span", {
										className: plugin.enabled ? "dshm_badgeEnabled" : "dshm_badgeDisabled",
										"data-enabled": plugin.enabled ? "true" : "false",
										children: plugin.enabled ? t("enabledTag") : t("disabledTag")
									});
									const toggleButton = done ? (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dshm_submitted",
										title: t("cancelSubmit"),
										onClick: () => {
											onCancelSubmit(plugin);
										},
										children: t("submitted")
									}) : (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: plugin.enabled ? "dshm_danger" : "dshm_primary",
										disabled: busy,
										onClick: () => {
											onToggle(plugin);
										},
										children: busy ? "…" : plugin.enabled ? t("disable") : t("enable")
									});
									const openButton = (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dshm_ghost dshm_iconBtn",
										title: t("openLocalHint"),
										"aria-label": t("openLocal"),
										onClick: () => {
											onOpenLocal(plugin);
										},
										children: (0, react_jsx_runtime.jsx)(_primitives.IconFolderOpenOutline16, { size: 14, "aria-hidden": "true" })
									});
									if (rowView === "wide") {
										// wide rows reuse the marketplace card style
										return (0, react_jsx_runtime.jsxs)("li", {
											className: "dshm_card",
											"data-plugin-name": plugin.name,
											"data-origin": plugin.origin,
											children: [
												(0, react_jsx_runtime.jsxs)("div", {
													className: "dshm_cardHead",
													children: [
														(0, react_jsx_runtime.jsx)(RowIcon, { entry: catalogEntry, name: plugin.name }),
														(0, react_jsx_runtime.jsxs)("div", {
															className: "dshm_cardText",
															children: [
																(0, react_jsx_runtime.jsx)("strong", { className: "dshm_cardName", title: plugin.path, children: plugin.name }),
																(0, react_jsx_runtime.jsx)("span", {
																	className: "dshm_cardMeta",
																	"data-origin": plugin.origin,
																	children: `${originTag}${installedPart}`
																})
															]
														}),
														statusBadge
													]
												}),
												(0, react_jsx_runtime.jsx)("p", { className: "dshm_cardDesc", children: description !== "" ? description : "—" }),
												(0, react_jsx_runtime.jsxs)("div", {
													className: "dshm_actions",
													children: [toggleButton, updateButton, openButton]
												})
											]
										}, plugin.entryId);
									}
									// narrow rows: name on its own line, meta below it
									return (0, react_jsx_runtime.jsxs)("li", {
										className: "dshm_row dshm_rowNarrow",
										"data-plugin-name": plugin.name,
										"data-origin": plugin.origin,
										children: [
											(0, react_jsx_runtime.jsx)(RowIcon, { entry: catalogEntry, name: plugin.name }),
											(0, react_jsx_runtime.jsxs)("div", {
												className: "dshm_rowText",
												children: [
													(0, react_jsx_runtime.jsx)("strong", { className: "dshm_rowName", title: plugin.path, children: plugin.name }),
													(0, react_jsx_runtime.jsxs)("span", {
														className: "dshm_rowMeta",
														"data-origin": plugin.origin,
														children: [
															statusBadge,
															(0, react_jsx_runtime.jsx)("span", { children: `${originTag}${installedPart}` })
														]
													})
												]
											}),
											(0, react_jsx_runtime.jsxs)("div", {
												className: "dshm_rowActions",
												children: [toggleButton, updateButton, openButton]
											})
										]
									}, plugin.entryId);
								})
							})
						]
					})
				]
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "dshm_section",
				"aria-busy": state.status === "loading",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_views",
						role: "tablist",
						"aria-label": t("tab"),
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								className: "dshm_view",
								"data-active": view === "market" ? "true" : void 0,
								onClick: () => {
									setView("market");
								},
								children: t("viewMarket")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								className: "dshm_view",
								"data-active": view === "installed" ? "true" : void 0,
								onClick: () => {
									setView("installed");
								},
								children: `${t("viewInstalled")}${thirdPartyCount > 0 ? ` (${thirdPartyCount})` : ""}`
							})
						]
					}),
					loadingElement,
					errorElement,
					noticeElement,
					view === "market" ? marketView : installedView,
					toast !== null ? (0, react_jsx_runtime.jsxs)("div", {
						className: `dshm_toast dshm_toast${toast.kind === "success" ? "Success" : toast.kind === "error" ? "Error" : "Info"}${toastLeaving ? " dshm_toastLeaving" : ""}`,
						role: "status",
						"aria-live": "polite",
						onClick: () => {
							setToast(null);
						},
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: toast.kind === "success" ? "dshm_toastIcon dshm_toastIconOk" : toast.kind === "error" ? "dshm_toastIcon dshm_toastIconErr" : "dshm_toastIcon",
								"aria-hidden": "true",
								children: toast.kind === "success" ? "✓" : toast.kind === "error" ? "!" : "i"
							}),
							(0, react_jsx_runtime.jsx)("span", { className: "dshm_toastText", children: toast.text }),
							(0, react_jsx_runtime.jsx)("span", { className: "dshm_toastClose", "aria-hidden": "true", children: "×" })
						]
					}) : null,
					readmeModal !== null ? (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_overlay",
						role: "dialog",
						"aria-modal": "true",
						"aria-label": t("readmeTitle"),
						onClick: closeReadme,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshm_modal dshm_modalWide",
								onClick: (event) => {
									event.stopPropagation();
								},
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dshm_modalHead",
										children: [
											(0, react_jsx_runtime.jsx)("h3", { children: `${t("readmeTitle")}: ${readmeModal.entry.name}` }),
											(0, react_jsx_runtime.jsx)("button", { type: "button", className: "dshm_ghost", onClick: closeReadme, children: t("closeReadme") })
										]
									}),
									readmeModal.loading ? (0, react_jsx_runtime.jsx)("p", { className: "dshm_status", children: t("loading") }) : readmeModal.text === "" ? (0, react_jsx_runtime.jsx)("p", { className: "dshm_status", children: t("readmeEmpty") }) : (0, react_jsx_runtime.jsx)("pre", { className: "dshm_readme", children: renderReadmeText(readmeModal.text) })
								]
							})
						]
					}) : null,
					auditState !== null ? (0, react_jsx_runtime.jsxs)("div", {
						className: "dshm_overlay",
						role: "dialog",
						"aria-modal": "true",
						"aria-label": t("auditTitle"),
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: "dshm_modal",
								children: [
									(0, react_jsx_runtime.jsx)("h3", { children: `${t("auditTitle")}: ${auditState.entry.name}` }),
									(0, react_jsx_runtime.jsx)("p", { className: "dshm_auditLead", children: t("auditBlocked") }),
									(0, react_jsx_runtime.jsx)("ul", {
										className: "dshm_auditList",
										children: auditState.findings.map((finding, index) => (0, react_jsx_runtime.jsxs)("li", {
											className: "dshm_auditItem",
											children: [
												(0, react_jsx_runtime.jsx)("span", { className: finding.severity === "block" ? "dshm_auditSeverity dshm_auditSeverityBlock" : "dshm_auditSeverity", children: finding.severity === "block" ? t("auditBlock") : t("auditWarn") }),
												(0, react_jsx_runtime.jsx)("code", { children: `${finding.file}${finding.line > 0 ? `:${finding.line}` : ""}` }),
												(0, react_jsx_runtime.jsx)("span", { children: `${finding.kind} — ${finding.evidence}` })
											]
										}, index))
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: "dshm_actions",
										children: [
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dshm_danger",
												onClick: () => {
													const entry = auditState.entry;
													setAuditState(null);
													onInstall(entry, true);
												},
												children: t("stillInstall")
											}),
											(0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dshm_ghost",
												onClick: () => {
													setAuditState(null);
												},
												children: t("cancelInstall")
											})
										]
									})
								]
							})
						]
					}) : null
				]
			});
		}
		//#endregion
		//#region index
		/**
		* Direct unary RPC against the same `/api` channel the connection uses,
		* with the identical wire envelope (`client-request` + rpcId echo). Used
		* as a fallback when the namespace layer fails in a deployment.
		* @param endpoint - `<namespace>/<method>`.
		* @param args - plain JSON arguments object.
		* @returns the dispatch envelope `{ ok, value }` or `{ ok: false, error }`.
		*/
		async function callApiDirect(endpoint, args) {
			const rpcId = `dshm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
			const response = await fetch(`/api/${endpoint}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ type: "client-request", rpcId, method: endpoint, payload: { args } })
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const full = await response.json();
			if (full === null || typeof full !== "object" || full.rpcId !== rpcId) throw new Error("rpcId mismatch or malformed response");
			return full.result;
		}
		/** Services required by the Settings registration and Remote mount. */
		const inject = ["slots", "locale", "remote"];
		/** Mount the marketplace tab and the pluginMarketHub Remote namespace. */
		async function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "kidai-plugin-market-hub: dictionaries");
			const t = ctx.locale.bind(NS);
			let mounted = false;
			try {
				await ctx.remote.$mount({ package: "kidai-plugin-market-hub", descriptors: TYPERT_REMOTE.descriptors });
				mounted = true;
			} catch (error) {
				console.error("kidai-plugin-market-hub: Remote mount failed; falling back to browser-side catalog", error);
			}
			const market = () => ctx.get("remote.pluginMarketHub");
			const listPublished = async (options) => {
				const ns = market();
				if (mounted && ns !== void 0) {
					try {
						const result = await ns.listPublished({ force: options?.force === true, sort: typeof options?.sort === "string" ? options.sort : "updated" });
						if (result.ok) return result.value;
					} catch (_transportFailure) {
						/* the host half is unavailable — fall back to the browser source below */
					}
				}
				return fetchDirectCatalog(typeof options?.sort === "string" ? options.sort : "updated");
			};
			const installed = async () => {
				const ns = market();
				if (mounted && ns !== void 0) {
					const result = await ns.installed();
					if (result.ok) return result.value;
					throw new Error(result.error?.message ?? "pluginMarketHub.installed failed");
				}
				return { dependencies: [], bundles: [], plugins: [], profileDir: "" };
			};
			const install = async (spec, options) => {
				const ns = market();
				if (mounted && ns !== void 0) {
					const result = await ns.installPlugin(spec, { allowRisky: options?.allowRisky === true });
					if (result.ok) return result.value;
					return {
						ok: false,
						packageName: spec,
						message: result.error?.message ?? "pluginMarketHub.installPlugin failed",
						restartNeeded: false,
						command: `dsh plugin add ${spec}`,
						auditBlocked: result.error?.auditBlocked === true,
						findings: result.error?.findings ?? []
					};
				}
				return {
					ok: false,
					packageName: spec,
					message: `${t("noHost")}: dsh plugin add ${spec}`,
					restartNeeded: false,
					command: `dsh plugin add ${spec}`
				};
			};
			const auditPackage = async (spec) => {
				const ns = market();
				if (mounted && ns !== void 0) {
					try {
						const result = await ns.auditPackage(spec);
						if (result.ok) return result.value;
					} catch (_auditFailure) { /* fall through */ }
				}
				return { ok: true, blocked: false, findings: [], detail: "" };
			};
			const checkUpdates = async () => {
				const ns = market();
				if (mounted && ns !== void 0) {
					try {
						const result = await ns.checkUpdates();
						if (result.ok) return result.value;
					} catch (_updatesFailure) { /* fall through */ }
				}
				return { updates: [], skipped: [] };
			};
			const updatePlugin = async (packageName) => {
				const ns = market();
				if (mounted && ns !== void 0) {
					try {
						const result = await ns.updatePlugin(packageName);
						if (result.ok) return result.value;
					} catch (error) {
						return { ok: false, packageName, message: error instanceof Error ? error.message : String(error), restartNeeded: false };
					}
				}
				return { ok: false, packageName, message: t("noHostManage"), restartNeeded: false };
			};
			const fetchReadme = async (owner, repo) => {
				const ns = market();
				if (mounted && ns !== void 0) {
					try {
						const result = await ns.fetchReadme(owner, repo);
						if (result.ok) return result.value;
					} catch (_readmeFailure) { /* fall through */ }
				}
				return { ok: false, text: "", encoding: "utf-8", url: "" };
			};
			const setEnabled = async (entryId, enabled) => {
				const errors = [];
				const ns = market();
				if (mounted && ns !== void 0) {
					try {
						const result = await ns.setEnabled(entryId, enabled);
						if (result.ok) return result.value;
						errors.push(result.error?.message ?? "pluginMarketHub.setEnabled failed");
					} catch (error) {
						errors.push(error instanceof Error ? error.message : String(error));
					}
				} else {
					errors.push(t("noHostManage"));
				}
				// Direct-channel fallback: same wire protocol the connection uses,
				// bypassing the namespace layer in case that is what fails in-app.
				try {
					const result = await callApiDirect("pluginMarketHub/setEnabled", { entryId, enabled });
					if (result.ok) return result.value;
					errors.push(result.error?.message ?? "direct pluginMarketHub.setEnabled failed");
				} catch (error) {
					errors.push(`direct: ${error instanceof Error ? error.message : String(error)}`);
				}
				return { ok: false, entryId, enabled, message: `设置失败：${errors.join("；")}`, restartNeeded: false };
			};
			const openLocal = async (packageName) => {
				const errors = [];
				const ns = market();
				if (mounted && ns !== void 0) {
					try {
						const result = await ns.openLocal(packageName);
						if (result.ok) return result.value;
						errors.push(result.error?.message ?? "pluginMarketHub.openLocal failed");
					} catch (error) {
						errors.push(error instanceof Error ? error.message : String(error));
					}
				} else {
					errors.push(t("noHostManage"));
				}
				try {
					const result = await callApiDirect("pluginMarketHub/openLocal", { packageName });
					if (result.ok) return result.value;
					errors.push(result.error?.message ?? "direct pluginMarketHub.openLocal failed");
				} catch (error) {
					errors.push(`direct: ${error instanceof Error ? error.message : String(error)}`);
				}
				return { ok: false, packageName, message: `打开本地目录失败：${errors.join("；")}`, restartNeeded: false };
			};
			const restartApp = async () => {
				const ns = market();
				if (mounted && ns !== void 0) {
					try {
						const result = await ns.restartApp();
						if (result.ok) return result.value;
						return { ok: false, restartSupported: false, message: result.error?.message ?? "pluginMarketHub.restartApp failed" };
					} catch (error) {
						return { ok: false, restartSupported: false, message: error instanceof Error ? error.message : String(error) };
					}
				}
				return { ok: false, restartSupported: false, message: t("noHostManage") };
			};
			const cancelEnabled = async (entryId) => {
				const errors = [];
				const ns = market();
				if (mounted && ns !== void 0) {
					try {
						const result = await ns.cancelEnabled(entryId);
						if (result.ok) return result.value;
						errors.push(result.error?.message ?? "pluginMarketHub.cancelEnabled failed");
					} catch (error) {
						errors.push(error instanceof Error ? error.message : String(error));
					}
				} else {
					errors.push(t("noHostManage"));
				}
				try {
					const result = await callApiDirect("pluginMarketHub/cancelEnabled", { entryId });
					if (result.ok) return result.value;
					errors.push(result.error?.message ?? "direct pluginMarketHub.cancelEnabled failed");
				} catch (error) {
					errors.push(`direct: ${error instanceof Error ? error.message : String(error)}`);
				}
				return { ok: false, entryId, message: `撤销失败：${errors.join("；")}`, restartNeeded: false };
			};
			// MarketHub entry: a launcher above the home sidebar's 设置 button
			// (sidebar.footer.action renders above sidebar.settings) that opens a
			// standalone full-screen hub page (shell.overlay) hosting the same
			// two-tab marketplace UI (插件市场 / 已安装) with restart on top.
			const hubFns = { listPublished, installed, install, setEnabled, openLocal, cancelEnabled, auditPackage, checkUpdates, updatePlugin, fetchReadme };
			const hubView = createMarketHubStore();
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "kidai-plugin-market-hub",
				order: 10,
				label: () => t("hubButton"),
				locale: NS,
				store: hubView
			}, MarketHubLauncher));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "kidai-plugin-market-hub",
				order: 10,
				locale: NS,
				store: hubView,
				inject: () => ({ ...hubFns, restartApp })
			}, MarketHubOverlay));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
