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
    if (!window.wx) return reject(new Error("wx is not loaded"));

    const MEETING_APIS = ["createMeeting", "joinMeeting"];

    // Corp-level config
    wx.config({
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

    wx.error((err) => {
      log("[wx.config error]", err);
      reject(err);
    });

    wx.ready(() => {
      log("[wx.config ready]");

      // Agent-level config (for self-built apps)
      wx.agentConfig({
        corpid: corpId,
        agentid: agentId,
        timestamp,
        nonceStr,
        signature: agentSignature,
        jsApiList: [
          // Meeting APIs are expected here; adjust names/params according to the official doc you linked.
          ...MEETING_APIS,
        ],
        success: () => {
          log("[wx.agentConfig success]");
          wx.checkJsApi({
            jsApiList: MEETING_APIS,
            success: (res) => log("[checkJsApi]", res),
            fail: (err) => log("[checkJsApi fail]", err),
          });
          resolve();
        },
        fail: (err) => {
          log("[wx.agentConfig fail]", err);
          reject(err);
        },
      });
    });
  });
}

function wxInvoke(name, params) {
  return new Promise((resolve, reject) => {
    wx.invoke(name, params, (res) => {
      // WeCom JS-SDK usually returns {err_msg: "...:ok"} on success.
      const msg = res?.err_msg || res?.errMsg || "";
      if (msg.endsWith(":ok") || msg.endsWith(":OK")) return resolve(res);
      reject(res);
    });
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

  // TODO: Adjust params exactly as the official doc (path/93806) requires.
  // Keep it empty first; many APIs use defaults.
  const params = {};
  log("[createMeeting] invoking...", params);

  try {
    const res = await wxInvoke("createMeeting", params);
    log("[createMeeting] success", res);

    // Common patterns: meeting_id / meetingId / meeting_code etc. Fill the input if present.
    const maybeId = res.meeting_id || res.meetingId || res.meeting_code || res.meetingCode || "";
    if (maybeId) $("#meetingId").value = String(maybeId);
  } catch (err) {
    log("[createMeeting] fail", err);
    throw err;
  }
}

async function doJoinMeeting() {
  if (!inited) await doInit();

  const meetingId = $("#meetingId").value.trim();
  // TODO: Adjust key name per official doc (path/93807).
  const params = meetingId ? { meeting_id: meetingId } : {};

  log("[joinMeeting] invoking...", params);
  try {
    const res = await wxInvoke("joinMeeting", params);
    log("[joinMeeting] success", res);
  } catch (err) {
    log("[joinMeeting] fail", err);
    throw err;
  }
}

$("#btnInit").addEventListener("click", () => {
  doInit().catch((e) => log("[init] fail", String(e?.message || e)));
});
$("#btnCreate").addEventListener("click", () => {
  doCreateMeeting().catch((e) => log("[createMeeting] exception", e));
});
$("#btnJoin").addEventListener("click", () => {
  doJoinMeeting().catch((e) => log("[joinMeeting] exception", e));
});

log("页面已加载。请在企业微信内打开，然后点击「初始化 JS-SDK」。");
