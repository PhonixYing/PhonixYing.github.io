# PhoenixYing — Apps for iOS & macOS

The official showcase site for the apps by Donghui Li, hosted on GitHub Pages at **https://phonixying.github.io/**.

A single-page, dependency-free static site (HTML + CSS + vanilla JS) that highlights the developer's iOS and macOS apps — with icons, short descriptions, links to each product's official website, and App Store / Mac App Store download buttons.

## Project structure

```
.
├── index.html            # Single-page site (nav / hero / featured / all-apps / footer)
├── README.md
└── assets
    ├── css/style.css      # Design system (dark neon-gradient + glassmorphism)
    ├── js/data.js         # App catalogue (APPS array) — edit here to add/update apps
    ├── js/main.js         # Rendering, reveal animations, icon fallback
    ├── icons/             # App icons (downloaded from App Store / official sites)
    ├── img/               # Store badges + OG social image
    └── favicon.svg        # Brand favicon
```

## Managing the apps

All product data lives in `assets/js/data.js` in the `APPS` array. To add or edit an app:

1. Drop its icon into `assets/icons/` (PNG/SVG).
2. Add a record to `APPS` with the fields below.
3. Commit and push — GitHub Pages rebuilds automatically.

```js
{
  id: "my-app",                     // unique slug
  name: "My App",                   // display name
  tagline: "One-line elevator pitch",
  description: "A few sentences describing the app.",
  category: "Productivity",         // Books / Games / Health / etc.
  platform: "iOS",                  // "iOS" or "Mac"
  website: "https://phonixying.github.io/MyApp/",
  store: "https://apps.apple.com/app/id1234567890", // use null if not yet listed
  storeState: "live",               // "live" or "coming"
  icon: "assets/icons/my-app.png",
  featured: false                   // true to spotlight in the Featured section
}
```

## Deploying to GitHub Pages

The site is served from the repository root and publishes automatically.

1. Push the `master` branch to GitHub:

   ```bash
   git add index.html README.md assets
   git commit -m "feat: developer apps showcase site"
   git push origin master
   ```

2. If Pages isn't already enabled, in the repo go to
   **Settings → Pages → Build and deployment → Source** and choose
   **Deploy from a branch** → Branch `master` / root (or follow the default).
3. The site will be live at **https://phonixying.github.io/**.

No `CNAME` is needed because the repository name is already the GitHub Pages domain.

## Local development

The site uses no build step. Open `index.html` directly, or serve it locally:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

> Serving over `http://` is recommended so the IntersectionObserver and scroll effects behave as on the live site.

## Privacy

This is a fully static site: no analytics, no tracking, no external requests except for loading the Montserrat font from Google Fonts. All product data points directly to Apple's official store listings and the apps' own websites.
