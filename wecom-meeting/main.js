const $ = (sel) => document.querySelector(sel);

const logEl = $("#log");
function formatForLog(v) {
  if (typeof v === "string") return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function log(...args) {
  const s = args.map((a) => formatForLog(a)).join(" ");
  logEl.textContent += `${new Date().toLocaleTimeString()} ${s}\n`;
}

function assertInWeCom() {
  // Not bulletproof, but gives a helpful hint.
  const ua = navigator.userAgent || "";
  if (!/wxwork/i.test(ua)) {
    log("[hint] 当前似乎不是在企业微信内打开（userAgent 不含 wxwork），JS-SDK 可能无法正常工作。");
  }
}

function getSdk() {
  // New SDK exposes `ww`; keep `wx` fallback for compatibility.
  return window.ww || window.wx || null;
}

function extractMeetingId(payload) {
  if (!payload || typeof payload !== "object") return "";
  const targetKeys = new Set(["meetingid", "meeting_id", "meetingcode", "meeting_code"]);
  const visited = new Set();
  const stack = [payload];

  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (visited.has(node)) continue;
    visited.add(node);

    for (const [key, value] of Object.entries(node)) {
      const normalizedKey = String(key).toLowerCase();
      if (targetKeys.has(normalizedKey)) {
        if (value !== undefined && value !== null && String(value).trim()) {
          return String(value).trim();
        }
      }

      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  return "";
}

function cleanMeetingInput(raw) {
  return String(raw || "")
    .replace(/^#?\s*企业微信会议[:：]\s*/i, "")
    .replace(/\s+/g, "")
    .trim();
}

function isLikelyMeetingCode(input) {
  return /^\d{3}-?\d{3}-?\d{3}$/.test(String(input || ""));
}

function normalizeMeetingCode(input) {
  return String(input || "").replace(/\D+/g, "");
}

// If you host the frontend on GitHub Pages, you MUST set an HTTPS backend for signatures.
// Provide it via querystring: ?apiBase=https://YOUR_BACKEND_DOMAIN
// Or set window.__API_BASE__ in index.html before loading main.js.
const apiBaseFromQuery = new URLSearchParams(window.location.search).get("apiBase") || "";
const userIdFromQuery = new URLSearchParams(window.location.search).get("userId") || "";
const API_BASE = apiBaseFromQuery || window.__API_BASE__ || "";
const USER_ID_STORAGE_KEY = "wecom_demo_user_id";

function readSavedUserId() {
  try {
    return localStorage.getItem(USER_ID_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveUserId(v) {
  try {
    if (v) localStorage.setItem(USER_ID_STORAGE_KEY, v);
    else localStorage.removeItem(USER_ID_STORAGE_KEY);
  } catch {
    // ignore storage errors in private mode
  }
}

function getManualUserId() {
  return ($("#userId")?.value || "").trim();
}

function showMeetingIdModal(meetingId, infoLine = "") {
  const modal = $("#meetingIdModal");
  const result = $("#meetingIdResult");
  if (!modal || !result) return;
  result.textContent = infoLine ? `${infoLine}\nmeetingId: ${meetingId}` : `meetingId: ${meetingId}`;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function hideMeetingIdModal() {
  const modal = $("#meetingIdModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

async function copyMeetingIdFromModal() {
  const result = $("#meetingIdResult")?.textContent || "";
  const matched = result.match(/meetingId:\s*(.+)$/m);
  const meetingId = (matched?.[1] || "").trim();
  if (!meetingId) {
    log("[copyMeetingId] 没有可复制的 meetingId");
    return;
  }
  try {
    await navigator.clipboard.writeText(meetingId);
    log("[copyMeetingId] copied", { meetingId });
  } catch {
    const ta = document.createElement("textarea");
    ta.value = meetingId;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    log("[copyMeetingId] copied (fallback)", { meetingId });
  }
}

function setupUserIdInput() {
  const input = $("#userId");
  if (!input) return;
  const initial = userIdFromQuery || window.__WECOM_USER_ID__ || readSavedUserId();
  if (initial) input.value = String(initial).trim();
  input.addEventListener("change", () => {
    const v = input.value.trim();
    saveUserId(v);
    log("[userId] updated", v ? { userId: v } : "(empty)");
  });
}

function apiUrl(path) {
  if (!API_BASE) return path;
  return `${API_BASE.replace(/\/+$/, "")}${path}`;
}

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    throw new Error(`fetch failed: ${String(e?.message || e)}`);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-json response (status=${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || !json.ok) {
    const extra = [];
    if (json?.meetingCode) extra.push(`meetingCode=${json.meetingCode}`);
    if (json?.userId) extra.push(`userId=${json.userId}`);
    if (json?.scanned !== undefined) extra.push(`scanned=${json.scanned}`);
    if (Array.isArray(json?.sampleCodes) && json.sampleCodes.length) {
      extra.push(`sampleCodes=${json.sampleCodes.slice(0, 8).join(",")}`);
    }
    const suffix = extra.length ? ` (${extra.join(", ")})` : "";
    throw new Error((json?.error || `http status=${res.status}`) + suffix);
  }
  return json;
}

async function postJson(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body || {}),
    });
  } catch (e) {
    throw new Error(`fetch failed: ${String(e?.message || e)}`);
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-json response (status=${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || !json.ok) {
    throw new Error(json?.error || `http status=${res.status}`);
  }
  return json;
}

async function fetchJssdkConfig() {
  const pageUrl = window.location.href.split("#")[0];
  const full = apiUrl(`/api/jssdk-config?url=${encodeURIComponent(pageUrl)}`);
  log("[init] apiBase =", API_BASE || "(empty)");
  log("[init] request =", full);
  return fetchJson(full);
}

function initWx({ corpId, agentId, timestamp, nonceStr, corpSignature, agentSignature }) {
  return new Promise((resolve, reject) => {
    const sdk = getSdk();
    if (!sdk) return reject(new Error("WeCom JS-SDK is not loaded"));

    const MEETING_APIS = ["startMeeting", "getContext"];

    if (typeof sdk.register === "function") {
      try {
        sdk.register({
          corpId,
          agentId,
          jsApiList: MEETING_APIS,
          getConfigSignature: async (url) => {
            log("[sdk.register] getConfigSignature", { url });
            return {
              timestamp,
              nonceStr,
              signature: corpSignature,
            };
          },
          getAgentConfigSignature: async (url) => {
            log("[sdk.register] getAgentConfigSignature", { url });
            return {
              timestamp,
              nonceStr,
              signature: agentSignature,
            };
          },
          onConfigSuccess: (res) => log("[sdk.register] onConfigSuccess", res),
          onConfigFail: (err) => log("[sdk.register] onConfigFail", err),
          onConfigComplete: (res) => log("[sdk.register] onConfigComplete", res),
          onAgentConfigSuccess: (res) => log("[sdk.register] onAgentConfigSuccess", res),
          onAgentConfigFail: (err) => log("[sdk.register] onAgentConfigFail", err),
          onAgentConfigComplete: (res) => log("[sdk.register] onAgentConfigComplete", res),
        });
      } catch (err) {
        return reject(err);
      }

      const readyPromise =
        typeof sdk.ensureAgentConfigReady === "function"
          ? sdk.ensureAgentConfigReady()
          : typeof sdk.ensureConfigReady === "function"
            ? sdk.ensureConfigReady()
            : Promise.resolve();

      Promise.resolve(readyPromise)
        .then(() => {
          log("[sdk.register] ready");
          if (typeof sdk.checkJsApi === "function") {
            sdk.checkJsApi({
              jsApiList: MEETING_APIS,
              success: (res) => log("[checkJsApi]", res),
              fail: (err) => log("[checkJsApi fail]", err),
              complete: (res) => log("[checkJsApi complete]", res),
            });
          }
          resolve();
        })
        .catch((err) => {
          log("[sdk.register] ready fail", err);
          reject(err);
        });
      return;
    }

    if (
      typeof sdk.config !== "function" ||
      typeof sdk.ready !== "function" ||
      typeof sdk.error !== "function" ||
      typeof sdk.agentConfig !== "function"
    ) {
      return reject(new Error("Current SDK does not provide register or config/agentConfig APIs"));
    }

    // Corp-level config
    sdk.config({
      beta: true,
      debug: false,
      appId: corpId,
      timestamp,
      nonceStr,
      signature: corpSignature,
      jsApiList: [
        // Put the APIs you will use here. Signature is not impacted, but permission checks are.
        "checkJsApi",
        "agentConfig",
        // Some JSAPIs also require being declared at corp-level; keeping them in both lists avoids
        // "permission denied" caused by missing jsApiList declarations.
        ...MEETING_APIS,
      ],
    });

    sdk.error((err) => {
      log("[sdk.config error]", err);
      reject(err);
    });

    sdk.ready(() => {
      log("[sdk.config ready]");

      // Agent-level config (for self-built apps)
      sdk.agentConfig({
        corpid: corpId,
        agentid: agentId,
        timestamp,
        nonceStr,
        signature: agentSignature,
        jsApiList: [
          // Meeting APIs are expected here.
          ...MEETING_APIS,
        ],
        success: () => {
          log("[sdk.agentConfig success]");
          sdk.checkJsApi({
            jsApiList: MEETING_APIS,
            success: (res) => log("[checkJsApi]", res),
            fail: (err) => log("[checkJsApi fail]", err),
          });
          resolve();
        },
        fail: (err) => {
          log("[sdk.agentConfig fail]", err);
          reject(err);
        },
      });
    });
  });
}

function startMeeting(params, action = "startMeeting") {
  const sdk = getSdk();
  if (!sdk) return Promise.reject(new Error("WeCom JS-SDK is not loaded"));
  if (typeof sdk.startMeeting !== "function") {
    return Promise.reject(new Error("Current SDK does not support startMeeting()"));
  }

  // Follow latest docs first: Promise return with meetingId.
  try {
    const maybePromise = params === undefined ? sdk.startMeeting() : sdk.startMeeting(params);
    if (maybePromise && typeof maybePromise.then === "function") {
      return maybePromise
        .then((res) => {
          log(`[${action}] promise success`, res);
          return res || {};
        })
        .catch((err) => {
          log(`[${action}] promise fail`, err);
          throw err;
        });
    }
  } catch (err) {
    log(`[${action}] invoke throw`, err);
    return Promise.reject(err);
  }

  // Fallback for old callback-only behaviors.
  return new Promise((resolve, reject) => {
    log(`[${action}] fallback to callback mode`);
    const baseParams = params && typeof params === "object" ? params : {};
    try {
      sdk.startMeeting({
        ...baseParams,
        success: (res) => {
          log(`[${action}] callback success`, res);
          resolve(res || {});
        },
        fail: (err) => {
          log(`[${action}] callback fail`, err);
          reject(err || new Error("startMeeting failed"));
        },
        cancel: (res) => {
          log(`[${action}] callback cancel`, res);
          reject(res || new Error("startMeeting canceled"));
        },
        complete: (res) => {
          log(`[${action}] callback complete`, res);
        },
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function getCurrentUserId() {
  const sdk = getSdk();
  if (!sdk || typeof sdk.getContext !== "function") {
    throw new Error("Current SDK does not support getContext()");
  }

  let res;
  try {
    const maybePromise = sdk.getContext();
    if (maybePromise && typeof maybePromise.then === "function") {
      res = await maybePromise;
    } else {
      res = await new Promise((resolve, reject) => {
        sdk.getContext({
          success: resolve,
          fail: reject,
        });
      });
    }
  } catch (err) {
    throw new Error(`getContext failed: ${String(err?.errMsg || err?.errmsg || err?.message || err)}`);
  }

  log("[getContext] success", res);
  const userId =
    res?.userid ||
    res?.userId ||
    res?.open_userid ||
    res?.openUserid ||
    getManualUserId() ||
    userIdFromQuery ||
    window.__WECOM_USER_ID__ ||
    readSavedUserId() ||
    "";
  if (!userId) {
    throw new Error("getContext 未返回 userid。请填写页面里的「企业微信 userId」，或在 URL 上加 ?userId=xxx。");
  }
  saveUserId(String(userId));
  return String(userId);
}

async function resolveMeetingIdByCode(meetingCodeRaw) {
  const meetingCode = normalizeMeetingCode(meetingCodeRaw);
  if (meetingCode.length !== 9) {
    throw new Error("meetingCode must be 9 digits");
  }

  const userId = await getCurrentUserId();
  const full = apiUrl(
    `/api/meeting/resolve-id?meetingCode=${encodeURIComponent(meetingCode)}&userId=${encodeURIComponent(userId)}`,
  );
  log("[resolveMeetingId] request", { full, meetingCode, userId });
  const json = await fetchJson(full);
  log("[resolveMeetingId] success", json);
  return json.meetingId || "";
}

let inited = false;

async function doInit() {
  assertInWeCom();
  log("[init] fetching signature...");
  const cfg = await fetchJssdkConfig();
  log("[init] got config", {
    corpId: cfg.corpId,
    agentId: cfg.agentId,
    timestamp: cfg.timestamp,
    nonceStr: cfg.nonceStr,
  });
  await initWx(cfg);
  inited = true;
  $("#btnCreate").disabled = false;
  $("#btnBackendCreate").disabled = false;
  $("#btnResolveId").disabled = false;
  $("#btnJoin").disabled = false;
  log("[init] done");
}

async function doCreateMeeting() {
  if (!inited) await doInit();

  const params = undefined;
  log("[startMeeting/create] invoking without params");

  try {
    const res = await startMeeting(params, "startMeeting/create");
    log("[startMeeting/create] success", res);

    const maybeId = extractMeetingId(res);
    if (maybeId) {
      $("#joinMeetingId").value = maybeId;
      log("[startMeeting/create] filled meetingId", { meetingId: maybeId });
    } else {
      log("[startMeeting/create] payload keys", Object.keys(res || {}));
      log("[startMeeting/create] no meetingId in response payload; 可粘贴9位会议号，页面会尝试通过后端自动解析 meetingId。");
    }
  } catch (err) {
    log("[startMeeting/create] fail", err);
    throw err;
  }
}

async function doResolveMeetingId() {
  if (!inited) await doInit();

  const rawValue = $("#meetingCode").value.trim();
  const meetingCode = cleanMeetingInput(rawValue);
  $("#meetingCode").value = meetingCode;

  if (!meetingCode) {
    log("[resolveMeetingId] 请输入会议号（9位数字）。");
    return;
  }
  if (!isLikelyMeetingCode(meetingCode)) {
    log("[resolveMeetingId] 会议号格式不正确，请输入9位数字会议号。");
    return;
  }

  log("[resolveMeetingId] 开始按会议号查询 meetingId...", { meetingCode });
  try {
    const meetingId = await resolveMeetingIdByCode(meetingCode);
    if (!meetingId) throw new Error("resolve-id returned empty meetingId");
    $("#joinMeetingId").value = meetingId;
    log("[resolveMeetingId] success", { meetingCode, meetingId });
    showMeetingIdModal(meetingId, `meetingCode: ${meetingCode}`);
  } catch (err) {
    log("[resolveMeetingId] fail", err);
    log("[resolveMeetingId] 提示：请确认 userId、应用可见范围和会议权限配置。");
  }
}

async function doBackendCreateMeeting() {
  if (!inited) await doInit();

  let userId = getManualUserId();
  if (!userId) {
    try {
      userId = await getCurrentUserId();
    } catch (err) {
      log("[backendCreate] getContext failed, fallback to manual userId", err);
      userId = getManualUserId();
    }
  }

  if (!userId) {
    log("[backendCreate] 缺少 userId。请先填写「企业微信 userId（可选）」输入框。");
    return;
  }

  const nowText = new Date().toLocaleString();
  const payload = {
    adminUserId: userId,
    title: `H5 Demo ${nowText}`,
  };
  log("[backendCreate] request payload", payload);

  const full = apiUrl("/api/meeting/create");
  const json = await postJson(full, payload);
  const meetingId = String(json.meetingId || "").trim();
  log("[backendCreate] success", {
    meetingId,
    accessTokenReady: json.accessTokenReady,
    accessTokenPreview: json.accessTokenPreview,
  });

  if (!meetingId) {
    throw new Error("backend create succeeded but meetingId is empty");
  }
  $("#joinMeetingId").value = meetingId;
  showMeetingIdModal(meetingId, "source: 后端创建会议");
}

async function doJoinMeeting() {
  if (!inited) await doInit();

  const meetingId = cleanMeetingInput($("#joinMeetingId").value.trim());
  $("#joinMeetingId").value = meetingId;

  if (!meetingId) {
    log("[startMeeting/join] 请输入会议ID。");
    return;
  }
  if (isLikelyMeetingCode(meetingId)) {
    log("[startMeeting/join] 请输入会议ID（非9位会议号）。请先点击「查询会议ID」。");
    return;
  }

  const params = { meetingId };

  log("[startMeeting/join] invoking...", params);
  try {
    const res = await startMeeting(params, "startMeeting/join");
    log("[startMeeting/join] success", res);
  } catch (err) {
    log("[startMeeting/join] fail", err);
    throw err;
  }
}

$("#btnInit").addEventListener("click", () => {
  doInit().catch((e) => log("[init] fail", String(e?.message || e)));
});
$("#btnCreate").addEventListener("click", () => {
  doCreateMeeting().catch((e) => log("[startMeeting/create] exception", e));
});
$("#btnResolveId").addEventListener("click", () => {
  doResolveMeetingId().catch((e) => log("[resolveMeetingId] exception", e));
});
$("#btnBackendCreate").addEventListener("click", () => {
  doBackendCreateMeeting().catch((e) => log("[backendCreate] exception", e));
});
$("#btnJoin").addEventListener("click", () => {
  doJoinMeeting().catch((e) => log("[startMeeting/join] exception", e));
});
$("#btnCloseMeetingIdModal").addEventListener("click", hideMeetingIdModal);
$("#btnCopyMeetingId").addEventListener("click", () => {
  copyMeetingIdFromModal().catch((e) => log("[copyMeetingId] fail", e));
});
$("#meetingIdModal").addEventListener("click", (e) => {
  if (e.target?.id === "meetingIdModal") hideMeetingIdModal();
});

setupUserIdInput();
log("页面已加载。请在企业微信内打开，然后点击「初始化 JS-SDK」。");
