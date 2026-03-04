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

// If you host the frontend on GitHub Pages, you MUST set an HTTPS backend for signatures.
// Provide it via querystring: ?apiBase=https://YOUR_BACKEND_DOMAIN
// Or set window.__API_BASE__ in index.html before loading main.js.
const apiBaseFromQuery = new URLSearchParams(window.location.search).get("apiBase") || "";
const API_BASE = apiBaseFromQuery || window.__API_BASE__ || "";

function apiUrl(path) {
  if (!API_BASE) return path;
  return `${API_BASE.replace(/\/+$/, "")}${path}`;
}

async function fetchJssdkConfig() {
  const pageUrl = window.location.href.split("#")[0];
  const full = apiUrl(`/api/jssdk-config?url=${encodeURIComponent(pageUrl)}`);
  log("[init] apiBase =", API_BASE || "(empty)");
  log("[init] request =", full);

  let res;
  try {
    res = await fetch(full, { method: "GET" });
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

function initWx({ corpId, agentId, timestamp, nonceStr, corpSignature, agentSignature }) {
  return new Promise((resolve, reject) => {
    const sdk = getSdk();
    if (!sdk) return reject(new Error("WeCom JS-SDK is not loaded"));
    if (
      typeof sdk.config !== "function" ||
      typeof sdk.ready !== "function" ||
      typeof sdk.error !== "function" ||
      typeof sdk.agentConfig !== "function"
    ) {
      return reject(new Error("Current SDK does not provide config/agentConfig APIs"));
    }

    const MEETING_APIS = ["startMeeting"];

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

function startMeeting(params = {}, action = "startMeeting") {
  return new Promise((resolve, reject) => {
    const sdk = getSdk();
    if (!sdk) return reject(new Error("WeCom JS-SDK is not loaded"));
    if (typeof sdk.startMeeting !== "function") {
      return reject(new Error("Current SDK does not support startMeeting()"));
    }

    const options = {
      ...params,
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
    };

    try {
      sdk.startMeeting(options);
    } catch (err) {
      reject(err);
    }
  });
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

  const params = {};
  log("[startMeeting/create] invoking...", params);

  try {
    const res = await startMeeting(params, "startMeeting/create");
    log("[startMeeting/create] success", res);

    const maybeId = res.meetingId || res.meeting_id || "";
    if (maybeId) $("#meetingId").value = String(maybeId);
  } catch (err) {
    log("[startMeeting/create] fail", err);
    throw err;
  }
}

async function doJoinMeeting() {
  if (!inited) await doInit();

  const meetingId = $("#meetingId").value.trim();
  const params = meetingId ? { meetingId } : {};

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
