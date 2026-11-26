window.__ModuleLoader__.load({
	id: "@huliux/dsh-asr-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/assets/model-download-contract.ts
		var ModelDownloadError = class extends Error {
			constructor(code) {
				super(code);
				this.code = code;
			}
		};
		function modelProxyUrl(value) {
			try {
				if (value === void 0 || value.length > 2048) throw new Error();
				const url = new URL(value.trim());
				if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.pathname !== "/" && url.pathname !== "" || url.search || url.hash) throw new Error();
				return url.href;
			} catch {
				throw new ModelDownloadError("MODEL_PROXY_INVALID");
			}
		}
		//#endregion
		//#region src/client/recording-rpc-transport.ts
		const READ_ENDPOINTS = new Set([
			"state",
			"models/status",
			"models/download/status",
			"permissions/status"
		]);
		const RETRY_MS = 250;
		const MAX_RETRIES = 20;
		async function callRecordingRpc(rpc, endpoint, payload, signal) {
			const method = `dsh-asr-recording/${endpoint}`;
			for (let attempt = 0;; attempt++) {
				signal?.throwIfAborted();
				try {
					return await rpc.call("/api", method, payload, signal);
				} catch (cause) {
					if (signal?.aborted || attempt >= MAX_RETRIES || !READ_ENDPOINTS.has(endpoint) || !(cause instanceof Error) || ![404, 405].some((status) => cause.message === `transport failure for /api/${method}: HTTP ${status}`)) throw cause;
					await waitForRoute(signal);
				}
			}
		}
		function waitForRoute(signal) {
			return new Promise((resolve, reject) => {
				const aborted = () => {
					clearTimeout(timer);
					reject(signal?.reason);
				};
				const timer = setTimeout(() => {
					signal?.removeEventListener("abort", aborted);
					resolve();
				}, RETRY_MS);
				signal?.addEventListener("abort", aborted, { once: true });
				if (signal?.aborted) aborted();
			});
		}
		//#endregion
		//#region src/client/model-download-client.ts
		async function readDownloadStatus(rpc, signal) {
			const response = await callRecordingRpc(rpc, "models/download/status", {}, signal);
			if (!response.ok || typeof response.value !== "object" || response.value === null) throw new Error("INVALID_RESPONSE");
			const value = response.value;
			if (![
				"idle",
				"downloading",
				"verifying",
				"installing",
				"completed",
				"failed",
				"cancelled"
			].includes(String(value.phase)) || value.pack !== null && ![
				"base",
				"parakeet",
				"punctuation"
			].includes(String(value.pack)) || value.jobId !== null && typeof value.jobId !== "string" || value.errorCode !== null && typeof value.errorCode !== "string" || !Number.isSafeInteger(value.downloadedBytes) || !Number.isSafeInteger(value.totalBytes) || Number(value.downloadedBytes) < 0 || Number(value.totalBytes) < Number(value.downloadedBytes)) throw new Error("INVALID_RESPONSE");
			return {
				phase: value.phase,
				pack: value.pack,
				downloadedBytes: Number(value.downloadedBytes),
				totalBytes: Number(value.totalBytes),
				jobId: value.jobId,
				errorCode: value.errorCode
			};
		}
		async function saveDownloadSettings(form, route, proxy, revision, kind) {
			let proxyUrl = proxy.trim();
			try {
				if (route === "proxy" && kind !== "mirror" || proxyUrl !== "") proxyUrl = modelProxyUrl(proxyUrl);
			} catch {
				return "invalid";
			}
			const changes = [{
				op: "set",
				path: ["hf_download_route"],
				value: route
			}, {
				op: "set",
				path: ["hf_proxy_url"],
				value: proxyUrl
			}];
			if (kind !== void 0) changes.push({
				op: "set",
				path: ["hf_proxy_kind"],
				value: kind
			});
			return await form.mutate(changes, revision) ? "saved" : "conflict";
		}
		async function startModelDownload(rpc, form, pack, draft, onSaved) {
			if (draft !== null) {
				if (form === void 0) return "conflict";
				const saved = await saveDownloadSettings(form, draft.route, draft.proxy, draft.revision, draft.kind);
				if (saved !== "saved") return saved;
				onSaved?.();
			}
			const response = await callRecordingRpc(rpc, "models/download/start", { pack });
			return response.ok ? "started" : response.error.message === "MODEL_PROXY_INVALID" ? "invalid" : "failed";
		}
		//#endregion
		//#region src/client/ModelSettingsPage.module.css
		var ModelSettingsPage_module_default = {
			"card": "_2-6Zyq_card",
			"command": "_2-6Zyq_command",
			"connectionSummary": "_2-6Zyq_connectionSummary",
			"description": "_2-6Zyq_description",
			"diagnosticGroup": "_2-6Zyq_diagnosticGroup",
			"diagnosticGroups": "_2-6Zyq_diagnosticGroups",
			"diagnostics": "_2-6Zyq_diagnostics",
			"downloadActions": "_2-6Zyq_downloadActions",
			"downloadProgress": "_2-6Zyq_downloadProgress",
			"downloadRouting": "_2-6Zyq_downloadRouting",
			"error": "_2-6Zyq_error",
			"heading": "_2-6Zyq_heading",
			"helpHeading": "_2-6Zyq_helpHeading",
			"instructions": "_2-6Zyq_instructions",
			"label": "_2-6Zyq_label",
			"loading": "_2-6Zyq_loading",
			"modelBlock": "_2-6Zyq_modelBlock",
			"modelCopy": "_2-6Zyq_modelCopy",
			"modelRow": "_2-6Zyq_modelRow",
			"modelTitle": "_2-6Zyq_modelTitle",
			"notice": "_2-6Zyq_notice",
			"page": "_2-6Zyq_page",
			"preparationSteps": "_2-6Zyq_preparationSteps",
			"progressBytes": "_2-6Zyq_progressBytes",
			"progressHeading": "_2-6Zyq_progressHeading",
			"proxyOptions": "_2-6Zyq_proxyOptions",
			"runtimeRow": "_2-6Zyq_runtimeRow",
			"saveRow": "_2-6Zyq_saveRow",
			"title": "_2-6Zyq_title"
		};
		//#endregion
		//#region src/client/ModelDownloadSettings.tsx
		const busy = (state) => state !== null && [
			"downloading",
			"verifying",
			"installing"
		].includes(state.phase);
		const mib = (value) => `${(value / 1048576).toFixed(1)} MiB`;
		function useDownloadPolling(rpc, onInstalled, setStatus) {
			const [readFailed, setReadFailed] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				let timer;
				let completed = null;
				const poll = async () => {
					try {
						const next = await readDownloadStatus(rpc, controller.signal);
						if (controller.signal.aborted) return;
						setStatus(next);
						setReadFailed(false);
						if (next.phase === "completed" && completed !== next.jobId) {
							completed = next.jobId;
							onInstalled();
						}
					} catch {
						if (!controller.signal.aborted) setReadFailed(true);
					}
					if (!controller.signal.aborted) timer = setTimeout(() => {
						poll();
					}, 1e3);
				};
				poll();
				return () => {
					controller.abort();
					clearTimeout(timer);
				};
			}, [rpc, onInstalled]);
			return readFailed;
		}
		function useDownloadSettings({ form, rpc, onInstalled }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)(null);
			const [saving, setSaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const value = form?.state.value;
			const acceptedProxy = value?.hf_download_route !== "direct" && value?.hf_proxy_kind !== "mirror" && typeof value?.hf_proxy_url === "string" ? value.hf_proxy_url : "";
			const proxy = draft?.proxy ?? acceptedProxy;
			const writable = form?.state.writable === true && form.state.status === "ready";
			const readFailed = useDownloadPolling(rpc, onInstalled, setStatus);
			const edit = (next) => {
				if (form?.state.revision === void 0) return;
				setError((current) => current === "proxyInvalid" ? null : current);
				const candidate = {
					route: "default",
					proxy,
					kind: "http",
					revision: draft?.revision ?? form.state.revision,
					...next
				};
				setDraft(candidate.proxy.trim() === acceptedProxy.trim() ? null : candidate);
			};
			const save = async () => {
				if (draft === null || form === void 0) return;
				setSaving(true);
				setError(null);
				try {
					const result = await saveDownloadSettings(form, draft.route, draft.proxy, draft.revision, draft.kind);
					if (result === "saved") setDraft(null);
					else setError(result === "invalid" ? "proxyInvalid" : "conflict");
				} catch {
					setError("conflict");
				} finally {
					setSaving(false);
				}
			};
			const { acting, act } = useDownloadActions({
				rpc,
				form,
				draft,
				setDraft,
				setStatus,
				setError
			});
			const active = busy(status);
			return {
				status,
				proxy,
				writable,
				draft,
				saving,
				acting,
				error: error ?? (readFailed ? "downloadFailed" : null),
				active,
				edit,
				save,
				act
			};
		}
		function useDownloadActions({ rpc, form, draft, setDraft, setStatus, setError }) {
			const [acting, setActing] = (0, react.useState)(false);
			const act = async (action, pack) => {
				setActing(true);
				setError(null);
				try {
					if (action === "start" && pack !== void 0) {
						const result = await startModelDownload(rpc, form, pack, draft, () => setDraft(null));
						if (result !== "started") {
							setError(result === "invalid" ? "proxyInvalid" : result === "conflict" ? "conflict" : "downloadFailed");
							return;
						}
						setDraft(null);
					} else if (!(await callRecordingRpc(rpc, "models/download/cancel", {})).ok) setError("downloadFailed");
					setStatus(await readDownloadStatus(rpc));
				} catch {
					setError("downloadFailed");
				} finally {
					setActing(false);
				}
			};
			return {
				acting,
				act
			};
		}
		function ModelDownloadSettings(props) {
			const { form, t, models } = props;
			const state = useDownloadSettings(props);
			const [proxyOpen, setProxyOpen] = (0, react.useState)(false);
			const { writable, status, active, acting, saving, act, error } = state;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ModelSettingsPage_module_default.card,
				"aria-label": t("assets"),
				children: [
					[
						"base",
						"parakeet",
						"punctuation"
					].map((pack) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelSettingsPage_module_default.modelBlock,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelSettingsPage_module_default.modelRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelSettingsPage_module_default.modelCopy,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ModelSettingsPage_module_default.modelTitle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ModelSettingsPage_module_default.label,
										children: t(pack)
									}), models !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
										tone: models[pack].state === "ready" ? "success" : models[pack].state === "invalid" ? "danger" : "neutral",
										children: t(models[pack].state)
									}) : null]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: ModelSettingsPage_module_default.description,
									children: [
										t(`${pack}Description`),
										" · ",
										t(`${pack}Size`)
									]
								})]
							}), models?.[pack].state !== "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: pack === "base" ? "primary" : "outline",
								"aria-label": t(pack === "base" ? "downloadBase" : pack === "parakeet" ? "downloadParakeet" : "downloadPunctuation"),
								disabled: !writable || status === null || active || acting || saving || models === null,
								onClick: () => {
									act("start", pack);
								},
								children: t(models?.[pack].state === "invalid" ? "repair" : "download")
							}) : null]
						}), status?.pack === pack && (models?.[pack].state !== "ready" || active || status.phase === "completed") ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DownloadProgress, {
							status,
							t,
							cancel: active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								variant: "ghost",
								disabled: acting,
								onClick: () => {
									act("cancel");
								},
								children: t("cancelDownload")
							}) : null,
							recovery: status.phase === "failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelSettingsPage_module_default.downloadActions,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									variant: "outline",
									disabled: !writable || saving || acting,
									onClick: () => {
										act("start", pack);
									},
									children: t("retry")
								}), status.errorCode === "MODEL_DOWNLOAD_PROXY_REQUIRED" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => setProxyOpen(true),
									children: t("configureProxy")
								}) : null]
							}) : null
						}) : null]
					}, pack)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelSettingsPage_module_default.runtimeRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelSettingsPage_module_default.description,
							children: t("native")
						}), models !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							tone: models.native.state === "ready" ? "success" : "danger",
							children: t(models.native.state)
						}) : null]
					}),
					models !== null && !models.selectedReady ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: ModelSettingsPage_module_default.notice,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "warning" }), t("blocked")]
					}) : null,
					error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelSettingsPage_module_default.error,
						role: "status",
						children: t(error)
					}) : null
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DownloadRoute, {
				form,
				t,
				state,
				open: proxyOpen,
				onToggle: () => setProxyOpen((value) => !value)
			})] });
		}
		function DownloadRoute({ form, t, state, open, onToggle }) {
			const { writable, draft, saving, save, proxy, active, acting, edit, status, act } = state;
			const retry = status?.phase === "failed" && status.errorCode === "MODEL_DOWNLOAD_PROXY_REQUIRED" && status.pack !== null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: ModelSettingsPage_module_default.card,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInfoOutlineRegular, {}),
					title: `${t("connectionSettings")}${draft !== null ? ` · ${t("unsaved")}` : ""}`,
					open,
					expandable: true,
					expandOnRowClick: true,
					onToggle,
					collapsedContent: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ModelSettingsPage_module_default.connectionSummary,
						children: t(proxy.trim() ? "configured" : "notConfigured")
					}),
					children: [
						form?.state.status !== "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ModelSettingsPage_module_default.notice,
							children: t("unavailable")
						}) : !writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ModelSettingsPage_module_default.notice,
							children: t("readOnly")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelSettingsPage_module_default.downloadRouting,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: ModelSettingsPage_module_default.downloadRouting,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("proxyAddress") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
									value: proxy,
									placeholder: "http://127.0.0.1:7890",
									autoComplete: "off",
									spellCheck: false,
									disabled: !writable || saving || acting || active,
									onChange: (event) => edit({ proxy: event.target.value })
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ModelSettingsPage_module_default.description,
								children: t("proxyHint")
							})]
						}),
						draft !== null || retry ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ModelSettingsPage_module_default.saveRow,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								disabled: !writable || saving || acting || active,
								onClick: () => {
									if (retry && status?.pack) act("start", status.pack);
									else save();
								},
								children: t(saving || acting ? "saving" : retry ? "saveRetry" : "save")
							})
						}) : null
					]
				})
			});
		}
		function DownloadProgress({ status, t, cancel, recovery }) {
			const active = busy(status);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: status !== null && status.phase !== "idle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ModelSettingsPage_module_default.downloadProgress,
				role: "status",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelSettingsPage_module_default.progressHeading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: active ? "ongoing" : status.phase === "failed" ? "error" : "idle" }), t(status.phase === "failed" ? "downloadErrorTitle" : status.phase)] }), cancel]
					}),
					status.phase === "downloading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("progress", {
						"aria-label": t("downloading"),
						value: status.totalBytes > 0 ? status.downloadedBytes : void 0,
						max: status.totalBytes || 1
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: ModelSettingsPage_module_default.progressBytes,
						children: [
							mib(status.downloadedBytes),
							" / ",
							mib(status.totalBytes),
							status.totalBytes > 0 ? ` · ${Math.floor(status.downloadedBytes * 100 / status.totalBytes)}%` : ""
						]
					})] }) : null,
					status.phase === "failed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelSettingsPage_module_default.description,
						children: t(downloadFailureKey(status.errorCode))
					}), recovery] }) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreparationSteps, {
						status,
						t
					})
				]
			}) : null });
		}
		function downloadFailureKey(code) {
			if (code === "MODEL_DOWNLOAD_PROXY_REQUIRED") return "proxyRequired";
			if (code === "MODEL_DOWNLOAD_SOURCE_UNAVAILABLE") return "sourceUnavailable";
			if (code === "MODEL_DOWNLOAD_DISK_FULL") return "diskFull";
			if ([
				"MODEL_DOWNLOAD_STORAGE_DENIED",
				"MODEL_DOWNLOAD_WRITE_FAILED",
				"ASSET_PATH_INVALID"
			].includes(code ?? "")) return "storageFailed";
			if ([
				"MODEL_DOWNLOAD_HASH_MISMATCH",
				"MODEL_DOWNLOAD_SIZE_MISMATCH",
				"MODEL_DOWNLOAD_TOO_LARGE",
				"ASSET_HASH_MISMATCH",
				"ASSET_SIZE_MISMATCH"
			].includes(code ?? "")) return "verificationFailed";
			return "downloadFailed";
		}
		function PreparationSteps({ status, t }) {
			const phases = [
				"downloading",
				"verifying",
				"installing"
			];
			const index = status.phase === "completed" ? phases.length : phases.findIndex((phase) => phase === status.phase);
			if (index < 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
				className: ModelSettingsPage_module_default.preparationSteps,
				"aria-label": t("preparationSteps"),
				children: phases.map((phase, step) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
					appearance: "step",
					size: 16,
					state: step < index ? "done" : step === index ? "ongoing" : "idle"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(phase === "downloading" ? "prepareDownload" : phase === "verifying" ? "prepareVerify" : "prepareInstall") })] }, phase))
			});
		}
		//#endregion
		//#region src/recording/permission-contract.ts
		function parseRecordingPermissions(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_RESPONSE");
			const item = value;
			if (Object.keys(item).length !== 2 || typeof item.microphone !== "string" || typeof item.system !== "string" || ![
				"granted",
				"denied",
				"restricted",
				"notDetermined"
			].includes(item.microphone) || ![
				"verified",
				"unverified",
				"unsupported"
			].includes(item.system)) throw new Error("INVALID_RESPONSE");
			return item;
		}
		//#endregion
		//#region src/client/RecordingPermissionSettings.tsx
		async function permissions(rpc, test, signal) {
			const response = await callRecordingRpc(rpc, test ? "permissions/test" : "permissions/status", {}, signal);
			if (!response.ok) throw new Error("PERMISSION_CHECK_FAILED");
			return parseRecordingPermissions(response.value);
		}
		function RecordingPermissionSettings({ rpc, t }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(false);
			const [test, setTest] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				setBusy(true);
				permissions(rpc, test > 0, controller.signal).then((value) => {
					if (!controller.signal.aborted) {
						setStatus(value);
						setError(false);
						setBusy(false);
					}
				}, () => {
					if (!controller.signal.aborted) {
						setError(true);
						setBusy(false);
					}
				});
				return () => controller.abort();
			}, [rpc, test]);
			async function open(track) {
				try {
					if (!(await callRecordingRpc(rpc, "permissions/open-settings", { track })).ok) setError(true);
				} catch {
					setError(true);
				}
			}
			const micReady = status?.microphone === "granted";
			const systemReady = status?.system === "verified";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ModelSettingsPage_module_default.card,
				"aria-label": t("permissions"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelSettingsPage_module_default.heading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: ModelSettingsPage_module_default.title,
							children: t("permissions")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: busy,
							onClick: () => setTest((value) => value + 1),
							children: t(busy ? "permissionChecking" : "permissionTest")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelSettingsPage_module_default.description,
						children: t("permissionHint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelSettingsPage_module_default.diagnosticGroups,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelSettingsPage_module_default.modelRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("microphone") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: micReady ? "done" : "warning" }),
									" ",
									t(micReady ? "permissionAllowed" : status === null ? "permissionUnknown" : "permissionNeeded")
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => void open("microphone"),
									children: t("openMicSettings")
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ModelSettingsPage_module_default.modelRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("systemAudio") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: systemReady ? "done" : "warning" }),
									" ",
									t(systemReady ? "permissionVerified" : status?.system === "unsupported" ? "permissionUnsupported" : test > 0 && status !== null ? "permissionUnverified" : "permissionUnknown")
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => void open("system"),
									children: t("openSystemSettings")
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelSettingsPage_module_default.description,
						children: t("permissionSettingsHint")
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelSettingsPage_module_default.error,
						role: "alert",
						children: t("permissionFailed")
					})
				]
			});
		}
		//#endregion
		//#region src/client/TranscriptSettings.tsx
		function transcriptDirectory(value) {
			if (typeof value !== "object" || value === null) return "";
			const field = value.transcript_directory;
			return typeof field === "string" ? field : "";
		}
		function okfAccepted(value) {
			if (typeof value !== "object" || value === null) return {
				directory: "",
				autoIngest: true
			};
			const fields = value;
			const directory = fields.okf_directory;
			const autoIngest = fields.okf_ingest;
			return {
				directory: typeof directory === "string" ? directory : "",
				autoIngest: typeof autoIngest === "boolean" ? autoIngest : true
			};
		}
		function OkfSettingsSection({ binding, t }) {
			const accepted = {
				directory: binding.directory,
				autoIngest: binding.autoIngest
			};
			const [draft, setDraft] = (0, react.useState)(null);
			const [picking, setPicking] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(null);
			const value = draft ?? accepted;
			const writable = binding.writable;
			const unchanged = value.directory.trim() === accepted.directory.trim() && value.autoIngest === accepted.autoIngest;
			const choose = async () => {
				setPicking(true);
				setFailure(null);
				try {
					const chosen = await binding.chooseDirectory();
					if (chosen !== null) setDraft({
						directory: chosen,
						autoIngest: value.autoIngest
					});
				} catch {
					setFailure("save");
				} finally {
					setPicking(false);
				}
			};
			const save = async () => {
				const next = value.directory.trim();
				if (next !== "" && !next.startsWith("/")) {
					setFailure("invalid");
					return;
				}
				setFailure(null);
				try {
					if (await binding.save({
						directory: next,
						autoIngest: value.autoIngest
					})) setDraft(null);
					else setFailure("save");
				} catch {
					setFailure("save");
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ModelSettingsPage_module_default.card,
				"aria-label": t("okf"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ModelSettingsPage_module_default.heading,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
							className: ModelSettingsPage_module_default.title,
							children: t("okf")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ModelSettingsPage_module_default.description,
							children: t("okfConsent")
						})] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ModelSettingsPage_module_default.downloadRouting,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelSettingsPage_module_default.label,
							children: t("okfFolder")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							value: value.directory,
							placeholder: t("transcriptFolderUnset"),
							autoComplete: "off",
							spellCheck: false,
							disabled: !writable || picking,
							onChange: (event) => setDraft({
								directory: event.target.value,
								autoIngest: value.autoIngest
							})
						})] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelSettingsPage_module_default.downloadActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "outline",
							disabled: !writable || picking,
							onClick: () => {
								choose();
							},
							children: t("chooseFolder")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: !writable || picking || unchanged,
							onClick: () => {
								save();
							},
							children: t("save")
						})]
					}),
					failure === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelSettingsPage_module_default.error,
						role: "status",
						children: t(failure === "invalid" ? "transcriptFolderInvalid" : "okfSaveFailed")
					})
				]
			});
		}
		/**
		* Default folder for exported transcripts and the Open knowledge base section.
		* The macOS chooser runs on the host, so the same dialog is available from the
		* recording panel when no folder is configured yet.
		*/
		function TranscriptSettings({ form, rpc, t, okf }) {
			const accepted = transcriptDirectory(form?.state.value);
			const [draft, setDraft] = (0, react.useState)(null);
			const [picking, setPicking] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			const writable = form?.state.writable === true && form.state.status === "ready";
			const value = draft ?? accepted;
			const choose = async () => {
				setPicking(true);
				setFailed(false);
				try {
					const result = await callRecordingRpc(rpc, "okf/choose-directory", {});
					if (result.ok && typeof result.value === "string") setDraft(result.value);
					else if (!result.ok && result.error.message !== "CANCELLED_BY_USER") setFailed(true);
				} catch {
					setFailed(true);
				} finally {
					setPicking(false);
				}
			};
			const save = async () => {
				if (form?.state.revision === void 0) return;
				const next = value.trim();
				if (next !== "" && !next.startsWith("/")) {
					setFailed(true);
					return;
				}
				setFailed(false);
				try {
					if (await form.mutate([{
						op: "set",
						path: ["transcript_directory"],
						value: next
					}], form.state.revision)) setDraft(null);
					else setFailed(true);
				} catch {
					setFailed(true);
				}
			};
			const chooseOkf = async () => {
				const result = await callRecordingRpc(rpc, "okf/choose-directory", {});
				if (result.ok && typeof result.value === "string") return result.value;
				if (!result.ok && result.error.message === "CANCELLED_BY_USER") return null;
				throw new Error("OKF_DIRECTORY_PICK_FAILED");
			};
			const saveOkf = async (next) => {
				if (form?.state.revision === void 0) return false;
				try {
					return await form.mutate([{
						op: "set",
						path: ["okf_directory"],
						value: next.directory
					}, {
						op: "set",
						path: ["okf_ingest"],
						value: next.autoIngest
					}], form.state.revision);
				} catch {
					return false;
				}
			};
			const okfBinding = okf ?? {
				...okfAccepted(form?.state.value),
				writable,
				chooseDirectory: chooseOkf,
				save: saveOkf
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ModelSettingsPage_module_default.card,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ModelSettingsPage_module_default.heading,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
							className: ModelSettingsPage_module_default.title,
							children: t("transcripts")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ModelSettingsPage_module_default.description,
							children: t("transcriptFolderHint")
						})] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ModelSettingsPage_module_default.downloadRouting,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ModelSettingsPage_module_default.label,
							children: t("transcriptFolder")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							value,
							placeholder: t("transcriptFolderUnset"),
							autoComplete: "off",
							spellCheck: false,
							disabled: !writable || picking,
							onChange: (event) => setDraft(event.target.value)
						})] })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelSettingsPage_module_default.downloadActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "outline",
							disabled: !writable || picking,
							onClick: () => {
								choose();
							},
							children: t("chooseFolder")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: !writable || picking || value.trim() === accepted.trim(),
							onClick: () => {
								save();
							},
							children: t("save")
						})]
					}),
					failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: ModelSettingsPage_module_default.error,
						role: "status",
						children: t("transcriptFolderInvalid")
					}) : null
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OkfSettingsSection, {
				binding: okfBinding,
				t
			})] });
		}
		//#endregion
		//#region src/client/model-settings-client.ts
		function record$1(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_RESPONSE");
			return value;
		}
		function group(value) {
			const item = record$1(value);
			if (![
				"ready",
				"missing",
				"invalid"
			].includes(String(item.state)) || !Array.isArray(item.issues)) throw new Error("INVALID_RESPONSE");
			const issues = item.issues.map((value) => {
				const issue = record$1(value);
				if (typeof issue.id !== "string" || typeof issue.code !== "string" || typeof issue.action !== "string") throw new Error("INVALID_RESPONSE");
				return {
					id: issue.id,
					code: issue.code,
					action: issue.action
				};
			});
			return {
				state: item.state,
				issues
			};
		}
		async function readModelStatus(rpc, signal) {
			const response = await callRecordingRpc(rpc, "models/status", {}, signal);
			if (!response.ok) throw new Error("MODEL_STATUS_FAILED");
			const item = record$1(response.value);
			if (item.engine !== "paraformer" && item.engine !== "parakeet" || item.mode !== "base" && item.mode !== "enhanced" || item.preference !== null && typeof item.preference !== "boolean" || typeof item.inheritedLegacy !== "boolean" || typeof item.selectedReady !== "boolean" || typeof item.dataDirectory !== "string") throw new Error("INVALID_RESPONSE");
			return {
				engine: item.engine,
				mode: item.mode,
				preference: item.preference,
				inheritedLegacy: item.inheritedLegacy,
				selectedReady: item.selectedReady,
				dataDirectory: item.dataDirectory,
				base: group(item.base),
				parakeet: group(item.parakeet),
				punctuation: group(item.punctuation),
				native: group(item.native)
			};
		}
		//#endregion
		//#region src/client/ModelSettingsPage.tsx
		function ModelInstructions({ t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const target = "--data-dir /path/to/plugin-data";
			const commands = [
				{
					label: t("base"),
					code: `stage /path/to/base.tar ${target}`
				},
				{
					label: t("punctuation"),
					code: `stage /path/to/punctuation.tar ${target}`
				},
				{
					label: t("diagnostics"),
					code: `doctor ${target}`
				}
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: ModelSettingsPage_module_default.card,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInfoOutlineRegular, {}),
					title: t("instructions"),
					open,
					expandable: true,
					expandOnRowClick: true,
					rowClassName: ModelSettingsPage_module_default.helpHeading,
					onToggle: () => setOpen((value) => !value),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ModelSettingsPage_module_default.instructions,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ModelSettingsPage_module_default.description,
								children: t("delivery")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ModelSettingsPage_module_default.description,
								children: t("stage")
							}),
							commands.map((command) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelSettingsPage_module_default.command,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ModelSettingsPage_module_default.label,
									children: command.label
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.CodeBlock, {
									code: `dsh plugin --profile web exec dsh-asr-assets ${command.code}`,
									lang: "sh",
									copyLabel: t("copy"),
									copiedLabel: t("copied"),
									toolbarLabels: {
										codeLabel: t("command"),
										wrapLabel: t("wrap"),
										unwrapLabel: t("unwrap")
									},
									wrap: true
								})]
							}, command.label))
						]
					})
				})
			});
		}
		function ModelDiagnostics({ status, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [details, setDetails] = (0, react.useState)(false);
			const issues = [
				"base",
				"parakeet",
				"punctuation",
				"native"
			].flatMap((key) => status[key].issues.map((issue) => ({
				...issue,
				group: key
			})));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: ModelSettingsPage_module_default.card,
				"aria-label": t("diagnostics"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInfoOutlineRegular, {}),
					title: t("diagnostics"),
					open,
					expandable: true,
					expandOnRowClick: true,
					onToggle: () => setOpen((value) => !value),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ModelSettingsPage_module_default.description,
							children: t("diagnosticScope")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ModelSettingsPage_module_default.diagnosticGroups,
							children: [
								"base",
								"parakeet",
								"punctuation",
								"native"
							].map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ModelSettingsPage_module_default.diagnosticGroup,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ModelSettingsPage_module_default.modelTitle,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: ModelSettingsPage_module_default.label,
											children: t(key)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: status[key].state === "ready" ? "done" : key === "punctuation" && status.mode === "base" ? "idle" : "warning" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(status[key].state) })
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ModelSettingsPage_module_default.description,
									children: t(status[key].state === "ready" ? `${key}Ready` : `${key}Repair`)
								})]
							}, key))
						}),
						issues.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInfoOutlineRegular, {}),
							title: t("technicalDetails"),
							open: details,
							expandable: true,
							expandOnRowClick: true,
							onToggle: () => setDetails((value) => !value),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
								className: ModelSettingsPage_module_default.diagnostics,
								children: issues.map((issue) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
									t(issue.group),
									" · ",
									issue.id,
									": ",
									issue.code
								] }, `${issue.group}:${issue.id}`))
							})
						}) : null
					]
				})
			});
		}
		function ModelSettingsPage({ form, rpc, t }) {
			const [status, setStatus] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(false);
			const [refresh, setRefresh] = (0, react.useState)(0);
			const [loading, setLoading] = (0, react.useState)(true);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				setLoading(true);
				readModelStatus(rpc, controller.signal).then((value) => {
					if (!controller.signal.aborted) {
						setStatus(value);
						setLoading(false);
						setError(false);
					}
				}, () => {
					if (!controller.signal.aborted) {
						setStatus(null);
						setLoading(false);
						setError(true);
					}
				});
				return () => controller.abort();
			}, [
				rpc,
				refresh,
				form?.state.revision
			]);
			const installed = (0, react.useCallback)(() => setRefresh((value) => value + 1), []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ModelSettingsPage_module_default.page,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: ModelSettingsPage_module_default.heading,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: ModelSettingsPage_module_default.title,
							children: t("assets")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ModelSettingsPage_module_default.description,
							children: t("downloadIntro")
						})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "ghost",
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {}),
							onClick: installed,
							disabled: loading,
							children: t("refresh")
						})]
					}),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: ModelSettingsPage_module_default.loading,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }), t("loading")]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelDownloadSettings, {
						form,
						rpc,
						t,
						models: status,
						onInstalled: installed
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingPermissionSettings, {
						rpc,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TranscriptSettings, {
						form,
						rpc,
						t
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: ModelSettingsPage_module_default.error,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" }), t("failed")]
					}) : null,
					status !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelDiagnostics, {
						status,
						t
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelInstructions, {
						status,
						t
					})] }) : null
				]
			});
		}
		//#endregion
		//#region src/client/ModelSettingsBundle.tsx
		function ModelSettingsBundle({ source, rpc, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelSettingsPage, {
				form: {
					state: (0, react.useSyncExternalStore)((0, react.useCallback)((listener) => source.subscribe(listener), [source]), (0, react.useCallback)(() => source.getSnapshot(), [source])),
					mutate: (ops, revision) => source.mutate(ops, revision)
				},
				rpc,
				t
			});
		}
		//#endregion
		//#region src/client/model-settings-locales.ts
		const MODEL_SETTINGS_NAMESPACE = "dsh-asr.models";
		const modelZh = {
			permissions: "录音权限",
			permissionChecking: "检查中…",
			permissionTest: "检查录音权限",
			permissionHint: "检测不播放声音。首次使用可能请求授权。",
			microphone: "麦克风",
			systemAudio: "系统音频",
			permissionAllowed: "已允许",
			permissionVerified: "检测通过",
			permissionUnverified: "未通过",
			permissionNeeded: "未授权",
			permissionUnknown: "待检测",
			permissionUnsupported: "系统版本不支持",
			permissionFailed: "检测未完成，请检查系统权限后重试。",
			openMicSettings: "麦克风设置",
			openSystemSettings: "系统音频设置",
			permissionSettingsHint: "在系统设置中允许 DSHASRRecordingHelper。修改后重新检测。",
			customProxy: "自定义代理",
			configured: "已配置",
			notConfigured: "未配置",
			retry: "重试",
			configureProxy: "配置代理",
			saveRetry: "保存并重试",
			proxyRequired: "下载源连接失败，请配置代理后重试。",
			sourceUnavailable: "下载源暂时不可用，请稍后重试。",
			diskFull: "磁盘空间不足，请清理后重试。",
			storageFailed: "无法保存模型，请检查磁盘空间和目录权限。",
			verificationFailed: "模型文件校验未通过，请重新下载。",
			unsaved: "未保存",
			download: "下载",
			repair: "重新安装",
			baseSize: "278 MiB",
			punctuationSize: "274 MiB",
			parakeetSize: "640 MiB",
			connectionSettings: "自定义代理（可选）",
			downloadErrorTitle: "下载未完成",
			downloadTitle: "下载与安装",
			downloadIntro: "安装基础模型后即可录音与转写。",
			downloadBase: "下载基础模型",
			downloadPunctuation: "下载标点模型",
			downloadParakeet: "下载英文模型",
			cancelDownload: "取消下载",
			proxyAddress: "HTTP / HTTPS 代理地址",
			proxyHint: "仅用于 Hugging Face 备用下载。留空使用默认下载。",
			proxyInvalid: "请输入 HTTP / HTTPS 地址，不含账号密码、路径或参数。",
			downloadFailed: "下载未完成，请重试。",
			idle: "等待下载",
			downloading: "下载中",
			verifying: "校验中",
			installing: "安装中",
			completed: "安装完成",
			cancelled: "已取消",
			assets: "模型状态",
			baseDescription: "录音与转写所需的离线模型",
			punctuationDescription: "安装后，新录音与转写自动加标点",
			nativeDescription: "随插件提供的本地运行组件",
			parakeetDescription: "英文与欧洲语言模型，自带标点与大小写",
			diagnostics: "检查与诊断",
			copy: "复制命令",
			copied: "已复制",
			command: "命令",
			wrap: "自动换行",
			unwrap: "取消换行",
			transcripts: "转写导出",
			transcriptFolder: "默认保存位置",
			transcriptFolderHint: "导出 Markdown 转写时使用的文件夹。留空则在导出时询问。",
			transcriptFolderUnset: "尚未设置",
			chooseFolder: "选择文件夹…",
			transcriptFolderInvalid: "请输入绝对路径，或选择一个文件夹。",
			okf: "开放知识库",
			okfFolder: "知识库文件夹",
			okfAutoIngest: "自动收录新的转写",
			okfConsent: "开启后，该文件夹会成为 Git 仓库，每次收录的会议都会生成一个提交。",
			okfSaveFailed: "无法保存开放知识库设置。",
			summary: "离线录音与转写 · 仅限 Apple Silicon Mac",
			title: "模型设置",
			base: "基础模型（必需）",
			punctuation: "标点模型（可选）",
			native: "本地推理组件",
			parakeet: "英文模型（可选）",
			ready: "已就绪",
			missing: "未安装",
			invalid: "需修复",
			current: "当前新任务模式",
			baseMode: "基础模式 · 无标点",
			enhancedMode: "增强模式 · 含标点",
			blocked: "请下载或修复上方模型。",
			loading: "正在校验模型…",
			failed: "模型状态读取失败，请重试。",
			refresh: "重新检查",
			save: "保存",
			saving: "保存中…",
			unavailable: "此配置暂不可用，请检查插件是否启用。",
			readOnly: "此连接无法保存设置。",
			conflict: "设置已被其他窗口修改，请重新打开后重试。",
			instructions: "开发者选项：手动导入与诊断命令",
			delivery: "以下命令用于 Web 模式；桌面版请在设置页下载和诊断。",
			stage: "请替换归档路径和数据目录。",
			dependencyRepair: "运行依赖需修复时，请重新安装匹配的插件包；doctor 可查看具体原因。",
			diagnosticScope: "检查模型和推理组件；不包含录音权限。",
			baseReady: "基础模型完整，可以录音与转写。",
			baseRepair: "请在上方下载或重新安装。",
			punctuationReady: "新录音与转写自动加标点。",
			punctuationRepair: "可跳过；需要标点时在上方下载。",
			parakeetReady: "英文与欧洲语言录音可直接转写，标点与大小写由模型给出。",
			parakeetRepair: "可跳过；处理英文会议录音时在上方下载。",
			nativeReady: "插件自带，无需另装。",
			nativeRepair: "请重新安装适用于本机的插件包。",
			technicalDetails: "技术详情",
			preparationSteps: "准备步骤",
			prepareDownload: "下载模型",
			prepareVerify: "校验模型文件",
			prepareInstall: "安装模型"
		};
		const modelEn = {
			permissions: "Recording permissions",
			permissionChecking: "Checking…",
			permissionTest: "Check recording permissions",
			permissionHint: "The check is silent. First use may request access.",
			microphone: "Microphone",
			systemAudio: "System audio",
			permissionAllowed: "Allowed",
			permissionVerified: "Verified",
			permissionUnverified: "Not verified",
			permissionNeeded: "Access needed",
			permissionUnknown: "Not verified",
			permissionUnsupported: "Unsupported macOS version",
			permissionFailed: "The check did not finish. Check system permissions and retry.",
			openMicSettings: "Microphone settings",
			openSystemSettings: "System audio settings",
			permissionSettingsHint: "Allow DSHASRRecordingHelper in System Settings, then run the check again.",
			customProxy: "Custom proxy",
			configured: "Configured",
			notConfigured: "Not configured",
			retry: "Retry",
			configureProxy: "Configure proxy",
			saveRetry: "Save and retry",
			proxyRequired: "Download sources could not be reached. Configure a proxy and retry.",
			sourceUnavailable: "The download source is unavailable. Retry later.",
			diskFull: "Not enough disk space. Free up space and retry.",
			storageFailed: "Cannot save models. Check disk space and directory permissions.",
			verificationFailed: "Model verification failed. Download again.",
			unsaved: "Unsaved",
			download: "Download",
			repair: "Reinstall",
			baseSize: "278 MiB",
			punctuationSize: "274 MiB",
			parakeetSize: "640 MiB",
			connectionSettings: "Custom proxy (optional)",
			downloadErrorTitle: "Download failed",
			downloadTitle: "Download and install",
			downloadIntro: "Install base models to record and transcribe.",
			downloadBase: "Download base models",
			downloadPunctuation: "Download punctuation",
			downloadParakeet: "Download English models",
			cancelDownload: "Cancel download",
			proxyAddress: "HTTP / HTTPS proxy address",
			proxyHint: "Only for Hugging Face fallback downloads. Leave blank for default downloads.",
			proxyInvalid: "Enter an HTTP / HTTPS address without credentials, paths or query parameters.",
			downloadFailed: "The download did not finish. Retry.",
			idle: "Waiting",
			downloading: "Downloading",
			verifying: "Verifying",
			installing: "Installing",
			completed: "Installed",
			cancelled: "Cancelled",
			assets: "Model status",
			baseDescription: "Offline models required for recording and transcription",
			punctuationDescription: "Adds punctuation to new recordings and transcripts after installation",
			nativeDescription: "Local runtime components included with the plugin",
			parakeetDescription: "English and European languages with built-in punctuation and casing",
			diagnostics: "Check and diagnose",
			copy: "Copy command",
			copied: "Copied",
			command: "Command",
			wrap: "Wrap lines",
			unwrap: "Unwrap lines",
			transcripts: "Transcript export",
			transcriptFolder: "Default save location",
			transcriptFolderHint: "Folder used when exporting Markdown transcripts. Leave empty to ask on export.",
			transcriptFolderUnset: "Not set",
			chooseFolder: "Choose folder…",
			transcriptFolderInvalid: "Enter an absolute path or choose a folder.",
			okf: "Open knowledge base",
			okfFolder: "Bundle folder",
			okfAutoIngest: "Ingest new transcripts automatically",
			okfConsent: "Turning this on makes the folder a Git repository, and every ingested meeting becomes one commit.",
			okfSaveFailed: "Could not save Open knowledge base settings.",
			summary: "Offline recording and transcription · Apple Silicon Mac only",
			title: "Models and transcription mode",
			base: "Base models (required)",
			punctuation: "Punctuation models (optional)",
			native: "Local inference components",
			parakeet: "English models (optional)",
			ready: "Ready",
			missing: "Not installed",
			invalid: "Needs repair",
			current: "Mode for new tasks",
			baseMode: "Base · no punctuation",
			enhancedMode: "Enhanced · punctuation",
			blocked: "Download or repair the models above.",
			loading: "Verifying models…",
			failed: "Cannot read model status. Retry.",
			refresh: "Check again",
			save: "Save",
			saving: "Saving…",
			unavailable: "Configuration unavailable. Check that the plugin is enabled.",
			readOnly: "This connection cannot save settings.",
			conflict: "Save refused; another window may have changed the configuration. Reopen this page and retry.",
			instructions: "Developer options: manual import and diagnostic commands",
			delivery: "These commands are for Web mode. Use plugin settings for desktop downloads and diagnostics.",
			stage: "Replace the archive paths and data directory.",
			dependencyRepair: "Reinstall a matching plugin package to repair runtime dependencies. Run doctor for details.",
			diagnosticScope: "Checks models and inference components, not recording permissions.",
			baseReady: "Base models are complete and ready for recording and transcription.",
			baseRepair: "Download or reinstall the base models above before recording.",
			punctuationReady: "New recordings and transcripts use punctuation automatically.",
			punctuationRepair: "Optional. Download above if you need punctuation.",
			parakeetReady: "English and European speech transcribes directly; punctuation and casing come from the model.",
			parakeetRepair: "Optional. Download above to process English meeting recordings.",
			nativeReady: "Included with the plugin; no separate installation needed.",
			nativeRepair: "Reinstall a plugin package compatible with this computer.",
			technicalDetails: "Technical details",
			preparationSteps: "Preparation steps",
			prepareDownload: "Download models",
			prepareVerify: "Verify model files",
			prepareInstall: "Install models"
		};
		//#endregion
		//#region src/client/current-session.ts
		function currentSessionId(ctx) {
			return Object.values(ctx.sessions.list.getSnapshot().byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
		}
		const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u2028\u2029]/gu;
		const WHITESPACE = /\s+/gu;
		/**
		* Canonical form of a typed name: control characters and line breaks become
		* spaces, whitespace runs collapse, the result is trimmed and capped. Applying
		* this twice changes nothing, which is what lets the host reject any value that
		* is not already canonical.
		*/
		function normalizeSpeakerName(raw) {
			const collapsed = raw.replace(CONTROL_CHARACTERS, " ").replace(WHITESPACE, " ").trim();
			return Array.from(collapsed).slice(0, 60).join("").trim();
		}
		/** The name to print for a label: the assigned name, or the label itself. */
		function speakerNameFor(label, names) {
			const name = normalizeSpeakerName(names[label] ?? "");
			return name === "" ? label : name;
		}
		/** Only the assignments that actually rename something. */
		function assignedSpeakerNames(labels, names) {
			const assigned = {};
			for (const label of labels) {
				const name = speakerNameFor(label, names);
				if (name !== label) assigned[label] = name;
			}
			return assigned;
		}
		/** Names that more than one label resolves to, in first-seen order. */
		function duplicateSpeakerNames(labels, names) {
			const counts = /* @__PURE__ */ new Map();
			for (const label of labels) {
				const name = speakerNameFor(label, names);
				counts.set(name, (counts.get(name) ?? 0) + 1);
			}
			return [...counts].filter(([, count]) => count > 1).map(([name]) => name);
		}
		//#endregion
		//#region src/client/recording-error-copy.ts
		const groups = [
			["panel.systemNoSignal", ["SYSTEM_AUDIO_NO_SIGNAL"]],
			["panel.error.systemCheck", ["SYSTEM_AUDIO_PERMISSION_REQUIRED"]],
			["panel.error.unsupported", ["SYSTEM_AUDIO_UNSUPPORTED", "SYSTEM_AUDIO_NOT_AVAILABLE"]],
			["panel.micDenied", ["MICROPHONE_PERMISSION_DENIED", "MICROPHONE_PERMISSION_REQUIRED"]],
			["panel.systemDenied", ["SYSTEM_AUDIO_PERMISSION_DENIED"]],
			["panel.error.models", [
				"MODEL_NOT_READY",
				"MODEL_PACK_INCOMPATIBLE",
				"MODEL_PACK_INVALID",
				"ASSET_MISMATCH",
				"MODEL_LOAD_FAILED"
			]],
			["panel.error.component", [
				"NATIVE_LOAD_FAILED",
				"NATIVE_FAILURE",
				"HELPER_ADHOC_ONLY",
				"HELPER_ASSET_INVALID",
				"HELPER_ASSET_MISSING",
				"HELPER_HASH_MISMATCH",
				"HELPER_MANIFEST_INVALID",
				"HELPER_RUNTIME_MISMATCH",
				"HELPER_SIGNATURE_IDENTITY_MISMATCH",
				"HELPER_SIGNATURE_INSPECTION_FAILED",
				"HELPER_SIGNATURE_INVALID",
				"HELPER_TREE_MISMATCH"
			]],
			["panel.error.worker", [
				"WORKER_PROTOCOL_ERROR",
				"WORKER_PROCESS_ERROR",
				"WORKER_TIMEOUT",
				"MODEL_INFERENCE_FAILED"
			]],
			["panel.error.helper", [
				"HELPER_PROCESS_ERROR",
				"HELPER_PROTOCOL_ERROR",
				"HELPER_READY_TIMEOUT",
				"HELPER_COMMAND_TIMEOUT",
				"HELPER_TERMINATION_TIMEOUT",
				"COMMAND_APPLY_FAILED",
				"MIC_CAPTURE_FAILED",
				"SYSTEM_CAPTURE_FAILED",
				"CAPTURE_PROCESS_ERROR",
				"CAPTURE_EXITED",
				"CAPTURE_LAUNCH_FAILED",
				"CAPTURE_REGISTRY_FAILED",
				"CAPTURE_START_TIMEOUT",
				"HELPER_START_FAILED",
				"ALL_REQUESTED_TRACKS_FAILED",
				"COMMAND_SCHEMA_INVALID",
				"COMMAND_SEQUENCE_INVALID"
			]],
			["panel.error.permissionCheck", [
				"PERMISSION_CHECK_FAILED",
				"PERMISSION_CHECK_TIMEOUT",
				"MICROPHONE_PERMISSION_TIMEOUT"
			]],
			["panel.error.storage", [
				"STORAGE_FAILURE",
				"HELPER_IO_FAILED",
				"AUDIO_READ_FAILED",
				"AUDIO_CHUNK_INVALID",
				"DISK_SPACE_INSUFFICIENT",
				"DATABASE_INTEGRITY_FAILED"
			]],
			["panel.error.busy", ["ENGINE_BUSY", "DATA_ROOT_IN_USE"]],
			["panel.error.resources", ["RESOURCE_LIMIT"]],
			["panel.error.cancelled", [
				"CANCELLED_BY_USER",
				"WORKER_CANCELLED",
				"STAGE_ABORTED"
			]],
			["panel.error.state", [
				"INVALID_INPUT",
				"INVALID_REQUEST",
				"INVALID_MEETING_STATE",
				"MEETING_NOT_FOUND",
				"TRANSCRIPT_VERSION_CONFLICT",
				"RUN_STATE_CONFLICT"
			]],
			["panel.error.exportDirectory", ["EXPORT_DIRECTORY_REQUIRED", "EXPORT_DIRECTORY_INVALID"]],
			["panel.error.export", [
				"EXPORT_PATH_INVALID",
				"EXPORT_TARGET_EXISTS",
				"EXPORT_PERMISSION_DENIED",
				"EXPORT_WRITE_FAILED",
				"EXPORT_PICKER_FAILED",
				"TRANSCRIPT_NOT_COMMITTED",
				"TRANSCRIPT_EMPTY"
			]],
			["panel.error.exportSpeaker", ["EXPORT_SPEAKER_UNKNOWN", "EXPORT_SPEAKER_INVALID"]],
			["panel.error.exportSpeakerDuplicate", ["EXPORT_SPEAKER_DUPLICATE"]]
		];
		function recordingErrorCopy(code, translate) {
			return translate(groups.find(([, codes]) => codes.includes(code))?.[0] ?? "panel.error.generic");
		}
		//#endregion
		//#region src/client/meeting-reference-source.ts
		const UUID_PATTERN$2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
		const URI_PREFIX = "](dsh-meeting:";
		const ESCAPED_LABEL_CHARACTERS = new Set([
			"\\",
			"[",
			"]",
			"(",
			")"
		]);
		const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u;
		function invalidReference() {
			throw new Error("INVALID_MEETING_REFERENCE");
		}
		function validateIdentity(identity) {
			if (!UUID_PATTERN$2.test(identity.meetingId) || identity.label.length < 1 || identity.label.length > 255 || CONTROL_CHARACTER.test(identity.label)) invalidReference();
		}
		function escapeLabel(label) {
			let escaped = "";
			for (const character of label) escaped += ESCAPED_LABEL_CHARACTERS.has(character) ? `\\${character}` : character;
			return escaped;
		}
		function unescapeLabel(value) {
			let label = "";
			for (let index = 0; index < value.length; index += 1) {
				const character = value[index];
				if (CONTROL_CHARACTER.test(character)) invalidReference();
				if (character !== "\\") {
					if (ESCAPED_LABEL_CHARACTERS.has(character)) invalidReference();
					label += character;
					continue;
				}
				const escaped = value[index + 1];
				if (escaped === void 0 || !ESCAPED_LABEL_CHARACTERS.has(escaped)) invalidReference();
				label += escaped;
				index += 1;
			}
			return label;
		}
		function formatMeetingReference(identity) {
			validateIdentity(identity);
			return `@[${escapeLabel(identity.label)}](dsh-meeting:${identity.meetingId})`;
		}
		function parseMeetingReference(mention) {
			const marker = mention.lastIndexOf(URI_PREFIX);
			if (!mention.startsWith("@[") || marker < 2 || !mention.endsWith(")")) invalidReference();
			const identity = {
				meetingId: mention.slice(marker + 14, -1),
				label: unescapeLabel(mention.slice(2, marker))
			};
			validateIdentity(identity);
			if (formatMeetingReference(identity) !== mention) invalidReference();
			return identity;
		}
		function parseCandidateValue(value) {
			if (value === void 0) return null;
			try {
				const parsed = JSON.parse(value);
				if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
				const record = parsed;
				if (Object.keys(record).length !== 2 || typeof record.meetingId !== "string" || typeof record.label !== "string") return null;
				const identity = {
					meetingId: record.meetingId,
					label: record.label
				};
				formatMeetingReference(identity);
				return identity;
			} catch {
				return null;
			}
		}
		function durationClock(milliseconds) {
			const totalSeconds = Math.floor(milliseconds / 1e3);
			const seconds = String(totalSeconds % 60).padStart(2, "0");
			const totalMinutes = Math.floor(totalSeconds / 60);
			if (totalMinutes < 60) return `${totalMinutes}:${seconds}`;
			return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}:${seconds}`;
		}
		function candidateDescription(candidate, locale, translate) {
			const timestamp = candidate.started_at ?? candidate.created_at;
			const time = new Intl.DateTimeFormat(locale, {
				dateStyle: "short",
				timeStyle: "short"
			}).format(new Date(timestamp));
			const elapsed = candidate.recording_elapsed_ms === null ? null : translate("time.elapsed", { value: durationClock(candidate.recording_elapsed_ms) });
			const duration = candidate.duration_ms === null ? null : translate("time.duration", { value: durationClock(candidate.duration_ms) });
			return [
				translate(`phase.${candidate.phase}`),
				time,
				elapsed ?? duration
			].filter((part) => part !== null).join(" · ");
		}
		function sourceCandidate(candidate, locale, translate) {
			return {
				name: candidate.label,
				description: candidateDescription(candidate, locale, translate),
				section: translate("section.meetings"),
				value: JSON.stringify({
					meetingId: candidate.meeting_id,
					label: candidate.label
				})
			};
		}
		function pickReference(options, candidate, sessionId) {
			const identity = parseCandidateValue(candidate.value);
			if (identity === null) return void 0;
			if (options.hasReference(sessionId, identity.meetingId)) return { text: "" };
			const mention = formatMeetingReference(identity);
			return { insert: {
				source: "meeting-reference",
				ref: mention,
				label: identity.label,
				clipboardText: mention
			} };
		}
		function referenceCodec(options) {
			return {
				clipboardText(ref) {
					parseMeetingReference(ref);
					return ref;
				},
				async serialize(ref, signal) {
					const identity = parseMeetingReference(ref);
					if ((await options.client.resolveMeetingReference({
						locale: options.locale(),
						meeting_id: identity.meetingId
					}, signal)).meeting_id !== identity.meetingId) invalidReference();
					return ref;
				}
			};
		}
		function createMeetingReferenceSource(options) {
			return {
				trigger: "@",
				name: "meeting-reference",
				order: 1,
				showGroupTitle: false,
				async candidates(session, request) {
					const locale = options.locale();
					const candidates = await options.client.referenceCandidates({
						session_id: session.sessionId,
						locale,
						...request.query.trim() === "" ? {} : { query: request.query }
					}, request.signal);
					if (request.signal.aborted) return [];
					return candidates.map((candidate) => sourceCandidate(candidate, locale, options.translate));
				},
				onPick({ candidate, session }) {
					return pickReference(options, candidate, session.sessionId);
				},
				codec: referenceCodec(options)
			};
		}
		//#endregion
		//#region src/client/recording-icon-assets.ts
		const recordingIcons = {
			"grip": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjUuNCIgaGVpZ2h0PSI4LjQiIHZpZXdCb3g9IjAgMCA1LjQgOC40IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZyBpZD0iR3JvdXAiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNMC43IDEuNEMxLjA4NjYgMS40IDEuNCAxLjA4NjYgMS40IDAuN0MxLjQgMC4zMTM0MDEgMS4wODY2IDAgMC43IDBDMC4zMTM0MDEgMCAwIDAuMzEzNDAxIDAgMC43QzAgMS4wODY2IDAuMzEzNDAxIDEuNCAwLjcgMS40WiIgZmlsbD0iIzgxODU4QyIvPgo8cGF0aCBpZD0iVmVjdG9yXzIiIGQ9Ik00LjcgMS40QzUuMDg2NiAxLjQgNS40IDEuMDg2NiA1LjQgMC43QzUuNCAwLjMxMzQwMSA1LjA4NjYgMCA0LjcgMEM0LjMxMzQgMCA0IDAuMzEzNDAxIDQgMC43QzQgMS4wODY2IDQuMzEzNCAxLjQgNC43IDEuNFoiIGZpbGw9IiM4MTg1OEMiLz4KPHBhdGggaWQ9IlZlY3Rvcl8zIiBkPSJNMC43IDQuOUMxLjA4NjYgNC45IDEuNCA0LjU4NjYgMS40IDQuMkMxLjQgMy44MTM0IDEuMDg2NiAzLjUgMC43IDMuNUMwLjMxMzQwMSAzLjUgMCAzLjgxMzQgMCA0LjJDMCA0LjU4NjYgMC4zMTM0MDEgNC45IDAuNyA0LjlaIiBmaWxsPSIjODE4NThDIi8+CjxwYXRoIGlkPSJWZWN0b3JfNCIgZD0iTTQuNyA0LjlDNS4wODY2IDQuOSA1LjQgNC41ODY2IDUuNCA0LjJDNS40IDMuODEzNCA1LjA4NjYgMy41IDQuNyAzLjVDNC4zMTM0IDMuNSA0IDMuODEzNCA0IDQuMkM0IDQuNTg2NiA0LjMxMzQgNC45IDQuNyA0LjlaIiBmaWxsPSIjODE4NThDIi8+CjxwYXRoIGlkPSJWZWN0b3JfNSIgZD0iTTAuNyA4LjRDMS4wODY2IDguNCAxLjQgOC4wODY2IDEuNCA3LjdDMS40IDcuMzEzNCAxLjA4NjYgNyAwLjcgN0MwLjMxMzQwMSA3IDAgNy4zMTM0IDAgNy43QzAgOC4wODY2IDAuMzEzNDAxIDguNCAwLjcgOC40WiIgZmlsbD0iIzgxODU4QyIvPgo8cGF0aCBpZD0iVmVjdG9yXzYiIGQ9Ik00LjcgOC40QzUuMDg2NiA4LjQgNS40IDguMDg2NiA1LjQgNy43QzUuNCA3LjMxMzQgNS4wODY2IDcgNC43IDdDNC4zMTM0IDcgNCA3LjMxMzQgNCA3LjdDNCA4LjA4NjYgNC4zMTM0IDguNCA0LjcgOC40WiIgZmlsbD0iIzgxODU4QyIvPgo8L2c+Cjwvc3ZnPgo=",
			"play": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJwbGF5LWNpcmNsZS1maWxsZWQiPgo8cGF0aCBpZD0idmVjdG9yIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTEyIDJDNi40NzcxNSAyIDIgNi40NzcxNSAyIDEyQzIgMTcuNTIyOCA2LjQ3NzE1IDIyIDEyIDIyQzE3LjUyMjggMjIgMjIgMTcuNTIyOCAyMiAxMkMyMiA2LjQ3NzE1IDE3LjUyMjggMiAxMiAyWk05IDguOTYzMjhWMTUuMDM2OEM5IDE1LjkzNzIgOS45OTYwOSAxNi40ODEgMTAuNzUzNSAxNS45OTQxTDE1LjQ3NzMgMTIuOTU3NEMxNi4xNzQyIDEyLjUwOTQgMTYuMTc0MiAxMS40OTA3IDE1LjQ3NzMgMTEuMDQyN0wxMC43NTM1IDguMDA1OTZDOS45OTYxIDcuNTE5MDYgOSA4LjA2Mjg4IDkgOC45NjMyOFoiIGZpbGw9IiMwRjExMTUiLz4KPC9nPgo8L3N2Zz4K",
			"expand": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMTggMTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJFeHBhbmQiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNNC41IDcuNUw5IDEyTDEzLjUgNy41IiBzdHJva2U9IiM2MTY2NkIiIHN0cm9rZS13aWR0aD0iMS4zNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjwvZz4KPC9zdmc+Cg==",
			"stop": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJTdG9wIHJlY29yZGluZyI+CjxwYXRoIGlkPSJWZWN0b3IiIGQ9Ik0xMiAyMkMxNy41MjI4IDIyIDIyIDE3LjUyMjggMjIgMTJDMjIgNi40NzcxNSAxNy41MjI4IDIgMTIgMkM2LjQ3NzE1IDIgMiA2LjQ3NzE1IDIgMTJDMiAxNy41MjI4IDYuNDc3MTUgMjIgMTIgMjJaIiBmaWxsPSIjRUY0NDQ0Ii8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTE0LjcgOEg5LjNDOC41ODIwMyA4IDggOC41ODIwMyA4IDkuM1YxNC43QzggMTUuNDE4IDguNTgyMDMgMTYgOS4zIDE2SDE0LjdDMTUuNDE4IDE2IDE2IDE1LjQxOCAxNiAxNC43VjkuM0MxNiA4LjU4MjAzIDE1LjQxOCA4IDE0LjcgOFoiIGZpbGw9IndoaXRlIi8+CjwvZz4KPC9zdmc+Cg==",
			"mic": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiB2aWV3Qm94PSIwIDAgMjAgMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJpY29uIC8gbWljIj4KPGcgaWQ9InZlY3RvciI+CjxwYXRoIGQ9Ik0xNS44Mjk0IDkuNjE3OTZDMTYuMjcwNSA5Ljc0OTI0IDE2LjUyMTcgMTAuMjEzMyAxNi4zOTA0IDEwLjY1NDRDMTUuNjQ3NiAxMy4xNTA0IDEzLjQ4MjUgMTUuMDM0OCAxMC44MzMzIDE1LjM2NTFWMTYuMjVIMTIuMDgzM0MxMi41NDM2IDE2LjI1IDEyLjkxNjcgMTYuNjIzMSAxMi45MTY3IDE3LjA4MzNDMTIuOTE2NyAxNy41NDM2IDEyLjU0MzYgMTcuOTE2NyAxMi4wODMzIDE3LjkxNjdINy45MTY2OEM3LjQ1NjQ0IDE3LjkxNjcgNy4wODMzNSAxNy41NDM2IDcuMDgzMzUgMTcuMDgzM0M3LjA4MzM1IDE2LjYyMzEgNy40NTY0NCAxNi4yNSA3LjkxNjY4IDE2LjI1SDkuMTY2NjhWMTUuMzY1MUM2LjUxNzQ0IDE1LjAzNDggNC4zNTIzMiAxMy4xNTA0IDMuNjA5NDcgMTAuNjU0NEMzLjQ3ODE4IDEwLjIxMzMgMy43MjkzNSA5Ljc0OTI0IDQuMTcwNDcgOS42MTc5NkM0LjYxMTU5IDkuNDg2NjcgNS4wNzU2MSA5LjczNzg0IDUuMjA2ODkgMTAuMTc5QzUuODIxNzQgMTIuMjQ0OSA3LjczNjE2IDEzLjc1IDkuOTk5OTUgMTMuNzVDMTIuMjYzNyAxMy43NSAxNC4xNzgxIDEyLjI0NDkgMTQuNzkzIDEwLjE3OUMxNC45MjQzIDkuNzM3ODQgMTUuMzg4MyA5LjQ4NjY3IDE1LjgyOTQgOS42MTc5NloiIGZpbGw9IiMwRjExMTUiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMi4wODMzIDguNzVWNS44MzMzM0MxMi4wODMzIDQuNjgyNzQgMTEuMTUwNiAzLjc1IDEwIDMuNzVDOC44NDk0MSAzLjc1IDcuOTE2NjcgNC42ODI3NCA3LjkxNjY3IDUuODMzMzNWOC43NUM3LjkxNjY3IDkuOTAwNTkgOC44NDk0MSAxMC44MzMzIDEwIDEwLjgzMzNDMTEuMTUwNiAxMC44MzMzIDEyLjA4MzMgOS45MDA1OSAxMi4wODMzIDguNzVaTTEwIDIuMDgzMzNDNy45Mjg5MyAyLjA4MzMzIDYuMjUgMy43NjIyNyA2LjI1IDUuODMzMzNWOC43NUM2LjI1IDEwLjgyMTEgNy45Mjg5MyAxMi41IDEwIDEyLjVDMTIuMDcxMSAxMi41IDEzLjc1IDEwLjgyMTEgMTMuNzUgOC43NVY1LjgzMzMzQzEzLjc1IDMuNzYyMjcgMTIuMDcxMSAyLjA4MzMzIDEwIDIuMDgzMzNaIiBmaWxsPSIjMEYxMTE1Ii8+CjwvZz4KPC9nPgo8L3N2Zz4K",
			"system": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiB2aWV3Qm94PSIwIDAgMjAgMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJpY29uIC8gc291bmQtb24sIHJlYWQtb3V0LWxvdWQsIHNwZWFrZXIiPgo8cGF0aCBpZD0idmVjdG9yIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTkuNTgzMzMgNC4wOTE1OEM5LjU4MzMzIDMuNzI5MDQgOS4xNTIzNiAzLjUzOTQ1IDguODg1MTEgMy43ODQ0NEw2LjY2NzkgNS44MTY4OEM2LjA3MTYgNi4zNjM0OCA1LjI5MjA4IDYuNjY2NyA0LjQ4MzE3IDYuNjY2NzFDMy42MTgwMSA2LjY2NjcxIDIuOTE2NjcgNy4zNjgwNSAyLjkxNjY3IDguMjMzMjFWMTEuNzY2OUMyLjkxNjY3IDEyLjYzMiAzLjYxODAxIDEzLjMzMzQgNC40ODMxNyAxMy4zMzM0QzUuMjkyMDggMTMuMzMzNCA2LjA3MTYgMTMuNjM2NiA2LjY2NzkgMTQuMTgzMkw4Ljg4NTExIDE2LjIxNTZDOS4xNTIzNiAxNi40NjA2IDkuNTgzMzMgMTYuMjcxIDkuNTgzMzMgMTUuOTA4NVY0LjA5MTU4Wk03Ljc1ODkgMi41NTU4NUM5LjA5NTE1IDEuMzMwOTUgMTEuMjUgMi4yNzg4NiAxMS4yNSA0LjA5MTU4VjE1LjkwODVDMTEuMjUgMTcuNzIxMiA5LjA5NTE2IDE4LjY2OTEgNy43NTg5IDE3LjQ0NDJMNS41NDE2OSAxNS40MTE4QzUuMjUyNzggMTUuMTQ3IDQuODc1MDkgMTUgNC40ODMxNyAxNUMyLjY5NzU0IDE1IDEuMjUgMTMuNTUyNSAxLjI1IDExLjc2NjlWOC4yMzMyMUMxLjI1IDYuNDQ3NTggMi42OTc1NCA1LjAwMDA0IDQuNDgzMTcgNS4wMDAwNEM0Ljg3NTA5IDUuMDAwMDQgNS4yNTI3OCA0Ljg1MzEyIDUuNTQxNjkgNC41ODgyOUw3Ljc1ODkgMi41NTU4NVpNMTYuNTEwNyA1LjI5NzE3QzE2LjkxNTIgNS4wNzc1NyAxNy40MjExIDUuMjI3NDQgMTcuNjQwNyA1LjYzMTlDMTguMzQ2MiA2LjkzMTMgMTguNzQ2NiA4LjQyMDE1IDE4Ljc0NjYgMTBDMTguNzQ2NiAxMS41NDIyIDE4LjM2NSAxMi45OTc4IDE3LjY5MDUgMTQuMjc1MUMxNy40NzU2IDE0LjY4MjEgMTYuOTcxNSAxNC44Mzc4IDE2LjU2NDUgMTQuNjIyOEMxNi4xNTc1IDE0LjQwNzkgMTYuMDAxOCAxMy45MDM4IDE2LjIxNjcgMTMuNDk2OEMxNi43Njc2IDEyLjQ1MzYgMTcuMDc5OSAxMS4yNjQ1IDE3LjA3OTkgMTBDMTcuMDc5OSA4LjcwNDc3IDE2Ljc1MjIgNy40ODg1MiAxNi4xNzYgNi40MjcxNUMxNS45NTY0IDYuMDIyNjggMTYuMTA2MiA1LjUxNjc3IDE2LjUxMDcgNS4yOTcxN1pNMTMuMTY2NSA2LjU4MzdDMTMuNTM0NSA2LjMwNzI5IDE0LjA1NjkgNi4zODE1MyAxNC4zMzMzIDYuNzQ5NTJDMTUuMDEzNCA3LjY1NDkgMTUuNDE2NyA4Ljc4MTU2IDE1LjQxNjcgMTBDMTUuNDE2NyAxMS4wOTM5IDE1LjA5MTUgMTIuMTE0MyAxNC41MzI1IDEyLjk2N0MxNC4yODAxIDEzLjM1MTggMTMuNzYzNSAxMy40NTkyIDEzLjM3ODYgMTMuMjA2OUMxMi45OTM4IDEyLjk1NDUgMTIuODg2MyAxMi40Mzc5IDEzLjEzODcgMTIuMDUzQzEzLjUyNTIgMTEuNDYzNiAxMy43NSAxMC43NTk0IDEzLjc1IDEwQzEzLjc1IDkuMTU0ODUgMTMuNDcxNCA4LjM3NzE1IDEzLjAwMDcgNy43NTA0OEMxMi43MjQzIDcuMzgyNDkgMTIuNzk4NSA2Ljg2MDExIDEzLjE2NjUgNi41ODM3WiIgZmlsbD0iIzBGMTExNSIvPgo8L2c+Cjwvc3ZnPgo=",
			"mention": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiB2aWV3Qm94PSIwIDAgMjAgMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJFZGl0IC8gTWVudGlvbiI+CjxwYXRoIGlkPSJWZWN0b3IiIGQ9Ik0xMi41IDEwLjAwMlYxMC44MzMzQzEyLjUgMTEuNzUzOCAxMy4yNDYyIDEyLjUgMTQuMTY2NyAxMi41QzE1LjA4NzEgMTIuNSAxNS44MzMzIDExLjc1MzggMTUuODMzMyAxMC44MzMzVjkuOTk5OTlDMTUuODMzMyA4Ljc1MTc5IDE1LjQzMzEgNy41MzY1NyAxNC42OTEyIDYuNTMyNzlDMTMuOTQ5MiA1LjUyOTAxIDEyLjkwNDcgNC43ODk2NCAxMS43MTE0IDQuNDIzNDFDMTAuNTE4MiA0LjA1NzE5IDkuMjM4OCA0LjA4MzM0IDguMDYxNTIgNC40OTgwOUM2Ljg4NDI0IDQuOTEyODUgNS44NzExMiA1LjY5NDY2IDUuMTcwOSA2LjcyNzk2QzQuNDcwNjggNy43NjEyNiA0LjEyMDQ3IDguOTkxNTYgNC4xNzE1NiAxMC4yMzg3QzQuMjIyNjQgMTEuNDg1OSA0LjY3MjQgMTIuNjgzOSA1LjQ1NDc4IDEzLjY1NjVDNi4yMzcxNSAxNC42MjkxIDcuMzExMTMgMTUuMzI0OSA4LjUxODM5IDE1LjY0MkM5LjcyNTY0IDE1Ljk1OTEgMTEuMDAyMyAxNS44ODA1IDEyLjE2MTYgMTUuNDE3OU0xMi41IDEwLjAwMkMxMi40OTg5IDExLjM4MTggMTEuMzggMTIuNSAxMCAxMi41QzguNjE5MjkgMTIuNSA3LjUgMTEuMzgwNyA3LjUgOS45OTk5OUM3LjUgOC42MTkyOCA4LjYxOTI5IDcuNDk5OTkgMTAgNy40OTk5OUMxMS4zOCA3LjQ5OTk5IDEyLjQ5ODkgOC42MTgxOSAxMi41IDkuOTk3OThNMTIuNSAxMC4wMDJWOS45OTc5OE0xMi41IDkuOTk3OThWNy40OTk5OSIgc3Ryb2tlPSIjMEYxMTE1IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L2c+Cjwvc3ZnPgo=",
			"collapse": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMTggMTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJDb2xsYXBzZSI+CjxwYXRoIGlkPSJWZWN0b3IiIGQ9Ik00LjUgMTAuNUw5IDZMMTMuNSAxMC41IiBzdHJva2U9IiM2MTY2NkIiIHN0cm9rZS13aWR0aD0iMS4zNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjwvZz4KPC9zdmc+Cg==",
			"check": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Qm94PSIwIDAgMTYgMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJjaGVjayI+CjxwYXRoIGlkPSJWZWN0b3IiIGQ9Ik0zLjMzMzMzIDhMNiAxMC42NjY3TDEyLjY2NjcgNCIgc3Ryb2tlPSIjMjM4MDQ3IiBzdHJva2Utd2lkdGg9IjEuMzMzMzMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L2c+Cjwvc3ZnPgo=",
			"export": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMTggMTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJFeHBvcnQiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNOSAyLjI1VjEwLjEyNU05IDEwLjEyNUw1LjYyNSA2Ljc1TTkgMTAuMTI1TDEyLjM3NSA2Ljc1IiBzdHJva2U9IiM2MTY2NkIiIHN0cm9rZS13aWR0aD0iMS4zNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTIuNjI1IDExLjYyNVYxNC4yNUMyLjYyNSAxNC42NjQyIDIuOTYwNzkgMTUgMy4zNzUgMTVIMTQuNjI1QzE1LjAzOTIgMTUgMTUuMzc1IDE0LjY2NDIgMTUuMzc1IDE0LjI1VjExLjYyNSIgc3Ryb2tlPSIjNjE2NjZCIiBzdHJva2Utd2lkdGg9IjEuMzUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L2c+Cjwvc3ZnPgo=",
			"ingest": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMTggMTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJJbmdlc3QiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNOSAyLjI1VjEwLjEyNU05IDEwLjEyNUw1LjYyNSA2Ljc1TTkgMTAuMTI1TDEyLjM3NSA2Ljc1IiBzdHJva2U9IiM2MTY2NkIiIHN0cm9rZS13aWR0aD0iMS4zNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTIuNjI1IDExLjYyNVYxNC4yNUMyLjYyNSAxNC42NjQyIDIuOTYwNzkgMTUgMy4zNzUgMTVIMTQuNjI1QzE1LjAzOTIgMTUgMTUuMzc1IDE0LjY2NDIgMTUuMzc1IDE0LjI1VjExLjYyNSIgc3Ryb2tlPSIjNjE2NjZCIiBzdHJva2Utd2lkdGg9IjEuMzUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L2c+Cjwvc3ZnPgo=",
			"resize": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMTggMTgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJyZXNpemUiPgo8cGF0aCBpZD0iVmVjdG9yIiBkPSJNOS43NSAxNUwxNSA5Ljc1TTEyLjc1IDE1TDE1IDEyLjc1IiBzdHJva2U9IiM4MTg1OEMiIHN0cm9rZS13aWR0aD0iMS4xMjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L2c+Cjwvc3ZnPgo=",
			"micOff": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiB2aWV3Qm94PSIwIDAgMjAgMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJpY29uIC8gbWljLW9mZiI+CjxwYXRoIGlkPSJ2ZWN0b3IiIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTAgMy43NUM5LjI5Mjc1IDMuNzUgOC42Njc1IDQuMTAxNjUgOC4yODk2MSA0LjY0MzQxQzguMDI2MzEgNS4wMjA4OSA3LjUwNjg1IDUuMTEzNDYgNy4xMjkzNyA0Ljg1MDE1QzYuNzUxODkgNC41ODY4NSA2LjY1OTMzIDQuMDY3NCA2LjkyMjY0IDMuNjg5OTJDNy41OTg4NiAyLjcyMDQ1IDguNzI0OTcgMi4wODMzMyAxMCAyLjA4MzMzQzEyLjA3MTEgMi4wODMzMyAxMy43NSAzLjc2MjI3IDEzLjc1IDUuODMzMzNWOC43NUMxMy43NSA4LjkzMTA3IDEzLjczNzEgOS4xMDk2MiAxMy43MTIxIDkuMjg0NjZDMTMuNjQ2OSA5Ljc0MDI2IDEzLjIyNDcgMTAuMDU2OCAxMi43NjkxIDkuOTkxNkMxMi4zMTM1IDkuOTI2NDMgMTEuOTk3IDkuNTA0MjcgMTIuMDYyMiA5LjA0ODY3QzEyLjA3NjEgOC45NTE1NSAxMi4wODMzIDguODUxODYgMTIuMDgzMyA4Ljc1VjUuODMzMzNDMTIuMDgzMyA0LjY4Mjc0IDExLjE1MDYgMy43NSAxMCAzLjc1Wk0yLjcyNTM5IDMuNTk2NzJDMy4wNDAxNiAzLjI2MDk2IDMuNTY3NTMgMy4yNDM5NCAzLjkwMzI5IDMuNTU4NzJMMTMuODQ5MiAxMi44ODMxQzEzLjg4NTggMTIuOTExOSAxMy45MjAzIDEyLjk0NDEgMTMuOTUyMyAxMi45Nzk3TDE3LjIzNjYgMTYuMDU4N0MxNy41NzI0IDE2LjM3MzUgMTcuNTg5NCAxNi45MDA5IDE3LjI3NDYgMTcuMjM2NkMxNi45NTk4IDE3LjU3MjQgMTYuNDMyNSAxNy41ODk0IDE2LjA5NjcgMTcuMjc0NkwxMy4yMjc0IDE0LjU4NDZDMTIuNTAxNCAxNC45ODY5IDExLjY5MjQgMTUuMjU3OCAxMC44MzMzIDE1LjM2NVYxNi4yNUgxMi4wODMzQzEyLjU0MzYgMTYuMjUgMTIuOTE2NyAxNi42MjMxIDEyLjkxNjcgMTcuMDgzM0MxMi45MTY3IDE3LjU0MzYgMTIuNTQzNiAxNy45MTY3IDEyLjA4MzMgMTcuOTE2N0g3LjkxNjY3QzcuNDU2NDMgMTcuOTE2NyA3LjA4MzM0IDE3LjU0MzYgNy4wODMzNCAxNy4wODMzQzcuMDgzMzQgMTYuNjIzMSA3LjQ1NjQzIDE2LjI1IDcuOTE2NjcgMTYuMjVIOS4xNjY2N1YxNS4zNjUxQzYuNTE3NDYgMTUuMDM0OCA0LjM1MjM3IDEzLjE1MDQgMy42MDk1MiAxMC42NTQ0QzMuNDc4MjQgMTAuMjEzMyAzLjcyOTQxIDkuNzQ5MjQgNC4xNzA1MyA5LjYxNzk2QzQuNjExNjQgOS40ODY2NyA1LjA3NTY2IDkuNzM3ODQgNS4yMDY5NSAxMC4xNzlDNS44MjE4IDEyLjI0NDkgNy43MzYyMiAxMy43NSAxMCAxMy43NUMxMC42ODM2IDEzLjc1IDExLjMzNDMgMTMuNjEzMiAxMS45MjY5IDEzLjM2NTRMMi43NjMzOSA0Ljc3NDYxQzIuNDI3NjIgNC40NTk4NCAyLjQxMDYxIDMuOTMyNDggMi43MjUzOSAzLjU5NjcyWk0xNS44Mjk1IDkuNjE3OTZDMTYuMjcwNiA5Ljc0OTI0IDE2LjUyMTggMTAuMjEzMyAxNi4zOTA1IDEwLjY1NDRDMTYuMjc3NyAxMS4wMzM0IDE2LjEzMjEgMTEuMzk4MiAxNS45NTcyIDExLjc0NTVDMTUuNzUwMSAxMi4xNTY2IDE1LjI0OTEgMTIuMzIxOSAxNC44MzgxIDEyLjExNDlDMTQuNDI3IDExLjkwNzkgMTQuMjYxNiAxMS40MDY4IDE0LjQ2ODcgMTAuOTk1OEMxNC41OTk3IDEwLjczNTYgMTQuNzA4NyAxMC40NjI1IDE0Ljc5MzEgMTAuMTc5QzE0LjkyNDMgOS43Mzc4NCAxNS4zODg0IDkuNDg2NjcgMTUuODI5NSA5LjYxNzk2WiIgZmlsbD0iIzgxODU4QyIvPgo8L2c+Cjwvc3ZnPgo=",
			"systemOff": "data:image/svg+xml;base64,PHN2ZyBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIiBvdmVyZmxvdz0idmlzaWJsZSIgc3R5bGU9ImRpc3BsYXk6IGJsb2NrOyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiB2aWV3Qm94PSIwIDAgMjAgMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGlkPSJpY29uIC8gc291bmQtb2ZmLCBzcGVha2VyIj4KPHBhdGggaWQ9InZlY3RvciIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik05LjU4MzMzIDQuMDkxNTdDOS41ODMzMyAzLjcyOTAyIDkuMTUyMzYgMy41Mzk0NCA4Ljg4NTExIDMuNzg0NDJMNy41MTU3MyA1LjAzOTY4QzcuMTc2NDcgNS4zNTA2OCA2LjY0OTMzIDUuMzI3NzYgNi4zMzgzMyA0Ljk4ODQ5QzYuMDI3MzQgNC42NDkyMiA2LjA1MDI2IDQuMTIyMDkgNi4zODk1MiAzLjgxMTA5TDcuNzU4OSAyLjU1NTgzQzkuMDk1MTUgMS4zMzA5MyAxMS4yNSAyLjI3ODg0IDExLjI1IDQuMDkxNTdMMTEuMjUgNy42NjY2N0MxMS4yNSA4LjEyNjkgMTAuODc2OSA4LjUgMTAuNDE2NyA4LjVDOS45NTY0MyA4LjUgOS41ODMzMyA4LjEyNjkgOS41ODMzMyA3LjY2NjY3TDkuNTgzMzMgNC4wOTE1N1pNMS4wNjA4MiAyLjc2MTE1QzEuMzc2ODMgMi40MjY1NSAxLjkwNDI1IDIuNDExNDggMi4yMzg4NSAyLjcyNzQ5TDE3LjIzODkgMTYuODk0MkMxNy41NzM1IDE3LjIxMDIgMTcuNTg4NSAxNy43Mzc2IDE3LjI3MjUgMTguMDcyMkMxNi45NTY1IDE4LjQwNjggMTYuNDI5MSAxOC40MjE5IDE2LjA5NDUgMTguMTA1OEwxMS4yNSAxMy41MzA1TDExLjI1IDE1LjkwODVDMTEuMjUgMTcuNzIxMiA5LjA5NTE2IDE4LjY2OTEgNy43NTg5IDE3LjQ0NDJMNS41NDE2OSAxNS40MTE4QzUuMjUyNzggMTUuMTQ2OSA0Ljg3NTA5IDE1IDQuNDgzMTcgMTVDMi42OTc1NCAxNSAxLjI1IDEzLjU1MjUgMS4yNSAxMS43NjY5VjguMjMzMTlDMS4yNSA3LjA4NDc3IDEuODQ4MzkgNi4wNzY3NiAyLjc1MDUgNS41MDMxOUwxLjA5NDQ4IDMuOTM5MThDMC43NTk4ODIgMy42MjMxNyAwLjc0NDgxMyAzLjA5NTc1IDEuMDYwODIgMi43NjExNVpNNC4wNDcyOCA2LjcyNzkzQzMuMzk0NDMgNi45MTY1MSAyLjkxNjY3IDcuNTE5NiAyLjkxNjY3IDguMjMzMTlWMTEuNzY2OUMyLjkxNjY3IDEyLjYzMiAzLjYxODAxIDEzLjMzMzQgNC40ODMxNyAxMy4zMzM0QzUuMjkyMDggMTMuMzMzNCA2LjA3MTYgMTMuNjM2NiA2LjY2NzkgMTQuMTgzMkw4Ljg4NTExIDE2LjIxNTZDOS4xNTIzNiAxNi40NjA2IDkuNTgzMzMgMTYuMjcxIDkuNTgzMzMgMTUuOTA4NUw5LjU4MzMzIDExLjk1NjRMNC4wNDcyOCA2LjcyNzkzWk0xNi41MTA3IDUuMjk3MTZDMTYuOTE1MiA1LjA3NzU2IDE3LjQyMTEgNS4yMjc0MiAxNy42NDA3IDUuNjMxODlDMTguMzQ2MiA2LjkzMTI4IDE4Ljc0NjYgOC40MjAxMyAxOC43NDY2IDEwQzE4Ljc0NjYgMTEuNTE2IDE4LjM3NzkgMTIuOTQ4MyAxNy43MjQ2IDE0LjIwOTlDMTcuNTEzIDE0LjYxODYgMTcuMDEwMSAxNC43NzgzIDE2LjYwMTQgMTQuNTY2N0MxNi4xOTI3IDE0LjM1NSAxNi4wMzMgMTMuODUyMiAxNi4yNDQ2IDEzLjQ0MzVDMTYuNzc4MSAxMi40MTMyIDE3LjA3OTkgMTEuMjQzMSAxNy4wNzk5IDEwQzE3LjA3OTkgOC43MDQ3NSAxNi43NTIyIDcuNDg4NTEgMTYuMTc2IDYuNDI3MTNDMTUuOTU2NCA2LjAyMjY3IDE2LjEwNjIgNS41MTY3NiAxNi41MTA3IDUuMjk3MTZaTTEzLjE2NjUgNi41ODM2NkMxMy41MzQ1IDYuMzA3MjUgMTQuMDU2OSA2LjM4MTQ5IDE0LjMzMzMgNi43NDk0OEMxNS4wMTM0IDcuNjU0ODYgMTUuNDE2NyA4Ljc4MTUyIDE1LjQxNjcgOS45OTk5N0MxNS40MTY3IDEwLjU0MzEgMTUuMzM2NSAxMS4wNjkgMTUuMTg2NyAxMS41NjU3QzE1LjA1MzggMTIuMDA2NCAxNC41ODg5IDEyLjI1NTkgMTQuMTQ4MyAxMi4xMjNDMTMuNzA3NiAxMS45OTAxIDEzLjQ1ODEgMTEuNTI1MiAxMy41OTEgMTEuMDg0NkMxMy42OTQyIDEwLjc0MjIgMTMuNzUgMTAuMzc4NCAxMy43NSA5Ljk5OTk3QzEzLjc1IDkuMTU0OCAxMy40NzE0IDguMzc3MTEgMTMuMDAwNyA3Ljc1MDQ0QzEyLjcyNDMgNy4zODI0NSAxMi43OTg1IDYuODYwMDcgMTMuMTY2NSA2LjU4MzY2WiIgZmlsbD0iIzgxODU4QyIvPgo8L2c+Cjwvc3ZnPgo="
		};
		const recordingWavePaths = [
			"M7.245 3C7.65921 3 7.995 3.33579 7.995 3.75V14.25C7.995 14.6642 7.65921 15 7.245 15C6.83079 15 6.495 14.6642 6.495 14.25V3.75C6.495 3.33579 6.83079 3 7.245 3Z",
			"M10.7475 5.25C11.1617 5.25 11.4975 5.58579 11.4975 6V12C11.4975 12.4142 11.1617 12.75 10.7475 12.75C10.3333 12.75 9.9975 12.4142 9.9975 12V6C9.9975 5.58579 10.3333 5.25 10.7475 5.25Z",
			"M3.75 6.75C4.16421 6.75 4.5 7.08579 4.5 7.5V10.5C4.5 10.9142 4.16421 11.25 3.75 11.25C3.33579 11.25 3 10.9142 3 10.5V7.5C3 7.08579 3.33579 6.75 3.75 6.75Z",
			"M14.25 6.75C14.6642 6.75 15 7.08579 15 7.5V10.5C15 10.9142 14.6642 11.25 14.25 11.25C13.8358 11.25 13.5 10.9142 13.5 10.5V7.5C13.5 7.08579 13.8358 6.75 14.25 6.75Z"
		];
		//#endregion
		//#region src/client/RecordingPanel.module.css
		var RecordingPanel_module_default = {
			"actionIcon": "Expx1a_actionIcon",
			"attribution": "Expx1a_attribution",
			"attributionError": "Expx1a_attributionError",
			"attributionField": "Expx1a_attributionField",
			"attributionFields": "Expx1a_attributionFields",
			"attributionInput": "Expx1a_attributionInput",
			"attributionLabel": "Expx1a_attributionLabel",
			"attributionSummary": "Expx1a_attributionSummary",
			"body": "Expx1a_body",
			"caret": "Expx1a_caret",
			"caretIcon": "Expx1a_caretIcon",
			"caretOpen": "Expx1a_caretOpen",
			"check": "Expx1a_check",
			"chip": "Expx1a_chip",
			"collapse": "Expx1a_collapse",
			"control": "Expx1a_control",
			"error": "Expx1a_error",
			"errorControl": "Expx1a_errorControl",
			"expand": "Expx1a_expand",
			"footer": "Expx1a_footer",
			"grip": "Expx1a_grip",
			"header": "Expx1a_header",
			"hint": "Expx1a_hint",
			"icon": "Expx1a_icon",
			"ingest": "Expx1a_ingest",
			"mainControl": "Expx1a_mainControl",
			"menu": "Expx1a_menu",
			"menuCheck": "Expx1a_menuCheck",
			"menuEmpty": "Expx1a_menuEmpty",
			"menuItem": "Expx1a_menuItem",
			"move": "Expx1a_move",
			"noSignal": "Expx1a_noSignal",
			"off": "Expx1a_off",
			"panel": "Expx1a_panel",
			"phase": "Expx1a_phase",
			"play": "Expx1a_play",
			"preview": "Expx1a_preview",
			"previewHeading": "Expx1a_previewHeading",
			"previewTitle": "Expx1a_previewTitle",
			"recognizer": "Expx1a_recognizer",
			"recognizerLabel": "Expx1a_recognizerLabel",
			"recognizerSelect": "Expx1a_recognizerSelect",
			"recordingSpin": "Expx1a_recordingSpin",
			"recordingWave": "Expx1a_recordingWave",
			"resize": "Expx1a_resize",
			"segment": "Expx1a_segment",
			"segmentMeta": "Expx1a_segmentMeta",
			"segments": "Expx1a_segments",
			"spacer": "Expx1a_spacer",
			"spinner": "Expx1a_spinner",
			"split": "Expx1a_split",
			"splitMain": "Expx1a_splitMain",
			"status": "Expx1a_status",
			"stored": "Expx1a_stored",
			"storedError": "Expx1a_storedError",
			"storedErrorDetail": "Expx1a_storedErrorDetail",
			"storedHeading": "Expx1a_storedHeading",
			"storedList": "Expx1a_storedList",
			"storedMeta": "Expx1a_storedMeta",
			"storedRow": "Expx1a_storedRow",
			"storedTitle": "Expx1a_storedTitle",
			"syncButton": "Expx1a_syncButton",
			"syncRow": "Expx1a_syncRow",
			"text": "Expx1a_text",
			"toggle": "Expx1a_toggle",
			"tracks": "Expx1a_tracks",
			"utility": "Expx1a_utility",
			"warning": "Expx1a_warning",
			"wave": "Expx1a_wave"
		};
		//#endregion
		//#region src/client/RecordingPanelControls.tsx
		function RecordingIcon({ name }) {
			const asset = recordingIcons[name];
			return name === "stop" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				className: RecordingPanel_module_default.actionIcon,
				src: asset,
				alt: ""
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"aria-hidden": "true",
				className: `${RecordingPanel_module_default.icon} ${RecordingPanel_module_default[name] ?? ""}`,
				style: { maskImage: `url("${asset}")` }
			});
		}
		function Wave({ view, translate }) {
			const moving = view?.phase === "recording" && [view.mic, view.system].some((track) => track.state === "on" && track.errorCode === null);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: RecordingPanel_module_default.wave,
				"data-recording-wave": moving ? "moving" : "still",
				viewBox: "0 0 18 18",
				width: "18",
				height: "18",
				role: "img",
				"aria-label": translate("panel.activity"),
				children: recordingWavePaths.map((path, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: path,
					fill: "currentColor"
				}, index))
			});
		}
		function MainControl({ pending, pendingAction, run, translate, view }) {
			const recording = view?.phase === "recording";
			const busyPhase = pendingAction === "start" ? "starting" : pendingAction === "stop" ? "finalizing" : view?.phase === "starting" || view?.phase === "finalizing" ? view.phase : null;
			const busy = busyPhase !== null;
			const label = translate(busyPhase === "finalizing" && view?.recordingEndedAtMs == null ? "panel.stopping" : busyPhase !== null ? `phase.${busyPhase}` : recording ? "panel.stop" : view ? "panel.startNew" : "panel.start");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					className: RecordingPanel_module_default.mainControl,
					"aria-label": label,
					disabled: pending || busy,
					onClick: () => void run(recording && view ? {
						action: "stop",
						meeting_id: view.meetingId
					} : { action: "start" }),
					children: [busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: RecordingPanel_module_default.spinner,
						"aria-hidden": "true"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingIcon, { name: recording ? "stop" : "play" }), recording && !busy && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Wave, {
						view,
						translate
					})]
				})
			});
		}
		function IngestControl({ canIngest, ingestion, translate }) {
			const busy = ingestion?.running ?? false;
			const label = translate(busy ? "panel.ingesting" : "panel.ingest");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "ghost",
					className: `${RecordingPanel_module_default.ingest} ${!canIngest ? RecordingPanel_module_default.off : ""}`,
					"aria-label": label,
					"aria-busy": busy,
					disabled: !canIngest || busy,
					onClick: () => void ingestion?.start(),
					children: busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: RecordingPanel_module_default.spinner,
						"aria-hidden": "true"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingIcon, { name: "ingest" })
				})
			});
		}
		function Chevron() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				"aria-hidden": "true",
				viewBox: "0 0 12 12",
				width: "12",
				height: "12",
				className: RecordingPanel_module_default.caretIcon,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3 4.5 6 7.5 9 4.5",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		/** The menu needs roughly this much room above the header before it flips below the control. */
		const MENU_CLEARANCE = 260;
		function opensBelow(anchorTop, clearance = MENU_CLEARANCE) {
			return anchorTop < clearance;
		}
		function DeviceMenu({ anchor, devices, menuRef, onChoose, onClose, selectedUID, track, translate }) {
			const options = devices?.filter((device) => track === "mic" ? device.input_channels > 0 : device.output_channels > 0);
			const [below, setBelow] = (0, react.useState)(false);
			(0, react.useLayoutEffect)(() => {
				if (anchor === null) return;
				setBelow(opensBelow(anchor.getBoundingClientRect().top));
			}, [anchor]);
			const item = (uid, name) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "menuitemradio",
				"aria-checked": selectedUID === uid,
				className: RecordingPanel_module_default.menuItem,
				onClick: () => {
					onChoose(uid);
					onClose();
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: RecordingPanel_module_default.menuCheck,
					children: selectedUID === uid ? "✓" : ""
				}), name]
			}, uid);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: menuRef,
				className: RecordingPanel_module_default.menu,
				"data-below": below ? "true" : void 0,
				role: "menu",
				"aria-label": translate(track === "mic" ? "panel.micDevice" : "panel.systemDevice"),
				children: [item("", translate("panel.deviceDefault")), options === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: RecordingPanel_module_default.menuEmpty,
					role: "menuitem",
					"aria-disabled": "true",
					children: translate("panel.devicesUnavailable")
				}) : options.map((device) => item(device.uid, device.name))]
			});
		}
		function TrackButton({ devices, pending, pendingAction, refreshDevices, run, selectDevice, selectedDevices, track, translate, view }) {
			const state = view?.[track];
			const available = view?.phase === "recording" && pendingAction !== "stop";
			const requested = available && (state?.requested ?? false);
			const action = track === "mic" ? requested ? "mic_off" : "mic_on" : requested ? "system_off" : "system_on";
			const label = translate(track === "mic" ? requested ? "panel.micOn" : "panel.micOff" : requested ? "panel.systemOn" : "panel.systemOff");
			const icon = track === "mic" ? requested ? "mic" : "micOff" : requested ? "system" : "systemOff";
			const selectedUID = track === "mic" ? selectedDevices.mic : selectedDevices.system;
			const [open, setOpen] = (0, react.useState)(false);
			const group = (0, react.useRef)(null);
			const menu = (0, react.useRef)(null);
			const toggleMenu = (0, react.useCallback)(() => {
				setOpen((current) => !current);
				refreshDevices();
			}, [refreshDevices]);
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const dismiss = (event) => {
					if (event instanceof KeyboardEvent && event.key !== "Escape") return;
					const target = event.target;
					if (event instanceof MouseEvent && (group.current?.contains(target) === true || menu.current?.contains(target) === true)) return;
					setOpen(false);
				};
				document.addEventListener("pointerdown", dismiss);
				document.addEventListener("keydown", dismiss);
				return () => {
					document.removeEventListener("pointerdown", dismiss);
					document.removeEventListener("keydown", dismiss);
				};
			}, [open]);
			const chooseDevice = (uid) => {
				selectDevice(track, uid);
			};
			const selectedName = devices?.devices.find((device) => device.uid === selectedUID)?.name;
			const caretLabel = translate(track === "mic" ? "panel.micDevice" : "panel.systemDevice");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: RecordingPanel_module_default.split,
				ref: group,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: selectedName === void 0 ? label : `${label} · ${selectedName}`,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							className: `${RecordingPanel_module_default.control} ${RecordingPanel_module_default.splitMain} ${!requested ? RecordingPanel_module_default.off : ""} ${available && state?.errorCode != null ? RecordingPanel_module_default.warning : ""}`,
							"aria-label": label,
							"aria-pressed": requested,
							disabled: pending || !available,
							onClick: () => view && void run({
								action,
								meeting_id: view.meetingId
							}),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingIcon, { name: icon })
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						className: `${RecordingPanel_module_default.caret} ${open ? RecordingPanel_module_default.caretOpen : ""}`,
						"aria-label": caretLabel,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						onClick: toggleMenu,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, {})
					}),
					open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeviceMenu, {
						anchor: group.current,
						devices: devices?.devices ?? null,
						menuRef: menu,
						selectedUID,
						track,
						translate,
						onChoose: chooseDevice,
						onClose: () => setOpen(false)
					})
				]
			});
		}
		function RecordingControls(props) {
			const canReference = props.hasRecordingHistory || props.view?.recordingStartedAtMs != null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MainControl, { ...props }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IngestControl, { ...props }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrackButton, {
					...props,
					track: "mic"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrackButton, {
					...props,
					track: "system"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: props.translate("panel.join"),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "ghost",
						className: `${RecordingPanel_module_default.control} ${!canReference ? RecordingPanel_module_default.off : ""}`,
						"aria-label": props.translate("panel.join"),
						disabled: props.pending || !canReference,
						onClick: () => void props.join(),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingIcon, { name: "mention" })
					})
				})
			] });
		}
		//#endregion
		//#region src/client/recording-view-state.ts
		/** A live recording owns the draft area, so stored transcripts stay inactive. */
		function isRecordingActive(view) {
			return view?.phase === "starting" || view?.phase === "recording" || view?.phase === "finalizing";
		}
		//#endregion
		//#region src/client/RecognizerSelect.tsx
		function engineOf(value) {
			return value?.asr_engine === "parakeet" ? "parakeet" : "paraformer";
		}
		/**
		* Recognizer family switch for the next recording. The choice is the profile
		* `asr_engine` setting, so it stays in step with the plugin settings page, and
		* it is read on every render instead of subscribed so this panel stays a pure
		* view of the recording state.
		*/
		function RecognizerSelect(props) {
			const { revision, settings, translate } = props;
			const snapshot = settings?.getSnapshot();
			const engine = engineOf(snapshot?.value);
			const selectable = settings !== void 0 && snapshot?.writable === true && snapshot.status === "ready";
			const label = translate("panel.recognizer");
			const change = (value) => {
				const next = value === "parakeet" ? "parakeet" : "paraformer";
				const fence = revision ?? snapshot?.revision;
				if (settings === void 0 || !selectable || next === engine || fence === void 0) return;
				settings.mutate([{
					op: "set",
					path: ["asr_engine"],
					value: next
				}], fence).catch(() => void 0);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: RecordingPanel_module_default.recognizer,
				title: translate("panel.recognizerHint"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: RecordingPanel_module_default.recognizerLabel,
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
					className: RecordingPanel_module_default.recognizerSelect,
					defaultValue: engine,
					disabled: !selectable,
					"aria-label": label,
					onChange: (event) => change(event.target.value),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: "paraformer",
						children: translate("panel.recognizerParaformer")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
						value: "parakeet",
						children: translate("panel.recognizerParakeet")
					})]
				})]
			});
		}
		//#endregion
		//#region src/client/use-recording-panel-layout.ts
		const MARGIN = 12;
		const COMPACT_HEIGHT = 48;
		function viewport() {
			return {
				width: window.innerWidth,
				height: window.innerHeight
			};
		}
		function fit(layout, compactWidth, minimumWidth) {
			const bounds = viewport();
			const availableWidth = Math.max(1, bounds.width - MARGIN * 2);
			const availableHeight = Math.max(1, bounds.height - MARGIN * 2);
			const width = Math.min(availableWidth, Math.max(minimumWidth, layout.width));
			const height = Math.min(availableHeight, Math.max(260, layout.height));
			const visibleWidth = layout.expanded ? width : Math.min(compactWidth, availableWidth);
			const visibleHeight = layout.expanded ? height : Math.min(COMPACT_HEIGHT, availableHeight);
			return {
				...layout,
				width,
				height,
				x: Math.max(MARGIN, Math.min(layout.x, bounds.width - visibleWidth - MARGIN)),
				y: Math.max(MARGIN, Math.min(layout.y, bounds.height - visibleHeight - MARGIN))
			};
		}
		function initialLayout(compactWidth, minimumWidth) {
			const bounds = viewport();
			return fit({
				expanded: false,
				width: Math.max(384, minimumWidth),
				height: 480,
				x: bounds.width - compactWidth - MARGIN,
				y: bounds.height - COMPACT_HEIGHT - MARGIN
			}, compactWidth, minimumWidth);
		}
		function update(layout, kind, x, y, compactWidth, minimumWidth) {
			return fit(kind === "move" ? {
				...layout,
				x: layout.x + x,
				y: layout.y + y
			} : {
				...layout,
				width: layout.width + x,
				height: layout.height + y
			}, compactWidth, minimumWidth);
		}
		function keyboardDelta(event) {
			const step = event.shiftKey ? 40 : 10;
			switch (event.key) {
				case "ArrowLeft": return {
					x: -step,
					y: 0
				};
				case "ArrowRight": return {
					x: step,
					y: 0
				};
				case "ArrowUp": return {
					x: 0,
					y: -step
				};
				case "ArrowDown": return {
					x: 0,
					y: step
				};
				default: return null;
			}
		}
		function gestureHandlers(kind, layout, compactWidth, minimumWidth, gesture, setLayout) {
			return {
				onPointerDown(event) {
					if (event.button !== 0 || gesture.current !== null) return;
					event.preventDefault();
					event.currentTarget.focus();
					event.currentTarget.setPointerCapture(event.pointerId);
					gesture.current = {
						kind,
						pointerId: event.pointerId,
						x: event.clientX,
						y: event.clientY,
						layout
					};
				},
				onPointerMove(event) {
					const active = gesture.current;
					if (active?.pointerId !== event.pointerId) return;
					setLayout(update(active.layout, active.kind, event.clientX - active.x, event.clientY - active.y, compactWidth, minimumWidth));
				},
				onPointerUp(event) {
					if (gesture.current?.pointerId !== event.pointerId) return;
					if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
					gesture.current = null;
				},
				onLostPointerCapture() {
					gesture.current = null;
				},
				onPointerCancel() {
					gesture.current = null;
				},
				onKeyDown(event) {
					const delta = keyboardDelta(event);
					if (delta === null) return;
					event.preventDefault();
					setLayout((previous) => update(previous, kind, delta.x, delta.y, compactWidth, minimumWidth));
				}
			};
		}
		/**
		* `minimumWidth` is the intrinsic width of the header: the panel never shrinks below it,
		* so the controls keep their size instead of being squeezed when the window opens.
		*/
		function useRecordingPanelLayout(compactWidth, minimumWidth = 300) {
			const [layout, setLayout] = (0, react.useState)(() => initialLayout(compactWidth, minimumWidth));
			const gesture = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const resize = () => setLayout((previous) => fit(previous, compactWidth, minimumWidth));
				resize();
				window.addEventListener("resize", resize);
				return () => window.removeEventListener("resize", resize);
			}, [compactWidth, minimumWidth]);
			const style = {
				left: layout.x,
				top: layout.y,
				width: layout.expanded ? layout.width : Math.max(1, Math.min(compactWidth, viewport().width - MARGIN * 2)),
				height: layout.expanded ? layout.height : Math.max(1, Math.min(COMPACT_HEIGHT, viewport().height - MARGIN * 2))
			};
			return {
				expanded: layout.expanded,
				style,
				move: gestureHandlers("move", layout, compactWidth, minimumWidth, gesture, setLayout),
				resize: gestureHandlers("resize", layout, compactWidth, minimumWidth, gesture, setLayout),
				toggle: () => setLayout((previous) => fit({
					...previous,
					expanded: !previous.expanded
				}, compactWidth, minimumWidth)),
				reset: () => setLayout((previous) => fit({
					...previous,
					x: viewport().width - previous.width - MARGIN,
					y: viewport().height - previous.height - MARGIN
				}, compactWidth, minimumWidth))
			};
		}
		//#endregion
		//#region src/client/RecordingPanelView.tsx
		/**
		* Ingestion is user-driven: it becomes available only for a committed
		* transcript that is currently displayed and only while no recording owns the
		* draft area.
		*/
		function canIngest(props) {
			const stored = props.storedMeetings;
			if (stored === void 0 || props.ingestion === void 0 || props.ingestion.running) return false;
			if (isRecordingActive(props.view) || props.pending) return false;
			if (stored.selected !== null) return stored.transcript !== null && !stored.transcriptLoading && stored.transcriptError === null;
			return props.view?.transcriptVersion !== null && props.view?.transcriptVersion !== void 0;
		}
		function phaseState(view) {
			if (waitingForSound(view)) return "warning";
			if (isRecordingActive(view)) return "ongoing";
			if (view?.phase === "failed") return "error";
			if (view?.phase === "partial") return "warning";
			return view?.phase === "completed" ? "done" : "idle";
		}
		function waitingForSound(view) {
			return view?.phase === "recording" && (view.mic.requested || view.system.requested) && ![view.mic, view.system].some((track) => track.state === "on" && track.errorCode === null);
		}
		function freshness(view, translate) {
			if (view?.latestDraftAtMs === null || view?.latestDraftAtMs === void 0) return translate("panel.draftWaiting");
			return translate("panel.draftFresh", { seconds: String(Math.max(0, Math.round((Date.now() - view.latestDraftAtMs) / 1e3))) });
		}
		function RecordingStatus({ pendingAction, translate, view }) {
			const time = view?.durationMs ?? view?.recordingElapsedMs;
			const phase = pendingAction === "start" ? "starting" : pendingAction === "stop" ? "finalizing" : view?.phase;
			const stopping = phase === "finalizing" && view?.recordingEndedAtMs == null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: RecordingPanel_module_default.status,
				"aria-live": "polite",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: RecordingPanel_module_default.phase,
					children: [view?.phase === "completed" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingIcon, { name: "check" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
						size: 6,
						state: phaseState(view)
					}), phase === void 0 ? translate("panel.phase.none") : stopping ? translate("panel.stopping") : phase === "recording" && waitingForSound(view) ? translate("panel.waitingForSound") : translate(`phase.${phase}`)]
				}), time !== null && time !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: RecordingPanel_module_default.hint,
					children: durationClock(time)
				})]
			}), view !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: RecordingPanel_module_default.tracks,
				children: ["mic", "system"].map((track) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: `${RecordingPanel_module_default.chip} ${view[track].errorCode !== null ? RecordingPanel_module_default.warning : ""}`,
					children: [
						translate(track === "mic" ? "panel.mic" : "panel.system"),
						" ",
						translate(view[track].errorCode === "SYSTEM_AUDIO_NO_SIGNAL" ? "panel.track.noSignal" : `panel.track.${view[track].state}`)
					]
				}, track))
			})] });
		}
		function Preview({ attribution, preview, stored, translate, view }) {
			const names = attribution?.names ?? {};
			const storedPreview = stored ?? null;
			const title = translate(storedPreview === null ? "panel.previewAria" : "panel.storedTitle");
			const storedHint = storedPreview?.failed === true ? "panel.storedLoadFailed" : storedPreview?.version === null || storedPreview?.version === void 0 ? "panel.storedLoading" : "panel.storedEmptyTranscript";
			const empty = preview.length === 0 ? storedPreview === null ? translate(view === null ? "panel.readyHint" : "panel.draftWaiting") : translate(storedHint) : null;
			const chip = storedPreview === null ? translate("panel.previewSpeaker") : storedPreview.failed === true ? translate("panel.storedLoadFailed") : storedPreview.version === null ? translate("panel.storedLoading") : translate("panel.storedVersion", { version: String(storedPreview.version) });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: RecordingPanel_module_default.preview,
				"aria-label": title,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RecordingPanel_module_default.previewHeading,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: RecordingPanel_module_default.previewTitle,
						children: title
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: RecordingPanel_module_default.chip,
						children: chip
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RecordingPanel_module_default.segments,
					children: [empty !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: RecordingPanel_module_default.hint,
						children: empty
					}), preview.map((segment) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RecordingPanel_module_default.segment,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: RecordingPanel_module_default.segmentMeta,
							children: [durationClock(segment.startMs), segment.speakerLabel !== null && ` · ${speakerNameFor(segment.speakerLabel, names)}`]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: RecordingPanel_module_default.text,
							children: segment.text
						})]
					}, segment.seq))]
				})]
			});
		}
		function storedDate(entry) {
			if (entry.started_at === null) return "";
			const date = new Date(entry.started_at);
			return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
		}
		function ingestionFailureKey(failure) {
			if (failure === "notConfigured") return "panel.ingestNotConfigured";
			if (failure === "busy") return "panel.ingestBusy";
			if (failure === "timeout") return "panel.ingestTimeout";
			if (failure === "noModel") return "panel.ingestNoModel";
			if (failure === "noTranscript") return "panel.ingestNoTranscript";
			return "panel.ingestFailed";
		}
		/** Maps a sync refusal to the sentence the panel shows under the heading. */
		function syncFailureKey(failure) {
			if (failure === "notConfigured") return "panel.syncNotConfigured";
			if (failure === "missingFolder") return "panel.syncMissingFolder";
			return "panel.syncFailed";
		}
		/** Committed meetings the panel can preview and ingest into the knowledge base. */
		function StoredMeetingsSection({ ingestion, storedMeetings, translate }) {
			if (storedMeetings === void 0) return null;
			const { disabled, entries, error, loading, select, selected, transcriptError, transcriptLoading, sync } = storedMeetings;
			const busy = ingestion?.running ?? false;
			const failure = ingestion?.outcome === "failed" ? ingestion.failure : null;
			const emptyHint = error === null ? translate("panel.storedEmpty") : translate("panel.storedLoadFailed");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: RecordingPanel_module_default.stored,
				"aria-label": translate("panel.storedMeetings"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RecordingPanel_module_default.storedHeading,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: RecordingPanel_module_default.previewTitle,
								children: translate("panel.storedMeetings")
							}),
							loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: RecordingPanel_module_default.spinner,
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								className: RecordingPanel_module_default.syncButton,
								"aria-busy": sync.busy,
								disabled: sync.busy,
								onClick: sync.request,
								children: translate("panel.sync")
							})
						]
					}),
					sync.pending !== null && sync.pending > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: RecordingPanel_module_default.syncRow,
						role: "status",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: RecordingPanel_module_default.hint,
								children: translate("panel.syncConfirm", { count: String(sync.pending) })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								onClick: sync.confirm,
								children: translate("panel.syncRemove")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								onClick: sync.cancel,
								children: translate("panel.syncCancel")
							})
						]
					}),
					sync.pending === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.hint,
						role: "status",
						children: translate("panel.syncNothing")
					}),
					sync.removed !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.hint,
						role: "status",
						children: translate("panel.syncDone", { count: String(sync.removed) })
					}),
					sync.failure !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.storedError,
						role: "alert",
						children: translate(syncFailureKey(sync.failure))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.hint,
						children: translate("panel.storedHint")
					}),
					entries.length === 0 && !loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.hint,
						children: emptyHint
					}),
					entries.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: RecordingPanel_module_default.storedList,
						role: "listbox",
						"aria-label": translate("panel.storedMeetings"),
						children: entries.map((entry) => {
							const ingested = entry.ingested_transcript_version !== null && entry.ingested_transcript_version >= entry.transcript_version;
							const date = storedDate(entry);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "option",
								"aria-selected": selected?.meeting_id === entry.meeting_id,
								className: RecordingPanel_module_default.storedRow,
								disabled: disabled || busy,
								onClick: () => select(entry),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: RecordingPanel_module_default.storedTitle,
										children: entry.title === "" ? translate("panel.storedUntitled") : entry.title
									}),
									date !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: RecordingPanel_module_default.storedMeta,
										children: date
									}),
									ingested && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: RecordingPanel_module_default.chip,
										children: translate("panel.storedIngested")
									})
								]
							}, entry.meeting_id);
						})
					}),
					transcriptLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.hint,
						role: "status",
						children: translate("panel.storedLoading")
					}),
					transcriptError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.storedError,
						role: "alert",
						children: translate("panel.storedLoadFailed")
					}),
					ingestion?.outcome === "succeeded" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.hint,
						role: "status",
						children: translate("panel.ingested")
					}),
					failure !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.storedError,
						role: "alert",
						children: translate(ingestionFailureKey(failure))
					}),
					ingestion?.detail != null && ingestion.detail !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.storedErrorDetail,
						role: "status",
						children: ingestion.detail
					})
				]
			});
		}
		/**
		* Optional renaming of the detected speaker labels for the exported file. The
		* stored transcript keeps its labels; only the export applies the names.
		*/
		function SpeakerAttributionSection({ attribution, translate }) {
			if (attribution === void 0 || attribution.labels.length === 0) return null;
			const { failure, labels, names, saving, update } = attribution;
			const duplicates = duplicateSpeakerNames(labels, names);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: RecordingPanel_module_default.attribution,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
						className: RecordingPanel_module_default.attributionSummary,
						children: translate("panel.attribution")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.hint,
						children: translate("panel.attributionHint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: RecordingPanel_module_default.attributionFields,
						children: labels.map((label) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: RecordingPanel_module_default.attributionField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: RecordingPanel_module_default.attributionLabel,
								children: label
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: RecordingPanel_module_default.attributionInput,
								type: "text",
								value: names[label] ?? "",
								"aria-label": label,
								placeholder: label,
								maxLength: 60,
								spellCheck: false,
								onChange: (event) => update(label, event.target.value)
							})]
						}, label))
					}),
					duplicates.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: `${RecordingPanel_module_default.hint} ${RecordingPanel_module_default.warning}`,
						role: "status",
						children: translate("panel.attributionDuplicate", { names: duplicates.join(" · ") })
					}),
					saving && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: RecordingPanel_module_default.hint,
						role: "status",
						children: translate("panel.attributionSaving")
					})
				]
			}), failure !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: RecordingPanel_module_default.attributionError,
				role: "alert",
				children: translate(failure.action === "load" ? "panel.attributionLoadFailed" : "panel.attributionSaveFailed")
			})] });
		}
		function FooterStatus({ translate, view }) {
			const text = isRecordingActive(view) ? view?.draftStale ? translate("panel.draftStale") : freshness(view, translate) : view?.finalizationMs === null || view?.finalizationMs === void 0 ? translate("panel.previewHint") : translate("panel.finalization", { seconds: String(Math.round(view.finalizationMs / 100) / 10) });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: `${RecordingPanel_module_default.hint} ${view?.draftStale ? RecordingPanel_module_default.warning : ""}`,
				children: text
			});
		}
		function RecordingPanelView(props) {
			const { translate } = props;
			const codes = [...new Set([
				props.failure,
				props.view?.mic.errorCode,
				props.view?.system.errorCode
			].filter((code) => code != null))];
			const noSignal = codes.length === 1 && codes[0] === "SYSTEM_AUDIO_NO_SIGNAL";
			const failure = codes.length === 0 ? null : [...new Set(codes.map((code) => recordingErrorCopy(code, translate)))].join("\n");
			const headerRef = (0, react.useRef)(null);
			const [headerWidth, setHeaderWidth] = (0, react.useState)(0);
			const compactWidth = Math.max(260, headerWidth);
			const layout = useRecordingPanelLayout(compactWidth, Math.max(300, compactWidth));
			(0, react.useEffect)(() => {
				if (!layout.expanded || props.prepare === void 0) return;
				const controller = new AbortController();
				props.prepare(controller.signal).catch(() => void 0);
				return () => controller.abort();
			}, [layout.expanded, props.prepare]);
			(0, react.useEffect)(() => {
				const header = headerRef.current;
				if (header === null) return void 0;
				const measure = () => {
					const children = Array.from(header.children);
					setHeaderWidth(Math.ceil(children.reduce((total, child) => total + child.offsetWidth, 0) + Math.max(0, children.length - 1) * 4 + 10));
				};
				measure();
				const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
				observer?.observe(header);
				window.addEventListener("resize", measure);
				return () => {
					observer?.disconnect();
					window.removeEventListener("resize", measure);
				};
			}, [failure, layout.expanded]);
			const toggleLabel = translate(layout.expanded ? "panel.collapse" : "panel.expand");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: RecordingPanel_module_default.panel,
				"data-expanded": layout.expanded,
				style: layout.style,
				"aria-label": translate("panel.aria"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: RecordingPanel_module_default.header,
					ref: headerRef,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: RecordingPanel_module_default.move,
							"aria-label": translate("panel.move"),
							...layout.move,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingIcon, { name: "grip" })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingControls, {
							...props,
							canIngest: canIngest(props)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: RecordingPanel_module_default.spacer }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecognizerSelect, {
							revision: props.settingsRevision,
							settings: props.settings,
							translate
						}),
						failure !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: failure,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								className: `${RecordingPanel_module_default.errorControl} ${noSignal ? RecordingPanel_module_default.noSignal : ""}`,
								"aria-label": failure,
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
								onClick: () => !layout.expanded && layout.toggle()
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: RecordingPanel_module_default.toggle,
							"aria-label": toggleLabel,
							"aria-expanded": layout.expanded,
							onClick: layout.toggle,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingIcon, { name: layout.expanded ? "collapse" : "expand" })
						})
					]
				}), layout.expanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: RecordingPanel_module_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingStatus, { ...props }),
						failure !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: `${RecordingPanel_module_default.error} ${noSignal ? RecordingPanel_module_default.noSignal : ""}`,
							role: "alert",
							children: failure
						}),
						codes.some((code) => /^[A-Z][A-Z0-9_]{0,99}$/.test(code)) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: translate("panel.error.details") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: codes.filter((code) => /^[A-Z][A-Z0-9_]{0,99}$/.test(code)).join(" · ") })] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Preview, { ...props }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SpeakerAttributionSection, {
							attribution: props.attribution,
							translate
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StoredMeetingsSection, { ...props })
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
					className: RecordingPanel_module_default.footer,
					children: [
						props.exportNotice != null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: RecordingPanel_module_default.hint,
							children: props.exportNotice
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FooterStatus, { ...props }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: translate("panel.exportHint"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								className: RecordingPanel_module_default.utility,
								"aria-label": props.pendingAction === "export" ? translate("panel.exporting") : translate("panel.export"),
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingIcon, { name: "export" }),
								"aria-busy": props.pendingAction === "export",
								disabled: props.exportTranscript === void 0 || props.pending || props.view?.transcriptVersion == null,
								onClick: (event) => void props.exportTranscript?.(event.altKey)
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: translate("panel.reset"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								className: RecordingPanel_module_default.utility,
								"aria-label": translate("panel.reset"),
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {}),
								onClick: layout.reset
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: RecordingPanel_module_default.resize,
							"aria-label": translate("panel.resize"),
							...layout.resize,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingIcon, { name: "resize" })
						})
					]
				})] })]
			});
		}
		//#endregion
		//#region src/client/recording-rpc-client.ts
		function speakerNameMap(value) {
			const names = {};
			for (const [label, name] of Object.entries(record(value))) {
				if (label === "" || typeof name !== "string" || name === "") throw new Error("INVALID_RESPONSE");
				names[label] = name;
			}
			return names;
		}
		const UUID_PATTERN$1 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
		/** One row of the panel's stored-meeting list. */
		function storedMeeting(value) {
			const item = record(value);
			exact(item, [
				"meeting_id",
				"title",
				"started_at",
				"duration_ms",
				"transcript_version",
				"status",
				"ingested_transcript_version"
			]);
			if (typeof item.meeting_id !== "string" || !UUID_PATTERN$1.test(item.meeting_id)) throw new Error("INVALID_RESPONSE");
			if (typeof item.title !== "string") throw new Error("INVALID_RESPONSE");
			if (item.status !== "completed" && item.status !== "partial") throw new Error("INVALID_RESPONSE");
			const ingested = item.ingested_transcript_version;
			return {
				meeting_id: item.meeting_id,
				title: item.title,
				started_at: nullableString(item.started_at),
				duration_ms: item.duration_ms === null ? null : nonnegativeInteger(item.duration_ms),
				transcript_version: nonnegativeInteger(item.transcript_version),
				status: item.status,
				ingested_transcript_version: ingested === null ? null : nonnegativeInteger(ingested)
			};
		}
		function okfIngestValue(value) {
			const item = record(value);
			exact(item, [
				"job_id",
				"state",
				"transcript_version",
				"error_code",
				"message"
			]);
			const state = item.state;
			if (state !== "idle" && state !== "running" && state !== "succeeded" && state !== "failed") throw new Error("INVALID_RESPONSE");
			return {
				job_id: nullableString(item.job_id),
				state,
				transcript_version: item.transcript_version === null ? null : nonnegativeInteger(item.transcript_version),
				error_code: nullableString(item.error_code),
				message: nullableString(item.message)
			};
		}
		function storedMeetingsSyncValue(value) {
			const item = record(value);
			exact(item, ["removed", "kept"]);
			return {
				removed: nonnegativeInteger(item.removed),
				kept: nonnegativeInteger(item.kept)
			};
		}
		function record(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_RESPONSE");
			return value;
		}
		function exact(value, keys) {
			if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error("INVALID_RESPONSE");
		}
		function nullableString(value) {
			if (value === null || typeof value === "string") return value;
			throw new Error("INVALID_RESPONSE");
		}
		function nonnegativeInteger(value) {
			if (Number.isSafeInteger(value) && Number(value) >= 0) return Number(value);
			throw new Error("INVALID_RESPONSE");
		}
		function nullableNonnegativeInteger(value) {
			return value === null ? null : nonnegativeInteger(value);
		}
		function timestamp(value) {
			if (typeof value !== "string" || new Date(value).toISOString() !== value) throw new Error("INVALID_RESPONSE");
			return value;
		}
		function nullableTimestamp(value) {
			return value === null ? null : timestamp(value);
		}
		function phase(value) {
			if ([
				"starting",
				"recording",
				"finalizing",
				"completed",
				"empty",
				"partial",
				"failed",
				"cancelled"
			].includes(value)) return value;
			throw new Error("INVALID_RESPONSE");
		}
		function referencePhase(value) {
			return value === "processing" ? value : phase(value);
		}
		function resultStatus(value) {
			if (value === null || value === "completed" || value === "empty" || value === "partial") return value;
			throw new Error("INVALID_RESPONSE");
		}
		function track(value) {
			const item = record(value);
			exact(item, [
				"errorCode",
				"requested",
				"state"
			]);
			if (typeof item.requested !== "boolean" || item.state !== "off" && item.state !== "on" && item.state !== "failed") throw new Error("INVALID_RESPONSE");
			return {
				errorCode: nullableString(item.errorCode),
				requested: item.requested,
				state: item.state
			};
		}
		function parseRecordingRpcView(value) {
			const item = record(value);
			exact(item, [
				"meetingId",
				"jobId",
				"phase",
				"mic",
				"system",
				"draftRevision",
				"draftStale",
				"latestAudioAtMs",
				"latestDraftAtMs",
				"recordingStartedAtMs",
				"recordingEndedAtMs",
				"recordingElapsedMs",
				"durationMs",
				"transcriptVersion",
				"resultStatus",
				"finalizationMs",
				"errorCode"
			]);
			if (typeof item.meetingId !== "string" || !UUID_PATTERN$1.test(item.meetingId) || typeof item.jobId !== "string" || typeof item.draftStale !== "boolean") throw new Error("INVALID_RESPONSE");
			const recordingStartedAtMs = nullableNonnegativeInteger(item.recordingStartedAtMs);
			const recordingEndedAtMs = nullableNonnegativeInteger(item.recordingEndedAtMs);
			const recordingElapsedMs = nullableNonnegativeInteger(item.recordingElapsedMs);
			if (recordingStartedAtMs === null && recordingElapsedMs !== null || recordingEndedAtMs !== null && (recordingStartedAtMs === null || recordingEndedAtMs < recordingStartedAtMs || recordingElapsedMs !== recordingEndedAtMs - recordingStartedAtMs)) throw new Error("INVALID_RESPONSE");
			return {
				meetingId: item.meetingId,
				jobId: item.jobId,
				phase: phase(item.phase),
				mic: track(item.mic),
				system: track(item.system),
				draftRevision: nonnegativeInteger(item.draftRevision),
				draftStale: item.draftStale,
				latestAudioAtMs: nullableNonnegativeInteger(item.latestAudioAtMs),
				latestDraftAtMs: nullableNonnegativeInteger(item.latestDraftAtMs),
				recordingStartedAtMs,
				recordingEndedAtMs,
				recordingElapsedMs,
				durationMs: nullableNonnegativeInteger(item.durationMs),
				transcriptVersion: nullableNonnegativeInteger(item.transcriptVersion),
				resultStatus: resultStatus(item.resultStatus),
				finalizationMs: nullableNonnegativeInteger(item.finalizationMs),
				errorCode: nullableString(item.errorCode)
			};
		}
		function segment(value) {
			const item = record(value);
			exact(item, [
				"seq",
				"startMs",
				"endMs",
				"speakerLabel",
				"text"
			]);
			if (typeof item.text !== "string") throw new Error("INVALID_RESPONSE");
			const seq = nonnegativeInteger(item.seq);
			const startMs = nonnegativeInteger(item.startMs);
			const endMs = nonnegativeInteger(item.endMs);
			if (endMs < startMs) throw new Error("INVALID_RESPONSE");
			return {
				seq,
				startMs,
				endMs,
				speakerLabel: nullableString(item.speakerLabel),
				text: item.text
			};
		}
		function parseState(value) {
			const item = record(value);
			exact(item, [
				"recording",
				"preview",
				"hasRecordingHistory"
			]);
			if (typeof item.hasRecordingHistory !== "boolean") throw new Error("INVALID_RESPONSE");
			if (!Array.isArray(item.preview)) throw new Error("INVALID_RESPONSE");
			return {
				recording: item.recording === null ? null : parseRecordingRpcView(item.recording),
				hasRecordingHistory: item.hasRecordingHistory,
				preview: item.preview.map(segment)
			};
		}
		function referenceCandidate(value) {
			const item = record(value);
			exact(item, [
				"meeting_id",
				"label",
				"origin",
				"phase",
				"started_at",
				"created_at",
				"recording_elapsed_ms",
				"duration_ms"
			]);
			if (typeof item.meeting_id !== "string" || !UUID_PATTERN$1.test(item.meeting_id) || typeof item.label !== "string" || item.label.length < 1 || item.label.length > 255 || item.origin !== "import" && item.origin !== "recording") throw new Error("INVALID_RESPONSE");
			return {
				meeting_id: item.meeting_id,
				label: item.label,
				origin: item.origin,
				phase: referencePhase(item.phase),
				started_at: nullableTimestamp(item.started_at),
				created_at: timestamp(item.created_at),
				recording_elapsed_ms: nullableNonnegativeInteger(item.recording_elapsed_ms),
				duration_ms: nullableNonnegativeInteger(item.duration_ms)
			};
		}
		function referenceCandidates(value) {
			if (!Array.isArray(value) || value.length > 20) throw new Error("INVALID_RESPONSE");
			return value.map(referenceCandidate);
		}
		function transcriptExportValue(value) {
			const item = record(value);
			exact(item, [
				"bytes",
				"format",
				"meeting_id",
				"output_path",
				"segment_count",
				"transcript_version"
			]);
			if (typeof item.meeting_id !== "string" || !UUID_PATTERN$1.test(item.meeting_id) || typeof item.output_path !== "string" || !item.output_path.startsWith("/") || item.format !== "md" && item.format !== "txt" && item.format !== "srt" && item.format !== "vtt") throw new Error("INVALID_RESPONSE");
			return {
				bytes: nonnegativeInteger(item.bytes),
				format: item.format,
				meeting_id: item.meeting_id,
				output_path: item.output_path,
				segment_count: nonnegativeInteger(item.segment_count),
				transcript_version: nonnegativeInteger(item.transcript_version)
			};
		}
		function audioDevice(value) {
			const item = record(value);
			exact(item, [
				"uid",
				"name",
				"input_channels",
				"output_channels",
				"default_input",
				"default_output"
			]);
			if (typeof item.uid !== "string" || item.uid.length === 0 || typeof item.name !== "string" || item.name.length === 0 || typeof item.default_input !== "boolean" || typeof item.default_output !== "boolean") throw new Error("INVALID_RESPONSE");
			return {
				uid: item.uid,
				name: item.name,
				input_channels: nonnegativeInteger(item.input_channels),
				output_channels: nonnegativeInteger(item.output_channels),
				default_input: item.default_input,
				default_output: item.default_output
			};
		}
		function audioDeviceInventory(value) {
			const item = record(value);
			exact(item, [
				"default_input_uid",
				"default_output_uid",
				"devices"
			]);
			if (!Array.isArray(item.devices)) throw new Error("INVALID_RESPONSE");
			return {
				default_input_uid: nullableString(item.default_input_uid),
				default_output_uid: nullableString(item.default_output_uid),
				devices: item.devices.map(audioDevice)
			};
		}
		async function call(rpc, endpoint, payload, signal) {
			const result = await callRecordingRpc(rpc, endpoint, payload, signal);
			if (!result.ok) throw new Error(result.error.message);
			return result.value;
		}
		var RecordingRpcClient = class {
			constructor(rpc) {
				this.rpc = rpc;
			}
			async prepareModels(signal) {
				if (await call(this.rpc, "models/prepare", {}, signal) !== null) throw new Error("INVALID_RESPONSE");
			}
			async state(signal) {
				return parseState(await call(this.rpc, "state", {}, signal));
			}
			async referenceCandidates(payload, signal) {
				return referenceCandidates(await call(this.rpc, "references/candidates", payload, signal));
			}
			async resolveMeetingReference(payload, signal) {
				return referenceCandidate(await call(this.rpc, "references/resolve", payload, signal));
			}
			async control(payload, signal) {
				return parseRecordingRpcView(await call(this.rpc, "control", payload, signal));
			}
			async exportTranscript(payload, signal) {
				return transcriptExportValue(await call(this.rpc, "transcripts/export", payload, signal));
			}
			/** Speaker label to display name for one meeting; unnamed labels are absent. */
			async speakerNames(payload, signal) {
				const value = record(await call(this.rpc, "transcripts/speaker-names", payload, signal));
				exact(value, ["speaker_names"]);
				return { speaker_names: speakerNameMap(value.speaker_names) };
			}
			/** Replaces the stored attribution for one meeting; an empty map clears it. */
			async saveSpeakerNames(payload, signal) {
				const value = record(await call(this.rpc, "transcripts/save-speaker-names", payload, signal));
				exact(value, ["speaker_names"]);
				return { speaker_names: speakerNameMap(value.speaker_names) };
			}
			/** Stored meetings the panel can load into its draft view, newest first. */
			async listMeetings(limit, signal) {
				const value = record(await call(this.rpc, "meetings/list", limit === void 0 ? {} : { limit }, signal));
				exact(value, ["items"]);
				if (!Array.isArray(value.items)) throw new Error("INVALID_RESPONSE");
				return value.items.map(storedMeeting);
			}
			/** Committed transcript of one stored meeting, for the draft view. */
			async meetingTranscript(payload, signal) {
				const value = record(await call(this.rpc, "meetings/transcript", payload, signal));
				exact(value, [
					"meeting_id",
					"title",
					"transcript_version",
					"duration_ms",
					"segments"
				]);
				if (typeof value.meeting_id !== "string" || !UUID_PATTERN$1.test(value.meeting_id)) throw new Error("INVALID_RESPONSE");
				if (typeof value.title !== "string") throw new Error("INVALID_RESPONSE");
				if (!Array.isArray(value.segments)) throw new Error("INVALID_RESPONSE");
				return {
					meeting_id: value.meeting_id,
					title: value.title,
					transcript_version: nonnegativeInteger(value.transcript_version),
					duration_ms: value.duration_ms === null ? null : nonnegativeInteger(value.duration_ms),
					segments: value.segments.map(segment)
				};
			}
			/** Starts one ingestion run for a stored meeting. */
			async ingestMeeting(payload, signal) {
				return okfIngestValue(await call(this.rpc, "okf/ingest", payload, signal));
			}
			/** Reads the current or last ingestion attempt for one stored meeting. */
			async ingestionStatus(payload, signal) {
				return okfIngestValue(await call(this.rpc, "okf/ingest/status", payload, signal));
			}
			/** Counts, or removes, the stored meetings the OKF folder does not hold. */
			async syncMeetings(payload, signal) {
				return storedMeetingsSyncValue(await call(this.rpc, "meetings/sync", payload, signal));
			}
			/** Lists CoreAudio devices through the signed helper. */
			async listDevices(signal) {
				return audioDeviceInventory(await call(this.rpc, "devices/list", {}, signal));
			}
			/** Resolves the folder the user picked, or null when the dialog was cancelled. */
			async chooseTranscriptDirectory(signal) {
				const value = await call(this.rpc, "transcripts/choose-directory", {}, signal);
				if (value === null) return null;
				if (typeof value !== "string" || !value.startsWith("/")) throw new Error("INVALID_RESPONSE");
				return value;
			}
			/** Resolves the Open knowledge base folder the user picked, or null when cancelled. */
			async chooseOkfDirectory(signal) {
				const value = await call(this.rpc, "okf/choose-directory", {}, signal);
				if (value === null) return null;
				if (typeof value !== "string" || !value.startsWith("/")) throw new Error("INVALID_RESPONSE");
				return value;
			}
		};
		//#endregion
		//#region src/client/use-stored-meetings.ts
		/** Poll cadence while the host works on an ingestion. */
		const INGEST_POLL_MS = 2e3;
		function pause(ms, signal) {
			return new Promise((resolve) => {
				if (signal.aborted) {
					resolve();
					return;
				}
				let timer;
				const onAbort = () => {
					clearTimeout(timer);
					resolve();
				};
				timer = setTimeout(() => {
					signal.removeEventListener("abort", onAbort);
					resolve();
				}, ms);
				signal.addEventListener("abort", onAbort, { once: true });
			});
		}
		function errorCode$1(cause) {
			if (cause instanceof Error) return cause.message;
			return typeof cause === "string" ? cause : null;
		}
		/**
		* Only the categories the panel can explain are kept; the raw message may name
		* a folder, a transcript or an internal failure and must never reach the UI.
		* A failed RPC wraps the host code inside its message, so match on containment.
		*/
		function ingestionFailure(code) {
			if (code === null) return "unavailable";
			if (code.includes("OKF_NOT_CONFIGURED")) return "notConfigured";
			if (code.includes("OKF_BUSY")) return "busy";
			if (code.includes("OKF_NO_MODEL")) return "noModel";
			if (code.includes("OKF_NO_TRANSCRIPT")) return "noTranscript";
			return "unavailable";
		}
		/** Maps a sync refusal to the one sentence the panel can show. */
		function syncFailure(code) {
			if (code !== null && code.includes("OKF_NOT_CONFIGURED")) return "notConfigured";
			if (code !== null && code.includes("OKF_INVALID_DIRECTORY")) return "missingFolder";
			return "failed";
		}
		/**
		* Starts one user-driven ingestion and polls its attempt until it settles.
		* The poll is bounded; a timeout shows the same short retry message as a
		* failure instead of leaving the button spinning forever.
		*/
		function useMeetingIngestion(options) {
			const { client, meetingId, mounted, onIngested } = options;
			const [running, setRunning] = (0, react.useState)(false);
			const [outcome, setOutcome] = (0, react.useState)(null);
			const [failure, setFailure] = (0, react.useState)(null);
			const [detail, setDetail] = (0, react.useState)(null);
			const active = (0, react.useRef)(null);
			const generation = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				setOutcome(null);
				setFailure(null);
				setDetail(null);
				return () => {
					generation.current += 1;
					active.current?.abort();
					setRunning(false);
				};
			}, [meetingId]);
			return {
				running,
				outcome,
				failure,
				detail,
				start: (0, react.useCallback)(() => {
					if (meetingId === null) return;
					const controller = new AbortController();
					active.current?.abort();
					active.current = controller;
					const request = ++generation.current;
					setRunning(true);
					setOutcome(null);
					setFailure(null);
					setDetail(null);
					(async () => {
						let status;
						try {
							status = await client.ingestMeeting({ meeting_id: meetingId }, controller.signal);
							for (let attempt = 0; status.state !== "succeeded" && status.state !== "failed" && attempt < 150; attempt += 1) {
								await pause(INGEST_POLL_MS, controller.signal);
								if (controller.signal.aborted || !mounted.current) return;
								status = await client.ingestionStatus({ meeting_id: meetingId }, controller.signal);
							}
						} catch (cause) {
							if (controller.signal.aborted || !mounted.current || generation.current !== request) return;
							setRunning(false);
							setFailure(ingestionFailure(errorCode$1(cause)));
							setDetail(cause instanceof Error ? cause.message : null);
							setOutcome("failed");
							return;
						}
						if (controller.signal.aborted || !mounted.current || generation.current !== request) return;
						setRunning(false);
						if (status.state === "succeeded") {
							setOutcome("succeeded");
							onIngested?.(meetingId);
							return;
						}
						setFailure(status.state === "failed" ? ingestionFailure(status.error_code) : "timeout");
						setDetail(status.state === "failed" ? status.message : null);
						setOutcome("failed");
					})();
				}, [
					client,
					meetingId,
					mounted,
					onIngested
				])
			};
		}
		/**
		* Lists committed meetings and loads one committed transcript on demand. A
		* live recording clears the selection so the draft area always follows it.
		*/
		function useStoredMeetings(options) {
			const { active, client, mounted } = options;
			const [entries, setEntries] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [reloadToken, setReloadToken] = (0, react.useState)(0);
			const [selected, setSelected] = (0, react.useState)(null);
			const [transcript, setTranscript] = (0, react.useState)(null);
			const [transcriptLoading, setTranscriptLoading] = (0, react.useState)(false);
			const [transcriptError, setTranscriptError] = (0, react.useState)(null);
			const [selectionAttempt, setSelectionAttempt] = (0, react.useState)(0);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				setLoading(true);
				client.listMeetings(void 0, controller.signal).then((items) => {
					if (!mounted.current || controller.signal.aborted) return;
					setEntries(items);
					setError(null);
					setLoading(false);
				}).catch(() => {
					if (!mounted.current || controller.signal.aborted) return;
					setError("LOAD_FAILED");
					setLoading(false);
				});
				return () => controller.abort();
			}, [
				client,
				mounted,
				reloadToken
			]);
			const wasActive = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (active) {
					setSelected(null);
					wasActive.current = true;
					return;
				}
				if (wasActive.current) {
					wasActive.current = false;
					setReloadToken((token) => token + 1);
				}
			}, [active]);
			(0, react.useEffect)(() => {
				if (selected === null) {
					setTranscript(null);
					setTranscriptLoading(false);
					setTranscriptError(null);
					return;
				}
				const controller = new AbortController();
				setTranscript(null);
				setTranscriptError(null);
				setTranscriptLoading(true);
				client.meetingTranscript({ meeting_id: selected.meeting_id }, controller.signal).then((value) => {
					if (!mounted.current || controller.signal.aborted) return;
					setTranscript(value);
					setTranscriptLoading(false);
				}).catch(() => {
					if (!mounted.current || controller.signal.aborted) return;
					setTranscriptError("LOAD_FAILED");
					setTranscriptLoading(false);
				});
				return () => controller.abort();
			}, [
				client,
				mounted,
				selected,
				selectionAttempt
			]);
			const select = (0, react.useCallback)((entry) => {
				setSelected(entry);
				setSelectionAttempt((attempt) => attempt + 1);
			}, []);
			const clear = (0, react.useCallback)(() => setSelected(null), []);
			const reload = (0, react.useCallback)(() => setReloadToken((token) => token + 1), []);
			const [syncPending, setSyncPending] = (0, react.useState)(null);
			const [syncBusy, setSyncBusy] = (0, react.useState)(false);
			const [syncProblem, setSyncProblem] = (0, react.useState)(null);
			const [syncRemoved, setSyncRemoved] = (0, react.useState)(null);
			const syncController = (0, react.useRef)(null);
			(0, react.useEffect)(() => () => syncController.current?.abort(), []);
			const runSync = (0, react.useCallback)((apply) => {
				syncController.current?.abort();
				const controller = new AbortController();
				syncController.current = controller;
				setSyncBusy(true);
				setSyncProblem(null);
				if (apply) setSyncRemoved(null);
				client.syncMeetings({ apply }, controller.signal).then((result) => {
					if (!mounted.current || controller.signal.aborted) return;
					setSyncBusy(false);
					if (apply) {
						setSyncPending(null);
						setSyncRemoved(result.removed);
						setSelected(null);
						setReloadToken((token) => token + 1);
						return;
					}
					setSyncPending(result.removed);
				}).catch((cause) => {
					if (!mounted.current || controller.signal.aborted) return;
					setSyncBusy(false);
					setSyncPending(null);
					setSyncProblem(syncFailure(errorCode$1(cause)));
				});
			}, [client, mounted]);
			return {
				entries,
				loading,
				error,
				selected,
				transcript,
				transcriptLoading,
				transcriptError,
				disabled: active,
				select,
				clear,
				reload,
				sync: {
					pending: syncPending,
					busy: syncBusy,
					failure: syncProblem,
					removed: syncRemoved,
					request: (0, react.useCallback)(() => runSync(false), [runSync]),
					confirm: (0, react.useCallback)(() => runSync(true), [runSync]),
					cancel: (0, react.useCallback)(() => {
						syncController.current?.abort();
						setSyncBusy(false);
						setSyncPending(null);
					}, [])
				}
			};
		}
		//#endregion
		//#region src/client/RecordingPanel.tsx
		function recordOrEmpty(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
		}
		const POLL_MS = 2e3;
		const SPEAKER_SAVE_DELAY_MS = 400;
		function trackError(view) {
			if (view?.mic.errorCode !== null && view?.mic.errorCode !== void 0) return view.mic.errorCode;
			if (view?.system.errorCode !== null && view?.system.errorCode !== void 0) return view.system.errorCode;
			return view?.errorCode ?? null;
		}
		function useRecordingSnapshot(client, references) {
			const mounted = (0, react.useRef)(true);
			const [view, setView] = (0, react.useState)(null);
			const [hasRecordingHistory, setHasRecordingHistory] = (0, react.useState)(false);
			const [preview, setPreview] = (0, react.useState)([]);
			const [error, setError] = (0, react.useState)(null);
			const [readError, setReadError] = (0, react.useState)(null);
			const latestRefresh = (0, react.useRef)(0);
			const refresh = (0, react.useCallback)(async (signal) => {
				const request = ++latestRefresh.current;
				const state = await client.state(signal);
				if (!mounted.current || request !== latestRefresh.current) return;
				setReadError(null);
				setView(state.recording);
				setPreview(state.preview);
				setHasRecordingHistory(state.hasRecordingHistory);
				references.observeRecording(state.recording);
			}, [client, references]);
			(0, react.useEffect)(() => {
				mounted.current = true;
				const controller = new AbortController();
				const tick = () => void refresh(controller.signal).catch((cause) => {
					if (mounted.current && !controller.signal.aborted) setReadError(cause instanceof Error ? cause.message : "ENGINE_FAILURE");
				});
				tick();
				const timer = setInterval(tick, POLL_MS);
				return () => {
					mounted.current = false;
					controller.abort();
					clearInterval(timer);
				};
			}, [refresh]);
			return {
				error: error ?? readError,
				hasRecordingHistory,
				mounted,
				preview,
				refresh,
				setError,
				setView,
				view
			};
		}
		function useRecordingControl(options) {
			const generation = (0, react.useRef)(0);
			return (0, react.useCallback)(async (payload) => {
				const request = ++generation.current;
				let settled = false;
				const { client, currentSessionId, mounted, references, refresh } = options;
				const startSessionId = payload.action === "start" ? currentSessionId() : void 0;
				options.setPending(payload.action);
				options.setError(null);
				try {
					const next = await client.control(payload);
					if (!mounted.current) return;
					options.setView(next);
					options.setPending(null);
					settled = true;
					if (payload.action === "start") await references.recordingStarted(next, startSessionId);
					else references.observeRecording(next);
					await refresh();
				} catch (cause) {
					if (mounted.current && generation.current === request) options.setError(cause instanceof Error ? cause.message : "ENGINE_FAILURE");
				} finally {
					if (mounted.current && !settled && generation.current === request) options.setPending(null);
				}
			}, [options]);
		}
		function useJoinReference(options) {
			return (0, react.useCallback)(async () => {
				options.setPending("join");
				options.setError(null);
				try {
					await options.references.join(options.view);
				} catch (cause) {
					if (options.mounted.current) {
						const code = cause instanceof Error ? cause.message : "ENGINE_FAILURE";
						options.setError(code === "NO_SESSION_AVAILABLE" ? options.translate("panel.noSession") : code);
					}
				} finally {
					if (options.mounted.current) options.setPending(null);
				}
			}, [options]);
		}
		function errorCode(cause) {
			return cause instanceof Error ? cause.message : "ENGINE_FAILURE";
		}
		function sameSpeakerNames(left, right) {
			const keys = Object.keys(left);
			return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
		}
		/** Distinct speaker labels of the visible draft, in first-appearance order. */
		function speakerLabels(preview) {
			const seen = /* @__PURE__ */ new Set();
			const labels = [];
			for (const segment of preview) {
				const label = segment.speakerLabel;
				if (label === null || label === "" || seen.has(label)) continue;
				seen.add(label);
				labels.push(label);
			}
			return labels;
		}
		/**
		* A stored name wins over the local text unless the local text is an unsaved
		* edit, so a reload triggered by new segments cannot discard typing.
		*/
		function mergeStoredSpeakerNames(stored, local, saved, labels) {
			const merged = {};
			for (const label of labels) {
				const current = local[label] ?? "";
				const value = current !== "" && normalizeSpeakerName(current) !== (saved[label] ?? "") ? current : stored[label] ?? "";
				if (value !== "") merged[label] = value;
			}
			return merged;
		}
		/**
		* Keeps the names typed for the current draft in sync with the stored
		* attribution: loads on a new meeting or new labels and saves edits after a
		* short pause, so typing does not produce one request per keystroke.
		*/
		function useSpeakerAttribution(options) {
			const { client, labels, meetingId, mounted } = options;
			const labelsKey = labels.join("\0");
			const loadKey = meetingId === null ? null : `${meetingId}\u0000${labelsKey}`;
			const [names, setNames] = (0, react.useState)({});
			const [saving, setSaving] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(null);
			const [readyKey, setReadyKey] = (0, react.useState)(null);
			const lastSaved = (0, react.useRef)({});
			const lastMeetingId = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (meetingId === null || loadKey === null) {
					lastMeetingId.current = null;
					lastSaved.current = {};
					setNames({});
					setSaving(false);
					setFailure(null);
					setReadyKey(null);
					return;
				}
				const controller = new AbortController();
				if (lastMeetingId.current !== meetingId) {
					lastMeetingId.current = meetingId;
					lastSaved.current = {};
					setNames({});
				}
				setReadyKey(null);
				client.speakerNames({ meeting_id: meetingId }, controller.signal).then((result) => {
					if (!mounted.current || controller.signal.aborted) return;
					const previous = lastSaved.current;
					lastSaved.current = assignedSpeakerNames(labels, result.speaker_names);
					setNames((current) => mergeStoredSpeakerNames(result.speaker_names, current, previous, labels));
					setFailure(null);
					setReadyKey(loadKey);
				}).catch((cause) => {
					if (!mounted.current || controller.signal.aborted) return;
					setFailure({
						action: "load",
						code: errorCode(cause)
					});
					setReadyKey(loadKey);
				});
				return () => controller.abort();
			}, [
				client,
				labelsKey,
				loadKey,
				meetingId,
				mounted
			]);
			const assigned = (0, react.useMemo)(() => assignedSpeakerNames(labels, names), [labelsKey, names]);
			(0, react.useEffect)(() => {
				if (meetingId === null || loadKey === null || readyKey !== loadKey) return void 0;
				if (sameSpeakerNames(assigned, lastSaved.current)) return void 0;
				const controller = new AbortController();
				setFailure((current) => current?.action === "save" ? null : current);
				const timer = setTimeout(() => {
					if (!mounted.current || controller.signal.aborted) return;
					setSaving(true);
					client.saveSpeakerNames({
						meeting_id: meetingId,
						speaker_names: assigned
					}, controller.signal).then((result) => {
						if (!mounted.current || controller.signal.aborted) return;
						lastSaved.current = assignedSpeakerNames(labels, result.speaker_names);
						setSaving(false);
						setFailure(null);
					}).catch((cause) => {
						if (!mounted.current || controller.signal.aborted) return;
						setSaving(false);
						setFailure({
							action: "save",
							code: errorCode(cause)
						});
					});
				}, SPEAKER_SAVE_DELAY_MS);
				return () => {
					clearTimeout(timer);
					controller.abort();
					if (mounted.current) setSaving(false);
				};
			}, [
				assigned,
				client,
				loadKey,
				meetingId,
				mounted,
				readyKey
			]);
			const pendingSave = (0, react.useRef)(null);
			pendingSave.current = meetingId === null || readyKey !== loadKey ? null : {
				meetingId,
				names: assigned
			};
			(0, react.useEffect)(() => () => {
				const pending = pendingSave.current;
				if (pending === null || sameSpeakerNames(pending.names, lastSaved.current)) return;
				client.saveSpeakerNames({
					meeting_id: pending.meetingId,
					speaker_names: pending.names
				}).catch(() => void 0);
			}, [client]);
			return {
				labels,
				names,
				saving,
				failure,
				update: (0, react.useCallback)((label, name) => {
					setNames((current) => {
						const next = { ...current };
						if (name === "") delete next[label];
						else next[label] = name;
						return next;
					});
				}, [])
			};
		}
		/**
		* Exports the committed Markdown transcript. The configured folder is used by
		* default; modifier-click asks for a folder and remembers it, so the first
		* export also configures the plugin setting. Renamed speakers are sent along,
		* and an untouched map leaves the payload exactly as before.
		*/
		function useTranscriptExport(options) {
			return (0, react.useCallback)(async (choose) => {
				const view = options.view;
				if (view === null) return;
				const speakerNames = assignedSpeakerNames(options.labels, options.speakerNames);
				options.setPending("export");
				options.setError(null);
				options.setNotice(null);
				try {
					const result = await options.client.exportTranscript({
						destination: choose ? "choose" : "default",
						format: "md",
						include_speakers: true,
						include_timestamps: true,
						meeting_id: view.meetingId,
						...Object.keys(speakerNames).length === 0 ? {} : { speaker_names: speakerNames }
					});
					if (!options.mounted.current) return;
					options.setNotice(options.translate("panel.exportSaved", { path: result.output_path }));
				} catch (cause) {
					if (!options.mounted.current) return;
					const code = cause instanceof Error ? cause.message : "ENGINE_FAILURE";
					options.setError(code);
				} finally {
					if (options.mounted.current) options.setPending(null);
				}
			}, [options]);
		}
		function RecordingPanel(props) {
			const { currentSessionId, locale, references, rpc, settings, translate } = props;
			(0, react.useSyncExternalStore)((listener) => locale.subscribe(listener), () => locale.getSnapshot());
			const client = (0, react.useMemo)(() => new RecordingRpcClient(rpc), [rpc]);
			const snapshot = useRecordingSnapshot(client, references);
			const prepare = (0, react.useCallback)((signal) => client.prepareModels(signal), [client]);
			const [pendingAction, setPending] = (0, react.useState)(null);
			const [exportNotice, setExportNotice] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (pendingAction !== "stop") return;
				const controller = new AbortController();
				const timer = setInterval(() => void snapshot.refresh(controller.signal).catch(() => void 0), 200);
				return () => {
					controller.abort();
					clearInterval(timer);
				};
			}, [pendingAction, snapshot.refresh]);
			const run = useRecordingControl({
				client,
				currentSessionId,
				mounted: snapshot.mounted,
				references,
				refresh: snapshot.refresh,
				setError: snapshot.setError,
				setPending,
				setView: snapshot.setView
			});
			const join = useJoinReference({
				mounted: snapshot.mounted,
				references,
				setError: snapshot.setError,
				setPending,
				translate,
				view: snapshot.view?.recordingStartedAtMs === null ? null : snapshot.view
			});
			const settingsSnapshot = (0, react.useSyncExternalStore)((0, react.useCallback)((listener) => settings?.subscribe(listener) ?? (() => void 0), [settings]), (0, react.useCallback)(() => settings?.getSnapshot() ?? null, [settings]));
			const [devices, setDevices] = (0, react.useState)(null);
			const refreshDevices = (0, react.useCallback)(async () => {
				try {
					setDevices(await client.listDevices());
				} catch {
					setDevices(null);
				}
			}, [client]);
			(0, react.useEffect)(() => {
				refreshDevices();
			}, [refreshDevices]);
			const selectDevice = (0, react.useCallback)(async (track, uid) => {
				const current = settings?.getSnapshot();
				if (settings === void 0 || current === null || current === void 0) return;
				await settings.mutate([{
					op: "set",
					path: [track === "mic" ? "mic_device_uid" : "system_device_uid"],
					value: uid
				}], current.revision);
			}, [settings]);
			const configValues = recordOrEmpty(settingsSnapshot?.value);
			const selectedDevices = (0, react.useMemo)(() => ({
				mic: typeof configValues.mic_device_uid === "string" ? configValues.mic_device_uid : "",
				system: typeof configValues.system_device_uid === "string" ? configValues.system_device_uid : ""
			}), [configValues]);
			const storedMeetings = useStoredMeetings({
				active: isRecordingActive(snapshot.view),
				client,
				mounted: snapshot.mounted
			});
			const committed = snapshot.view?.transcriptVersion === null || snapshot.view?.transcriptVersion === void 0 ? null : snapshot.view.meetingId;
			const ingestion = useMeetingIngestion({
				client,
				meetingId: storedMeetings.selected?.meeting_id ?? committed,
				mounted: snapshot.mounted,
				onIngested: storedMeetings.reload
			});
			const preview = storedMeetings.selected === null ? snapshot.preview : storedMeetings.transcript?.segments ?? [];
			const stored = storedMeetings.selected === null ? null : {
				failed: storedMeetings.transcriptError !== null,
				version: storedMeetings.transcript?.transcript_version ?? null
			};
			const labels = (0, react.useMemo)(() => speakerLabels(preview), [preview]);
			const attribution = useSpeakerAttribution({
				client,
				labels,
				mounted: snapshot.mounted,
				meetingId: storedMeetings.selected?.meeting_id ?? snapshot.view?.meetingId ?? null
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingPanelView, {
				devices,
				exportNotice,
				exportTranscript: useTranscriptExport({
					client,
					labels,
					mounted: snapshot.mounted,
					setError: snapshot.setError,
					setNotice: setExportNotice,
					setPending,
					settings,
					translate,
					view: snapshot.view,
					speakerNames: storedMeetings.selected === null ? attribution.names : {}
				}),
				refreshDevices,
				selectDevice,
				selectedDevices,
				failure: snapshot.error ?? trackError(snapshot.view),
				join,
				pending: pendingAction !== null,
				pendingAction,
				attribution,
				hasRecordingHistory: snapshot.hasRecordingHistory,
				prepare,
				preview,
				run,
				settings,
				settingsRevision: settingsSnapshot?.revision,
				translate,
				view: snapshot.view,
				ingestion,
				stored,
				storedMeetings
			});
		}
		//#endregion
		//#region src/client/meeting-reference-auto-state.ts
		function begin(event) {
			const mode = event.mode ?? "auto";
			return {
				effect: mode === "auto" && !event.present ? "insert" : "none",
				state: {
					initialized: true,
					inputPhase: event.inputPhase,
					meetingId: event.meetingId,
					mode,
					present: event.present
				}
			};
		}
		function observe(state, event) {
			const next = {
				...state,
				inputPhase: event.inputPhase,
				present: event.present
			};
			if (state.mode === "suppressed" || event.selfMutation || !state.present || event.present) return {
				effect: "none",
				state: next
			};
			if (state.inputPhase === "submitting" && event.inputPhase === "plain") return {
				effect: "insert",
				state: next
			};
			return {
				effect: "none",
				state: {
					...next,
					mode: "suppressed"
				}
			};
		}
		function reduceAutoReference(state, event) {
			if (event.type === "restore" || event.type === "activate") return begin(event);
			if (event.type === "retire") return event.meetingId === state?.meetingId ? {
				effect: "none",
				state: null
			} : {
				effect: "none",
				state
			};
			if (event.type === "join") {
				const next = state?.meetingId === event.meetingId ? {
					...state,
					mode: "auto"
				} : {
					initialized: true,
					inputPhase: "plain",
					meetingId: event.meetingId,
					mode: "auto",
					present: false
				};
				return {
					effect: next.present ? "none" : "insert",
					state: next
				};
			}
			if (event.type === "observe") return state === null ? {
				effect: "none",
				state
			} : observe(state, event);
			return {
				effect: "none",
				state
			};
		}
		//#endregion
		//#region src/client/meeting-reference-coordinator.ts
		const STORAGE_PREFIX = "dsh-asr:meeting-reference:";
		const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
		function normalizeInputPhase(phase) {
			return phase === "sending" ? "submitting" : phase;
		}
		var MemorySessionStorage = class {
			values = /* @__PURE__ */ new Map();
			get length() {
				return this.values.size;
			}
			clear() {
				this.values.clear();
			}
			getItem(key) {
				return this.values.get(key) ?? null;
			}
			key(index) {
				return [...this.values.keys()][index] ?? null;
			}
			removeItem(key) {
				this.values.delete(key);
			}
			setItem(key, value) {
				this.values.set(key, value);
			}
		};
		function defaultStorage() {
			try {
				return globalThis.sessionStorage ?? new MemorySessionStorage();
			} catch {
				return new MemorySessionStorage();
			}
		}
		function active(view) {
			return view !== null && [
				"starting",
				"recording",
				"finalizing"
			].includes(view.phase);
		}
		function keyFor(sessionId) {
			return `${STORAGE_PREFIX}${sessionId}`;
		}
		function parsePersisted(value) {
			if (value === null) return null;
			try {
				const parsed = JSON.parse(value);
				if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed) || Object.keys(parsed).length !== 2 || typeof parsed.meeting_id !== "string" || !UUID_PATTERN.test(parsed.meeting_id) || parsed.mode !== "auto" && parsed.mode !== "suppressed") return null;
				return {
					meetingId: parsed.meeting_id,
					mode: parsed.mode
				};
			} catch {
				return null;
			}
		}
		function hasReference(input, meetingId) {
			return input.state.getSnapshot().occurrences.some((occurrence) => {
				if (occurrence.source !== "meeting-reference") return false;
				try {
					return parseMeetingReference(occurrence.ref).meetingId === meetingId;
				} catch {
					return false;
				}
			});
		}
		var MeetingReferenceCoordinator = class {
			lifetime = new AbortController();
			currentRecording = null;
			insertions = /* @__PURE__ */ new Map();
			storage;
			trackers = /* @__PURE__ */ new Map();
			unsubscribeSessions;
			constructor(options) {
				this.options = options;
				this.storage = options.storage ?? defaultStorage();
				this.unsubscribeSessions = options.ctx.sessions.list.subscribe(() => this.reconcileSessions());
				this.reconcileSessions();
			}
			async recordingStarted(view, sessionId) {
				this.observeRecording(view);
				if (!active(view) || sessionId === void 0 || !this.sessionExists(sessionId)) return;
				await this.activateSession(sessionId, view.meetingId);
			}
			observeRecording(view) {
				if (!active(view)) {
					this.currentRecording = null;
					this.retireOtherMeetings();
					return;
				}
				this.retireOtherMeetings(view.meetingId);
				this.currentRecording = view;
				this.restoreMeeting(view.meetingId);
			}
			async join(view) {
				this.observeRecording(view);
				const sessionId = await this.addressSession();
				if (view === null) {
					const scope = this.options.ctx.sessions.scope(sessionId);
					const input = this.inputFor(sessionId);
					if (scope === void 0 || input === null) throw new Error("NO_SESSION_AVAILABLE");
					const { draft, draftRev } = input.state.getSnapshot();
					input.focus();
					this.options.ctx.inputTriggers.sessionOf(scope).toggleSource("meeting-reference", {
						trigger: "@",
						query: "",
						quoted: false,
						position: "inline",
						span: {
							start: draft.length,
							end: draft.length,
							draftRev
						}
					});
					return;
				}
				if (active(view)) await this.activateSession(sessionId, view.meetingId);
				else await this.insertOnce(sessionId, view.meetingId);
			}
			dispose() {
				this.lifetime.abort();
				this.unsubscribeSessions();
				for (const tracker of this.trackers.values()) tracker.unsubscribe();
				this.trackers.clear();
			}
			async addressSession() {
				const current = currentSessionId(this.options.ctx);
				if (current !== void 0) {
					this.options.ctx.uiWorkspace.openSession(current);
					return current;
				}
				this.options.ctx.uiWorkspace.startSession();
				return this.waitForSession();
			}
			waitForSession() {
				const list = this.options.ctx.sessions.list;
				const signal = AbortSignal.any([this.lifetime.signal, AbortSignal.timeout(1e4)]);
				return new Promise((resolve, reject) => {
					let unsubscribe = () => {};
					const cleanup = () => {
						unsubscribe();
						signal.removeEventListener("abort", abort);
					};
					const abort = () => {
						cleanup();
						reject(/* @__PURE__ */ new Error("NO_SESSION_AVAILABLE"));
					};
					const changed = () => {
						const current = currentSessionId(this.options.ctx);
						if (current !== void 0) {
							cleanup();
							resolve(current);
						}
					};
					unsubscribe = list.subscribe(changed);
					signal.addEventListener("abort", abort, { once: true });
					if (signal.aborted) abort();
					else changed();
				});
			}
			async activateSession(sessionId, meetingId) {
				const tracker = this.trackers.get(sessionId) ?? this.attach(sessionId, {
					meetingId,
					mode: "auto"
				});
				if (tracker === null) return;
				const reduction = reduceAutoReference(tracker.state, {
					type: "join",
					meetingId
				});
				this.adopt(sessionId, reduction);
				if (reduction.effect === "insert") await this.ensureReference(sessionId);
			}
			attach(sessionId, persisted) {
				const input = this.inputFor(sessionId);
				if (input === null) return null;
				const reduction = reduceAutoReference(null, {
					type: "restore",
					inputPhase: normalizeInputPhase(input.state.getSnapshot().phase),
					meetingId: persisted.meetingId,
					mode: persisted.mode,
					present: hasReference(input, persisted.meetingId)
				});
				if (reduction.state === null) return null;
				const tracker = {
					input,
					selfMutation: false,
					state: reduction.state,
					unsubscribe: input.state.subscribe(() => this.observeInput(sessionId))
				};
				this.trackers.set(sessionId, tracker);
				this.writeState(sessionId, tracker.state);
				if (reduction.effect === "insert") this.ensureReference(sessionId);
				return tracker;
			}
			observeInput(sessionId) {
				const tracker = this.trackers.get(sessionId);
				if (tracker === void 0) return;
				const snapshot = tracker.input.state.getSnapshot();
				const reduction = reduceAutoReference(tracker.state, {
					type: "observe",
					inputPhase: normalizeInputPhase(snapshot.phase),
					present: hasReference(tracker.input, tracker.state.meetingId),
					selfMutation: tracker.selfMutation
				});
				this.adopt(sessionId, reduction);
				if (reduction.effect === "insert") this.ensureReference(sessionId);
			}
			adopt(sessionId, reduction) {
				const tracker = this.trackers.get(sessionId);
				if (tracker === void 0) return;
				if (reduction.state === null) {
					this.removeSession(sessionId);
					return;
				}
				tracker.state = reduction.state;
				this.writeState(sessionId, reduction.state);
			}
			ensureReference(sessionId) {
				const pending = this.insertions.get(sessionId);
				if (pending !== void 0) return pending;
				const operation = this.doEnsureReference(sessionId).finally(() => {
					if (this.insertions.get(sessionId) === operation) this.insertions.delete(sessionId);
				});
				this.insertions.set(sessionId, operation);
				return operation;
			}
			async doEnsureReference(sessionId) {
				const tracker = this.trackers.get(sessionId);
				const recording = this.currentRecording;
				if (tracker === void 0 || tracker.state.mode !== "auto" || !active(recording) || recording.meetingId !== tracker.state.meetingId) return;
				const identity = await this.resolveIdentity(recording.meetingId);
				const current = this.trackers.get(sessionId);
				if (current !== tracker || current.state.mode !== "auto" || hasReference(current.input, identity.meetingId)) return;
				current.selfMutation = true;
				try {
					this.insert(current.input, identity);
				} finally {
					current.selfMutation = false;
				}
			}
			async insertOnce(sessionId, meetingId) {
				const input = this.inputFor(sessionId);
				if (input === null || hasReference(input, meetingId)) return;
				this.insert(input, await this.resolveIdentity(meetingId));
			}
			insert(input, identity) {
				const snapshot = input.state.getSnapshot();
				const mention = formatMeetingReference(identity);
				input.insertReference({
					source: "meeting-reference",
					ref: mention,
					label: identity.label,
					clipboardText: mention
				}, {
					start: snapshot.draft.length,
					end: snapshot.draft.length,
					draftRev: snapshot.draftRev
				});
			}
			async resolveIdentity(meetingId) {
				try {
					const candidate = await this.options.client.resolveMeetingReference({
						locale: this.options.ctx.locale.getLocale().active,
						meeting_id: meetingId
					});
					const identity = {
						meetingId: candidate.meeting_id,
						label: candidate.label
					};
					formatMeetingReference(identity);
					if (identity.meetingId === meetingId) return identity;
				} catch {}
				return {
					meetingId,
					label: this.options.translate("auto.current")
				};
			}
			restoreMeeting(meetingId) {
				for (const [sessionId, persisted] of this.persistedEntries()) if (persisted.meetingId === meetingId && this.sessionExists(sessionId) && !this.trackers.has(sessionId)) this.attach(sessionId, persisted);
			}
			retireOtherMeetings(keepMeetingId) {
				for (const [sessionId, persisted] of this.persistedEntries()) if (persisted.meetingId !== keepMeetingId) this.removeSession(sessionId);
			}
			reconcileSessions() {
				const list = this.options.ctx.sessions.list.getSnapshot();
				if (list.phase !== "ready") return;
				for (const [sessionId] of this.persistedEntries()) if (list.byId[sessionId] === void 0) this.removeSession(sessionId);
			}
			persistedEntries() {
				const entries = [];
				const keys = Array.from({ length: this.storage.length }, (_, index) => this.storage.key(index));
				for (const key of keys) {
					if (key === null || !key.startsWith(STORAGE_PREFIX)) continue;
					const sessionId = key.slice(26);
					const persisted = parsePersisted(this.storage.getItem(key));
					if (sessionId === "" || persisted === null) this.storage.removeItem(key);
					else entries.push([sessionId, persisted]);
				}
				return entries;
			}
			inputFor(sessionId) {
				const scope = this.options.ctx.sessions.scope(sessionId);
				return scope === void 0 ? null : this.options.ctx.conversation.input.for(scope);
			}
			sessionExists(sessionId) {
				return this.options.ctx.sessions.list.getSnapshot().byId[sessionId] !== void 0;
			}
			writeState(sessionId, state) {
				this.storage.setItem(keyFor(sessionId), JSON.stringify({
					meeting_id: state.meetingId,
					mode: state.mode
				}));
			}
			removeSession(sessionId) {
				this.trackers.get(sessionId)?.unsubscribe();
				this.trackers.delete(sessionId);
				this.storage.removeItem(keyFor(sessionId));
			}
		};
		//#endregion
		//#region src/client/meeting-reference-locales.ts
		const MEETING_REFERENCE_LOCALE_NAMESPACE = "dsh-asr.meeting-reference";
		const zh = {
			"auto.current": "当前录制会议",
			"section.meetings": "会议",
			"phase.starting": "正在启动",
			"phase.recording": "录音中",
			"phase.finalizing": "正在整理转写",
			"phase.processing": "处理中",
			"phase.completed": "已完成",
			"phase.empty": "无语音",
			"phase.partial": "部分完成",
			"phase.failed": "失败",
			"phase.cancelled": "已取消",
			"time.elapsed": "已录 {value}",
			"time.duration": "时长 {value}",
			"panel.stopping": "正在停止录音",
			"panel.aria": "录音助手",
			"panel.title": "录音助手",
			"panel.phase.none": "未录音",
			"panel.start": "开始录音",
			"panel.stop": "停止录音",
			"panel.startNew": "开始新录音",
			"panel.readyHint": "开始录音后，这里会显示本次录音的完整草稿。",
			"panel.mic": "麦克风",
			"panel.system": "系统音频",
			"panel.micOn": "麦克风 开",
			"panel.micOff": "麦克风 关",
			"panel.systemOn": "系统音频 开",
			"panel.systemOff": "系统音频 关",
			"panel.join": "@加入",
			"panel.draftWaiting": "等待首段草稿",
			"panel.draftFresh": "草稿更新于 {seconds} 秒前",
			"panel.draftStale": "草稿暂时落后，录音仍在继续",
			"panel.finalization": "停止后 {seconds} 秒完成提交",
			"panel.previewAria": "录音草稿",
			"panel.previewSpeaker": "草稿",
			"panel.expand": "展开录音助手",
			"panel.collapse": "收起录音助手",
			"panel.move": "移动录音助手",
			"panel.resize": "调整草稿面积",
			"panel.reset": "恢复窗口内位置",
			"panel.recognizer": "识别语言",
			"panel.recognizerHint": "下一次录音使用的识别引擎。中文用 Paraformer，英语等欧洲语言用 Parakeet。",
			"panel.recognizerParaformer": "中文",
			"panel.micDevice": "选择麦克风设备",
			"panel.systemDevice": "选择录音输出设备",
			"panel.deviceDefault": "跟随系统默认",
			"panel.devicesUnavailable": "未能读取可用设备",
			"panel.recognizerParakeet": "英语 / 欧洲",
			"panel.previewHint": "本次录音草稿 · 正式原稿请通过 @ 引用会议",
			"panel.ingest": "收录",
			"panel.ingesting": "正在收录",
			"panel.ingested": "已加入开放知识库。",
			"panel.ingestFailed": "未能加入开放知识库，请稍后重试。",
			"panel.ingestNotConfigured": "请先在插件设置中选择知识库文件夹。",
			"panel.ingestBusy": "已有收录任务正在运行，请稍后重试。",
			"panel.ingestTimeout": "收录用时过长，请稍后在插件设置中查看。",
			"panel.storedMeetings": "已保存的会议",
			"panel.storedHint": "选择一场会议查看已提交的原稿；原稿为只读。",
			"panel.storedEmpty": "还没有已保存的会议。",
			"panel.storedLoading": "正在读取原稿…",
			"panel.storedLoadFailed": "未能读取这场会议的原稿。",
			"panel.storedUntitled": "未命名会议",
			"panel.storedIngested": "已收录",
			"panel.storedTitle": "已保存的原稿",
			"panel.storedVersion": "第 {version} 版 · 只读",
			"panel.sync": "同步",
			"panel.syncConfirm": "移除 {count} 个不在该文件夹中的会议？",
			"panel.syncNothing": "所有已存会议都在该文件夹中。",
			"panel.syncRemove": "移除",
			"panel.syncCancel": "取消",
			"panel.syncDone": "已移除 {count} 个会议。",
			"panel.syncFailed": "无法同步该文件夹。",
			"panel.syncNotConfigured": "请先在设置中选择知识库文件夹。",
			"panel.syncMissingFolder": "知识库文件夹不存在。",
			"panel.ingestNoModel": "请先在 DSH 设置中选择模型。",
			"panel.ingestNoTranscript": "该会议还没有已提交的转写。",
			"panel.storedEmptyTranscript": "这场会议还没有可显示的原稿。",
			"panel.activity": "录音状态指示（不是声音音量）",
			"panel.track.on": "采集中",
			"panel.track.off": "已关闭",
			"panel.track.failed": "采集失败",
			"panel.track.noSignal": "尚未收到声音",
			"panel.waitingForSound": "等待声音",
			"panel.systemNoSignal": "系统音频无声：先播放声音。仍无声时，在系统设置 → 隐私与安全性 → 录屏与系统录音（或仅系统录音）中开启 DSHASRRecordingHelper，再关闭并重新开启系统音频。",
			"panel.micDenied": "麦克风未授权。请在插件设置中检查录音权限，或到系统设置允许 DSHASRRecordingHelper 后重试。",
			"panel.systemDenied": "系统录音未授权。请在系统设置中允许 DSHASRRecordingHelper 后重试。",
			"panel.error.systemCheck": "系统音频检测未通过。请在插件设置中检查录音权限和声音输出，再重试。",
			"panel.error.unsupported": "系统音频录制需要 macOS 14.2 或更高版本。",
			"panel.error.models": "模型尚未准备好。请到插件设置下载或修复模型。",
			"panel.error.component": "录音组件不完整或不兼容。请重新安装适用于本机的插件。",
			"panel.error.worker": "转写组件运行异常。请重试；若再次失败，请更新插件。",
			"panel.error.helper": "录音组件未正常响应。请停止后重试。",
			"panel.error.permissionCheck": "无法完成录音权限检查。请检查系统设置后重试。",
			"panel.error.storage": "无法读取或保存录音。请检查磁盘空间和数据目录权限。",
			"panel.error.busy": "已有任务正在运行，或另一实例正在使用录音数据。请结束后重试。",
			"panel.error.resources": "可用内存不足。请关闭占用内存的应用后重试。",
			"panel.error.cancelled": "已取消。",
			"panel.error.state": "录音状态已变化。请刷新页面后重试。",
			"panel.error.generic": "操作未完成。请重试；若再次失败，请查看技术详情。",
			"panel.error.details": "技术详情",
			"panel.export": "导出转写",
			"panel.exportHint": "导出 Markdown 到默认文件夹；按住 ⌥ 选择保存位置。",
			"panel.exporting": "正在导出转写",
			"panel.exportSaved": "已保存到 {path}",
			"panel.error.export": "无法导出转写。请检查保存位置、文件夹权限后重试。",
			"panel.error.exportDirectory": "尚未设置转写保存位置。请在插件设置中选择文件夹，或按住 ⌥ 导出以选择位置。",
			"panel.noSession": "请先创建或选择一个工作区",
			"panel.attribution": "说话人名称",
			"panel.attributionHint": "这些名称只写入导出文件，已保存的转写仍保留原来的说话人标签。",
			"panel.attributionDuplicate": "同一个名称分配给了多位说话人：{names}。请为每位说话人使用不同的名称。",
			"panel.attributionSaving": "正在保存名称…",
			"panel.attributionSaveFailed": "说话人名称未能保存。请检查名称后重试；导出仍会使用当前输入的名称。",
			"panel.attributionLoadFailed": "未能读取已保存的说话人名称。",
			"panel.error.exportSpeaker": "转写已保存，但说话人名称没有写入。请检查名称后重新导出。",
			"panel.error.exportSpeakerDuplicate": "有两位说话人使用了同一个名称，转写未导出。请改用不同的名称后重试。"
		};
		const en = {
			"auto.current": "Current recording",
			"section.meetings": "Meetings",
			"phase.starting": "Starting",
			"phase.recording": "Recording",
			"phase.finalizing": "Preparing transcript",
			"panel.stopping": "Stopping recording",
			"phase.processing": "Processing",
			"phase.completed": "Completed",
			"phase.empty": "No speech",
			"phase.partial": "Partially completed",
			"phase.failed": "Failed",
			"phase.cancelled": "Cancelled",
			"time.elapsed": "{value} elapsed",
			"time.duration": "Duration {value}",
			"panel.aria": "Recording assistant",
			"panel.title": "Recording assistant",
			"panel.phase.none": "Not recording",
			"panel.start": "Start recording",
			"panel.stop": "Stop recording",
			"panel.startNew": "Start a new recording",
			"panel.readyHint": "Start recording to see the complete draft for this recording.",
			"panel.mic": "Microphone",
			"panel.system": "System audio",
			"panel.micOn": "Microphone on",
			"panel.micOff": "Microphone off",
			"panel.systemOn": "System audio on",
			"panel.systemOff": "System audio off",
			"panel.join": "@ Add",
			"panel.draftWaiting": "Waiting for the first draft segment",
			"panel.draftFresh": "Draft updated {seconds}s ago",
			"panel.draftStale": "The draft is behind; recording is still running",
			"panel.finalization": "Committed {seconds}s after stop",
			"panel.previewAria": "Recording draft",
			"panel.previewSpeaker": "Draft",
			"panel.expand": "Expand recording assistant",
			"panel.collapse": "Collapse recording assistant",
			"panel.move": "Move recording assistant",
			"panel.resize": "Resize draft area",
			"panel.reset": "Reset position within window",
			"panel.recognizer": "Recognizer",
			"panel.recognizerHint": "Engine for the next recording. Paraformer covers Chinese; Parakeet covers English and 24 other European languages.",
			"panel.recognizerParaformer": "Chinese",
			"panel.micDevice": "Microphone device",
			"panel.systemDevice": "System audio device",
			"panel.deviceDefault": "Follow system default",
			"panel.devicesUnavailable": "Devices are unavailable",
			"panel.recognizerParakeet": "English / European",
			"panel.previewHint": "Current recording draft · use @ for the committed transcript",
			"panel.ingest": "Ingest",
			"panel.ingesting": "Ingesting",
			"panel.ingested": "Added to the knowledge base.",
			"panel.ingestFailed": "The meeting could not be added to the knowledge base. Retry later.",
			"panel.ingestNotConfigured": "Choose a knowledge base folder in plugin settings first.",
			"panel.ingestBusy": "Another ingestion is already running. Retry when it finishes.",
			"panel.ingestTimeout": "Ingestion is taking too long. Check the plugin settings later.",
			"panel.storedMeetings": "Saved meetings",
			"panel.storedHint": "Select a meeting to preview its committed transcript. The preview is read-only.",
			"panel.storedEmpty": "No saved meetings yet.",
			"panel.storedLoading": "Loading transcript…",
			"panel.storedLoadFailed": "That meeting's transcript could not be loaded.",
			"panel.storedUntitled": "Untitled meeting",
			"panel.storedIngested": "Ingested",
			"panel.storedTitle": "Stored transcript",
			"panel.storedVersion": "v{version} · read-only",
			"panel.sync": "Sync",
			"panel.syncConfirm": "Remove {count} meetings that are not in this folder?",
			"panel.syncNothing": "Every stored meeting is in this folder.",
			"panel.syncRemove": "Remove",
			"panel.syncCancel": "Cancel",
			"panel.syncDone": "Removed {count} meetings.",
			"panel.syncFailed": "Could not sync the folder.",
			"panel.syncNotConfigured": "Choose an Open knowledge base folder in settings first.",
			"panel.syncMissingFolder": "The Open knowledge base folder does not exist.",
			"panel.ingestNoModel": "Choose a model in DSH settings first.",
			"panel.ingestNoTranscript": "This meeting has no committed transcript yet.",
			"panel.storedEmptyTranscript": "This meeting has no transcript segments yet.",
			"panel.activity": "Recording status indicator (not audio level)",
			"panel.track.on": "Capturing",
			"panel.track.off": "Off",
			"panel.track.failed": "Capture failed",
			"panel.track.noSignal": "No sound yet",
			"panel.waitingForSound": "Waiting for sound",
			"panel.systemNoSignal": "No system sound: start audio playback. If still silent, enable DSHASRRecordingHelper in System Settings → Privacy & Security → Screen & System Audio Recording (or System Audio Recording Only), then switch system audio off and on.",
			"panel.micDenied": "Microphone access is off. Enable DSHASRRecordingHelper in System Settings → Privacy & Security → Microphone, then switch the microphone off and on.",
			"panel.systemDenied": "System audio access is off. Enable DSHASRRecordingHelper in System Settings → Privacy & Security → Screen & System Audio Recording (or System Audio Recording Only), then switch system audio off and on.",
			"panel.error.systemCheck": "System audio verification failed. Check recording permissions and audio output in plugin settings, then retry.",
			"panel.error.unsupported": "System audio recording requires macOS 14.2 or later.",
			"panel.error.models": "Models are not ready. Download or repair them in plugin settings.",
			"panel.error.component": "A recording component is missing or incompatible. Reinstall a plugin compatible with this computer.",
			"panel.error.worker": "The transcription component failed. Retry; if it fails again, update the plugin.",
			"panel.error.helper": "The recording component did not respond correctly. Stop and retry.",
			"panel.error.permissionCheck": "The permission check could not finish. Check System Settings and retry.",
			"panel.error.storage": "Cannot read or save the recording. Check disk space and data directory permissions.",
			"panel.error.busy": "A task or another instance is using the recording data. Finish it and retry.",
			"panel.error.resources": "Not enough available memory. Close memory-intensive apps and retry.",
			"panel.error.cancelled": "Cancelled.",
			"panel.error.state": "The recording state changed. Refresh the page and retry.",
			"panel.error.generic": "The operation did not finish. Retry; if it fails again, check the technical details.",
			"panel.error.details": "Technical details",
			"panel.noSession": "Create or select a workspace first",
			"panel.export": "Export transcript",
			"panel.exportHint": "Exports Markdown to the default folder; hold ⌥ to choose a location.",
			"panel.exporting": "Exporting transcript",
			"panel.exportSaved": "Saved to {path}",
			"panel.error.export": "The transcript could not be exported. Check the folder and its permissions, then retry.",
			"panel.error.exportDirectory": "No transcript folder is configured yet. Choose one in the plugin settings, or hold ⌥ while exporting to pick a location.",
			"panel.attribution": "Speaker names",
			"panel.attributionHint": "These names only change the speaker labels in the exported file; the saved transcript keeps its own labels.",
			"panel.attributionDuplicate": "One name is assigned to more than one speaker: {names}. Use a different name for each speaker.",
			"panel.attributionSaving": "Saving names…",
			"panel.attributionSaveFailed": "The speaker names were not saved. Check them and retry; an export still uses the names you entered.",
			"panel.attributionLoadFailed": "The saved speaker names could not be read.",
			"panel.error.exportSpeaker": "The transcript was saved without the speaker names. Check the names and export again.",
			"panel.error.exportSpeakerDuplicate": "Two speakers share one name, so the transcript was not exported. Use a different name for each and retry."
		};
		//#endregion
		//#region src/client/index.tsx
		const inject = [
			"slots",
			"connection",
			"inputTriggers",
			"locale",
			"sessions",
			"uiWorkspace",
			"conversation",
			"configForms"
		];
		function hasMeetingReference(ctx, sessionId, meetingId) {
			const session = ctx.sessions.scope(sessionId);
			if (session === void 0) return false;
			return ctx.conversation.input.for(session).state.getSnapshot().occurrences.some((occurrence) => {
				if (occurrence.source !== "meeting-reference") return false;
				try {
					return parseMeetingReference(occurrence.ref).meetingId === meetingId;
				} catch {
					return false;
				}
			});
		}
		function apply(ctx) {
			const connection = ctx.get("connection");
			const client = new RecordingRpcClient(connection.rpc);
			ctx.effect(() => ctx.locale.register(MEETING_REFERENCE_LOCALE_NAMESPACE, {
				zh,
				en
			}), "dsh-asr: meeting reference dictionaries");
			const translate = ctx.locale.bind(MEETING_REFERENCE_LOCALE_NAMESPACE);
			const references = new MeetingReferenceCoordinator({
				client,
				ctx,
				translate
			});
			ctx.effect(() => () => references.dispose(), "dsh-asr: meeting reference coordinator");
			const source = createMeetingReferenceSource({
				client,
				hasReference: (sessionId, meetingId) => hasMeetingReference(ctx, sessionId, meetingId),
				locale: () => ctx.locale.getLocale().active,
				translate
			});
			ctx.effect(() => ctx.inputTriggers.registerSource(source), "dsh-asr: meeting reference source");
			ctx.effect(() => ctx.locale.register(MODEL_SETTINGS_NAMESPACE, {
				zh: modelZh,
				en: modelEn
			}), "dsh-asr: model settings dictionaries");
			ctx.slots.inject("plugins.bundle.config", () => {
				const source = ctx.configForms.get("dsh-asr");
				return ctx.slots.register({
					name: "plugins.bundle.config",
					key: "@huliux/dsh-asr-plugin",
					locale: MODEL_SETTINGS_NAMESPACE
				}, ({ t, view }) => view === "summary" ? t("summary") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelSettingsBundle, {
					source,
					rpc: connection.rpc,
					t
				}));
			});
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-asr-recording",
				order: 100,
				label: "Recording assistant"
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordingPanel, {
				currentSessionId: () => currentSessionId(ctx),
				locale: ctx.locale,
				references,
				rpc: connection.rpc,
				settings: ctx.configForms.get("dsh-asr"),
				translate
			})));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
if (typeof document !== "undefined" && !document.querySelector("style[data-plugin-css=\"@huliux/dsh-asr-plugin/client\"]")) {
        const style = document.createElement("style");
        style.dataset.plugin = "@huliux/dsh-asr-plugin";
        style.dataset.pluginCss = "@huliux/dsh-asr-plugin/client";
        style.textContent = "._2-6Zyq_page{width:100%;min-width:0;max-width:640px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);gap:12px;font-size:13px;line-height:20px;display:grid}._2-6Zyq_card{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);min-width:0;padding:20px}._2-6Zyq_heading,._2-6Zyq_modelRow,._2-6Zyq_modelTitle,._2-6Zyq_runtimeRow,._2-6Zyq_progressHeading,._2-6Zyq_saveRow{align-items:center;gap:12px;display:flex}._2-6Zyq_heading,._2-6Zyq_modelRow,._2-6Zyq_runtimeRow,._2-6Zyq_progressHeading{justify-content:space-between}._2-6Zyq_heading{align-items:flex-start;padding:4px 0 8px}._2-6Zyq_heading>div,._2-6Zyq_modelCopy{min-width:0}._2-6Zyq_heading>button,._2-6Zyq_modelRow>button{flex-shrink:0}._2-6Zyq_title{margin:0 0 4px;font-size:14px;font-weight:600;line-height:22px}._2-6Zyq_label{font-weight:500}._2-6Zyq_description{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:18px}._2-6Zyq_modelBlock{padding:2px 0 18px}._2-6Zyq_modelBlock+._2-6Zyq_modelBlock{border-top:.5px solid var(--dsw-alias-border-l1);padding-top:18px}._2-6Zyq_modelTitle{flex-wrap:wrap;gap:8px;margin-bottom:4px}._2-6Zyq_runtimeRow{border-top:.5px solid var(--dsw-alias-border-l1);padding-top:12px}._2-6Zyq_loading,._2-6Zyq_notice,._2-6Zyq_error{color:var(--dsw-alias-label-secondary);align-items:baseline;gap:8px;margin:12px 0 0;font-size:12px;line-height:18px;display:flex}._2-6Zyq_loading>*,._2-6Zyq_notice>*,._2-6Zyq_error>*{flex-shrink:0;align-self:center}._2-6Zyq_error{color:var(--dsw-alias-label-error)}._2-6Zyq_instructions{gap:12px;min-width:0;padding-top:16px;display:grid}._2-6Zyq_command{gap:6px;min-width:0;display:grid}._2-6Zyq_diagnostics{overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary);margin:0;padding-left:18px;font-size:12px;line-height:18px}._2-6Zyq_diagnostics:empty{display:none}._2-6Zyq_diagnosticGroups{gap:14px;margin:16px 0;display:grid}._2-6Zyq_diagnosticGroup+._2-6Zyq_diagnosticGroup{border-top:.5px solid var(--dsw-alias-border-l1);padding-top:14px}._2-6Zyq_helpHeading{width:fit-content;max-width:100%}._2-6Zyq_connectionSummary{color:var(--dsw-alias-label-secondary);margin-left:12px;font-size:12px}._2-6Zyq_downloadRouting{gap:8px;min-width:0;margin-top:16px;display:grid}._2-6Zyq_downloadRouting label{margin-top:4px}._2-6Zyq_downloadActions{flex-wrap:wrap;gap:8px;display:flex}._2-6Zyq_saveRow{flex-wrap:wrap;margin-top:12px}._2-6Zyq_downloadProgress{gap:8px;min-width:0;margin-top:12px;display:grid}._2-6Zyq_progressHeading>span{align-items:center;gap:8px;display:flex}._2-6Zyq_progressBytes{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;font-size:12px}._2-6Zyq_downloadProgress progress{width:100%;height:4px;accent-color:var(--dsw-alias-label-primary)}@media (width<=600px){._2-6Zyq_card{padding:16px}._2-6Zyq_heading,._2-6Zyq_modelRow{gap:8px}._2-6Zyq_modelTitle{gap:4px}}@media (width<=980px){._2-6Zyq_page{padding-bottom:180px}}._2-6Zyq_proxyOptions{gap:8px;margin-top:4px;display:grid}._2-6Zyq_proxyOptions a{width:fit-content}._2-6Zyq_preparationSteps{color:var(--dsw-alias-label-secondary);gap:8px;margin:4px 0 0;padding:0;font-size:12px;list-style:none;display:grid}._2-6Zyq_preparationSteps li{align-items:center;gap:8px;display:flex}.Expx1a_panel{z-index:1200;box-sizing:border-box;pointer-events:auto;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-settings-card-fill);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);border-radius:12px;flex-direction:column;font-size:12px;line-height:18px;display:flex;position:fixed;box-shadow:0 1px 3px #00000008,0 6px 20px -4px #00000012}.Expx1a_panel[data-expanded=true]{border-radius:16px}.Expx1a_header{box-sizing:border-box;flex-shrink:0;align-items:center;gap:4px;height:46px;padding:5px;display:flex}.Expx1a_header>*{flex-shrink:0}.Expx1a_header>.Expx1a_spacer{flex:auto;min-width:0}.Expx1a_panel button{border-radius:8px;padding:0}.Expx1a_panel button:focus-visible{outline:2px solid var(--dsw-alias-label-primary);outline-offset:-2px}.Expx1a_control{flex-shrink:0;width:36px;min-width:24px;height:36px}.Expx1a_split{flex-shrink:0;align-items:center;display:inline-flex;position:relative}.Expx1a_splitMain{border-top-right-radius:0;border-bottom-right-radius:0;width:32px;min-width:22px}.Expx1a_caret{width:16px;min-width:12px;height:36px;color:var(--dsw-alias-label-tertiary);border-top-left-radius:0;border-bottom-left-radius:0}.Expx1a_caret:hover,.Expx1a_caretOpen{color:var(--dsw-alias-label-primary)}.Expx1a_caretIcon{display:block}.Expx1a_menu{z-index:10;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-settings-card-fill);border-radius:10px;flex-direction:column;width:max-content;min-width:180px;max-width:320px;max-height:240px;padding:4px;display:flex;position:absolute;bottom:calc(100% + 6px);left:0;overflow:auto;box-shadow:0 6px 20px -4px #0000001f}.Expx1a_menuItem{width:100%;color:var(--dsw-alias-label-primary);text-align:left;overflow-wrap:anywhere;background:0 0;border-radius:6px;align-items:center;gap:6px;padding:6px 8px;font-size:12px;line-height:18px;display:flex}.Expx1a_menuItem:hover{background:var(--dsw-alias-interactive-bg-hover)}.Expx1a_menu[data-below=true]{top:calc(100% + 6px);bottom:auto}.Expx1a_menuEmpty{color:var(--dsw-alias-label-tertiary);padding:6px 8px;font-size:12px;line-height:18px;display:block}.Expx1a_menuCheck{width:10px;color:var(--dsw-alias-label-primary);display:inline-block}.Expx1a_mainControl{flex-shrink:0;gap:6px;width:60px;min-width:48px;height:36px}.Expx1a_move{cursor:grab;touch-action:none;width:16px;min-width:12px;height:36px;color:var(--dsw-alias-label-tertiary)}.Expx1a_move:active{cursor:grabbing}.Expx1a_toggle{width:28px;min-width:24px;height:36px;color:var(--dsw-alias-label-secondary)}.Expx1a_spacer{flex:1;min-width:0}.Expx1a_icon{background:currentColor;flex-shrink:0;width:20px;height:20px;display:block;mask-position:50%;mask-size:contain;mask-repeat:no-repeat}.Expx1a_play,.Expx1a_actionIcon{width:24px;height:24px}.Expx1a_grip{width:5.4px;height:8.4px}.Expx1a_expand,.Expx1a_collapse,.Expx1a_resize .Expx1a_icon{width:18px;height:18px}.Expx1a_check{width:16px;height:16px;color:var(--dsw-alias-state-success-primary)}.Expx1a_off{color:var(--dsw-alias-label-tertiary)}.Expx1a_warning{color:var(--dsw-alias-state-warn-label)}.Expx1a_error,.Expx1a_errorControl{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}.Expx1a_errorControl{width:28px;min-width:28px}.Expx1a_error.Expx1a_noSignal,.Expx1a_errorControl.Expx1a_noSignal{color:var(--dsw-alias-state-warn-label)}.Expx1a_body{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex:1;min-height:0;display:flex;overflow:auto}.Expx1a_status{flex-shrink:0;justify-content:space-between;align-items:center;gap:8px;padding:16px;display:flex}.Expx1a_phase{align-items:center;gap:8px;font-weight:500;display:inline-flex}.Expx1a_tracks{flex-wrap:wrap;flex-shrink:0;gap:8px;padding:0 16px;display:flex}.Expx1a_chip{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);border-radius:8px;align-items:center;padding:4px 8px;font-size:11px;line-height:17px;display:inline-flex}.Expx1a_chip.Expx1a_warning{color:var(--dsw-alias-state-warn-label)}.Expx1a_body>.Expx1a_error{margin:8px 16px 0}.Expx1a_recognizer{align-items:center;gap:4px;min-width:0;display:inline-flex}.Expx1a_recognizerLabel{color:var(--dsw-alias-label-secondary);white-space:nowrap;font-size:11px;line-height:17px}.Expx1a_recognizerSelect{border:1px solid var(--dsw-alias-interactive-border);height:22px;color:var(--dsw-alias-label-secondary);background:0 0;border-radius:6px;padding:0 4px;font-family:inherit;font-size:11px}.Expx1a_recognizerSelect:disabled{opacity:.5}.Expx1a_hint,.Expx1a_segmentMeta{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;font-size:11px;line-height:17px}.Expx1a_hint.Expx1a_warning{color:var(--dsw-alias-state-warn-label)}.Expx1a_preview{flex-direction:column;flex:1;min-height:80px;padding:16px;display:flex}.Expx1a_previewHeading{justify-content:space-between;align-items:center;gap:8px;margin-bottom:16px;display:flex}.Expx1a_previewTitle{font-weight:500}.Expx1a_segments{overscroll-behavior:contain;flex:1;min-height:0;overflow:auto}.Expx1a_segment{color:var(--dsw-alias-label-secondary);gap:4px;margin-bottom:12px;display:grid}.Expx1a_segment:last-child{color:var(--dsw-alias-label-primary);margin-bottom:0}.Expx1a_text{overflow-wrap:anywhere;white-space:pre-wrap;user-select:text;font-size:14px;line-height:23px}.Expx1a_footer{border-top:1px solid var(--dsw-alias-border-l2);flex-shrink:0;align-items:center;gap:4px;padding:10px 8px 10px 12px;display:flex}.Expx1a_footer>.Expx1a_hint{overflow-wrap:anywhere;flex:1;min-width:0}.Expx1a_utility{width:24px;min-width:24px;height:24px;color:var(--dsw-alias-label-tertiary)}.Expx1a_resize{cursor:nwse-resize;touch-action:none;width:24px;min-width:24px;height:24px;color:var(--dsw-alias-label-tertiary)}.Expx1a_wave{flex-shrink:0}.Expx1a_wave path{transform-box:fill-box;transform-origin:50%}.Expx1a_wave[data-recording-wave=moving] path{animation:.9s ease-in-out infinite Expx1a_recordingWave}.Expx1a_wave path:nth-child(2){animation-delay:-.45s}.Expx1a_wave path:nth-child(3){animation-delay:-.225s}.Expx1a_wave path:nth-child(4){animation-delay:-.675s}.Expx1a_wave[data-recording-wave=still]{color:var(--dsw-alias-label-tertiary)}.Expx1a_spinner{box-sizing:border-box;border:2px solid var(--dsw-alias-border-l3);border-top-color:var(--dsw-alias-label-primary);border-radius:50%;width:18px;height:18px;animation:1s linear infinite Expx1a_recordingSpin}@keyframes Expx1a_recordingWave{0%,to{transform:scaleY(.35)}50%{transform:scaleY(1)}}@keyframes Expx1a_recordingSpin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.Expx1a_wave[data-recording-wave=moving] path,.Expx1a_spinner{animation:none}}.Expx1a_error{white-space:pre-line}.Expx1a_attribution{border-top:1px solid var(--dsw-alias-border-l2);flex-shrink:0;padding:12px 16px}.Expx1a_attribution p{margin:8px 0 0}.Expx1a_attributionSummary{color:var(--dsw-alias-label-primary);font-weight:500}.Expx1a_attributionSummary:focus-visible,.Expx1a_attributionInput:focus-visible{outline:2px solid var(--dsw-alias-interactive-border);outline-offset:1px;border-radius:4px}.Expx1a_attributionFields{flex-direction:column;gap:8px;margin-top:8px;display:flex}.Expx1a_attributionField{grid-template-columns:minmax(64px,.4fr) 1fr;align-items:center;gap:8px;display:grid}.Expx1a_attributionLabel{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.Expx1a_attributionInput{border:1px solid var(--dsw-alias-interactive-border);min-width:0;height:24px;color:var(--dsw-alias-label-primary);font:inherit;background:0 0;border-radius:6px;padding:0 6px}.Expx1a_attributionError{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;margin:6px 16px 0;font-size:11px;line-height:17px}.Expx1a_panel .Expx1a_ingest{min-width:60px;height:24px;color:var(--dsw-alias-label-primary);flex-shrink:0;padding:0 10px;font-size:12px;line-height:18px}.Expx1a_panel .Expx1a_ingest:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.Expx1a_stored{border-top:1px solid var(--dsw-alias-border-l2);flex-direction:column;flex-shrink:0;gap:8px;padding:12px 16px;display:flex}.Expx1a_storedHeading{align-items:center;gap:8px;display:flex}.Expx1a_storedErrorDetail{color:var(--dsh-text-tertiary,#6b7280);font-family:var(--dsh-font-mono,ui-monospace, SFMono-Regular, Menlo, monospace);word-break:break-word;margin:2px 0 0;font-size:11px;line-height:1.4}.Expx1a_syncButton{flex-shrink:0;margin-left:auto}.Expx1a_syncRow{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.Expx1a_stored .Expx1a_hint,.Expx1a_stored p{margin:0}.Expx1a_stored .Expx1a_spinner{border-width:1.5px;width:14px;height:14px}.Expx1a_storedList{overscroll-behavior:contain;flex-direction:column;gap:2px;max-height:140px;display:flex;overflow:auto}.Expx1a_panel .Expx1a_storedRow{width:100%;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border-radius:6px;align-items:center;gap:8px;padding:6px 8px;font-size:12px;line-height:18px;display:flex}.Expx1a_panel .Expx1a_storedRow:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.Expx1a_panel .Expx1a_storedRow[aria-selected=true]{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 2px 0 0 var(--dsw-alias-label-primary)}.Expx1a_panel .Expx1a_storedRow:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.Expx1a_storedTitle{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.Expx1a_storedMeta{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;flex-shrink:0;font-size:11px}.Expx1a_storedError{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;font-size:11px;line-height:17px}\n";
        document.head.appendChild(style);
      }