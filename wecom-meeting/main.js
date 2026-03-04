const $ = (sel) => document.querySelector(sel);

const logEl = $("#log");
function log(...args) {
  const s = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2)))
    .join(" ");
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
const API_BASE = apiBaseFromQuery || window.__API_BASE__ || "";

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
  if (!res.ok || !json.ok) throw new Error(json.error || `http status=${res.status}`);
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
  const userId = res?.userid || res?.userId || "";
  if (!userId) throw new Error("getContext returned empty userid");
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
      $("#meetingId").value = maybeId;
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

async function doJoinMeeting() {
  if (!inited) await doInit();

  const rawValue = $("#meetingId").value.trim();
  let meetingId = cleanMeetingInput(rawValue);
  $("#meetingId").value = meetingId;

  if (!meetingId) {
    log("[startMeeting/join] 请输入 meetingId。");
    return;
  }

  if (isLikelyMeetingCode(meetingId)) {
    log("[startMeeting/join] 检测到会议号（meeting_code），尝试通过后端解析 meetingId...");
    try {
      meetingId = await resolveMeetingIdByCode(meetingId);
      if (!meetingId) throw new Error("resolve-id returned empty meetingId");
      $("#meetingId").value = meetingId;
      log("[startMeeting/join] resolved meetingId", { meetingId });
    } catch (err) {
      log("[startMeeting/join] 无法将会议号转换为 meetingId", err);
      return;
    }
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
$("#btnJoin").addEventListener("click", () => {
  doJoinMeeting().catch((e) => log("[startMeeting/join] exception", e));
});

log("页面已加载。请在企业微信内打开，然后点击「初始化 JS-SDK」。");
