/* PhoenixYing — rendering & interactions */

(function () {
  "use strict";

  var ICON_FALLBACK = 'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#7C5CFF"/><stop offset="0.55" stop-color="#22D3EE"/>' +
      '<stop offset="1" stop-color="#F472B6"/></linearGradient></defs>' +
      '<rect width="256" height="256" fill="url(#g)"/>' +
      '<text x="128" y="164" font-family="Arial, sans-serif" font-size="120" ' +
      'font-weight="700" fill="#ffffff" text-anchor="middle">{L}</text></svg>'
    );

  function fallbackIcon(img) {
    var letter = (img.getAttribute("data-initial") || "P").charAt(0).toUpperCase();
    img.onerror = null;
    img.src = ICON_FALLBACK.replace("{L}", encodeURIComponent(letter));
  }

  function iconFor(app, size, alt) {
    var img = document.createElement("img");
    img.src = app.icon;
    img.alt = alt || app.name + " icon";
    img.width = 128;
    img.height = 128;
    img.loading = "lazy";
    img.setAttribute("data-initial", app.name.charAt(0));
    img.addEventListener("error", function () { fallbackIcon(img); });
    img.addEventListener("load", function () { img.removeAttribute("loading"); });
    return img;
  }

  function platformChip(app) {
    var isMac = app.platform === "Mac";
    return '<span class="chip ' + (isMac ? "chip-platform-mac" : "chip-platform-ios") + '">' +
      (isMac ? "Mac" : "iOS") + "</span>";
  }

  function categoryChip(app) {
    return '<span class="chip">' + escapeHtml(app.category) + "</span>";
  }

  function stateChip(app) {
    return app.storeState === "coming"
      ? '<span class="chip chip-state">Coming soon</span>'
      : "";
  }

  function storeBlock(app) {
    var isMac = app.platform === "Mac";
    var badge = isMac
      ? "assets/img/mac-app-store-badge.svg"
      : "assets/img/app-store-badge.svg";
    var label = isMac
      ? "Download on the Mac App Store"
      : "Download on the App Store";

    if (app.storeState === "coming") {
      return (
        '<div class="soon-wrap">' +
        '<img class="store-badge store-badge-sm store-badge-off" src="' + badge +
        '" alt="' + label + '" width="150" height="44" loading="lazy" />' +
        '<span class="soon-tag">Coming soon</span>' +
        "</div>"
      );
    }
    return (
      '<a href="' + app.store + '" target="_blank" rel="noopener" aria-label="' +
      label + " for " + escapeHtml(app.name) + '">' +
      '<img class="store-badge store-badge-sm" src="' + badge + '" alt="' + label +
      '" width="150" height="44" loading="lazy" /></a>'
    );
  }

  function actions(app) {
    return (
      '<div class="actions">' +
      '<a class="btn btn-ghost btn-website" href="' + app.website +
      '" target="_blank" rel="noopener">Website ↗</a>' +
      storeBlock(app) +
      "</div>"
    );
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function cardMarkup(app, i, featured) {
    var ico = document.createElement("div");
    ico.className = "app-ico" + (featured ? " app-ico-md" : " app-ico-sm");
    ico.appendChild(iconFor(app, 84, null));

    var meta = document.createElement("div");
    meta.className = "head-meta";
    var nameEl = document.createElement("h3");
    nameEl.textContent = app.name;
    var chips = document.createElement("div");
    chips.className = "chips";
    chips.innerHTML = platformChip(app) + stateChip(app);
    if (featured) chips.insertAdjacentHTML("beforeend", categoryChip(app));
    meta.appendChild(nameEl);
    meta.appendChild(chips);

    var head = document.createElement("div");
    head.className = "app-head";
    head.appendChild(ico);
    head.appendChild(meta);

    var tag = document.createElement("p");
    tag.className = "tag";
    tag.textContent = app.tagline;

    var desc = document.createElement("p");
    desc.className = "desc";
    desc.textContent = app.description;

    var card = document.createElement("article");
    card.className = featured ? "card featured-card" : "card app-card";
    if (app.storeState === "coming") card.classList.add("card-coming");
    card.setAttribute("role", "listitem");
    card.style.setProperty("--i", String(i));
    card.appendChild(head);
    card.appendChild(tag);
    card.appendChild(desc);
    var footer = document.createElement("div");
    footer.innerHTML = actions(app);
    card.appendChild(footer);
    return card;
  }

  function mount() {
    var featuredWrap = document.getElementById("featuredGrid");
    var appWrap = document.getElementById("appGrid");
    if (featuredWrap && appWrap) {
      APPS.forEach(function (app, i) {
        if (app.featured) featuredWrap.appendChild(cardMarkup(app, i, true));
      });
      APPS.forEach(function (app, i) {
        appWrap.appendChild(cardMarkup(app, i, false));
      });
    }
  }

  /* Reveal on scroll */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    items.forEach(function (el) { io.observe(el); });
  }

  /* Nav background on scroll */
  function initNav() {
    var nav = document.getElementById("siteNav");
    function onScroll() {
      nav.classList.toggle("scrolled", (window.scrollY || 0) > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Auto year */
  document.getElementById("year").textContent = new Date().getFullYear();

  mount();
  initReveal();
  initNav();
})();
