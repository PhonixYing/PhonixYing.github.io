#!/usr/bin/env node
/*
 * 从 assets/js/data.js 生成 index.html 中的
 *   1) 精选卡片 + 全部 App 卡片（静态 HTML，爬虫无需执行 JS 就能看到）
 *   2) JSON-LD 结构化数据（WebSite / Person / ItemList of SoftwareApplication）
 *
 * 用法（仓库根目录）：
 *   node tools/render-cards.js
 *
 * 只改写 index.html 里带标记的区块，其它内容原样保留：
 *   <!-- cards:featured:start ... -->  ... <!-- cards:featured:end -->
 *   <!-- cards:apps:start ... -->      ... <!-- cards:apps:end -->
 *   <!-- jsonld:apps:start ... -->     ... <!-- jsonld:apps:end -->
 */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.dirname(__dirname);
const INDEX = path.join(ROOT, "index.html");
const DATA = path.join(ROOT, "assets/js/data.js");
const ORIGIN = "https://phonixying.github.io";
const GITHUB = "https://github.com/PhonixYing";

/* data.js 里的 category 映射到 schema.org 的 applicationCategory */
const CATEGORY = {
  Reference: "ReferenceApplication",
  Books: "BookApplication",
  "Health & Fitness": "HealthApplication",
  Health: "HealthApplication",
  Lifestyle: "LifestyleApplication",
  Productivity: "BusinessApplication",
  Utilities: "UtilitiesApplication",
  Games: "GameApplication",
  Education: "EducationalApplication",
  "Design Tools": "DesignApplication",
};

function loadApps() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(DATA, "utf8"), sandbox, { filename: DATA });
  if (!Array.isArray(sandbox.APPS) || !sandbox.APPS.length) {
    throw new Error("data.js 里没有解析到 APPS");
  }
  return sandbox.APPS;
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function storeBlock(app, pad) {
  const isMac = app.platform === "Mac";
  const badge = isMac ? "assets/img/mac-app-store-badge.svg" : "assets/img/app-store-badge.svg";
  const label = isMac ? "Download on the Mac App Store" : "Download on the App Store";

  if (app.storeState === "coming") {
    return [
      `${pad}<div class="soon-wrap">`,
      `${pad}  <img class="store-badge store-badge-sm store-badge-off" src="${badge}" alt="${label}" width="150" height="44" loading="lazy" />`,
      `${pad}  <span class="soon-tag">Coming soon</span>`,
      `${pad}</div>`,
    ].join("\n");
  }

  return [
    `${pad}<a href="${app.store}" target="_blank" rel="noopener" aria-label="${label} for ${esc(app.name)}">`,
    `${pad}  <img class="store-badge store-badge-sm" src="${badge}" alt="${label}" width="150" height="44" loading="lazy" />`,
    `${pad}</a>`,
  ].join("\n");
}

function card(app, i, featured, basePad) {
  const pad = basePad;
  const p = (n) => pad + "  ".repeat(n);
  const isMac = app.platform === "Mac";

  const chips = [
    `<span class="chip ${isMac ? "chip-platform-mac" : "chip-platform-ios"}">${isMac ? "Mac" : "iOS"}</span>`,
  ];
  if (app.storeState === "coming") chips.push('<span class="chip chip-state">Coming soon</span>');
  if (featured) chips.push(`<span class="chip">${esc(app.category)}</span>`);

  const cls = featured ? "card featured-card" : "card app-card";
  const coming = app.storeState === "coming" ? " card-coming" : "";

  return [
    `${pad}<article class="${cls}${coming}" role="listitem" style="--i:${i}">`,
    `${p(1)}<div class="app-head">`,
    `${p(2)}<div class="app-ico ${featured ? "app-ico-md" : "app-ico-sm"}">`,
    `${p(3)}<img src="${app.icon}" alt="${esc(app.name)} icon" width="128" height="128" loading="lazy" data-initial="${esc(app.name.charAt(0))}" />`,
    `${p(2)}</div>`,
    `${p(2)}<div class="head-meta">`,
    `${p(3)}<h3>${esc(app.name)}</h3>`,
    `${p(3)}<div class="chips">${chips.join("")}</div>`,
    `${p(2)}</div>`,
    `${p(1)}</div>`,
    `${p(1)}<p class="tag">${esc(app.tagline)}</p>`,
    `${p(1)}<p class="desc">${esc(app.description)}</p>`,
    `${p(1)}<div class="actions">`,
    `${p(2)}<a class="btn btn-ghost btn-website" href="${app.website}" target="_blank" rel="noopener">Website ↗</a>`,
    storeBlock(app, p(2)),
    `${p(1)}</div>`,
    `${pad}</article>`,
  ].join("\n");
}

function jsonld(apps) {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        url: `${ORIGIN}/`,
        name: "PhoenixYing",
        description: "Independent iOS and Mac apps by Donghui Li.",
        inLanguage: "en",
        publisher: { "@id": `${ORIGIN}/#person` },
      },
      {
        "@type": "Person",
        "@id": `${ORIGIN}/#person`,
        name: "Donghui Li",
        url: `${ORIGIN}/`,
        email: "lidonghui11911@gmail.com",
        sameAs: [GITHUB],
      },
      {
        "@type": "ItemList",
        "@id": `${ORIGIN}/#apps`,
        name: "PhoenixYing apps",
        itemListOrder: "https://schema.org/ItemListUnordered",
        numberOfItems: apps.length,
        itemListElement: apps.map((app, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "SoftwareApplication",
            "@id": `${ORIGIN}/#${app.id}`,
            name: app.name,
            description: app.tagline,
            applicationCategory: CATEGORY[app.category] || app.category,
            operatingSystem: app.platform === "Mac" ? "macOS" : "iOS",
            url: app.website,
            image: `${ORIGIN}/${app.icon}`,
            downloadUrl: app.store,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
        })),
      },
    ],
  };

  const body = JSON.stringify(graph, null, 2)
    .split("\n")
    .map((line) => (line ? "  " + line : line))
    .join("\n");

  return `  <script type="application/ld+json">\n${body}\n  </script>`;
}

function replaceRegion(html, name, body) {
  const startTag = `<!-- ${name}:start`;
  const endTag = `<!-- ${name}:end -->`;
  const s = html.indexOf(startTag);
  const e = html.indexOf(endTag);
  if (s === -1 || e === -1 || e < s) {
    throw new Error(`index.html 缺少标记：${name}`);
  }
  const head = html.indexOf("-->", s) + 3;
  // 从结束标记所在行的行首开始保留，避免把缩进吃掉
  const lineStart = html.lastIndexOf("\n", e) + 1;
  return html.slice(0, head) + "\n" + body + "\n" + html.slice(lineStart);
}

function main() {
  const apps = loadApps();
  const featured = apps.filter((a) => a.featured);
  let html = fs.readFileSync(INDEX, "utf8");

  html = replaceRegion(
    html,
    "cards:featured",
    featured.map((app) => card(app, apps.indexOf(app), true, "          ")).join("\n")
  );
  html = replaceRegion(
    html,
    "cards:apps",
    apps.map((app, i) => card(app, i, false, "          ")).join("\n")
  );
  html = replaceRegion(html, "jsonld:apps", jsonld(apps));

  fs.writeFileSync(INDEX, html);
  console.log(
    `index.html 已更新：${featured.length} 张精选卡片 + ${apps.length} 张 App 卡片 + ${apps.length} 条 SoftwareApplication 结构化数据`
  );
}

main();
