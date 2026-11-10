# iWuji

[简体中文](./README.md) · **English**

> A zero-dependency, purely front-end **web-based mobile OS (WujiOS)** and **web-based desktop OS (ZhuziOS)**. Just open it in a browser: a realistic phone shell, home screen, Notification & Control Center, themes, file manager, app store, and 40+ mini apps. You can also build and install your own apps with **iWuji Studio**.

Written in plain **HTML / CSS / JavaScript** — no build step, no `node_modules`, no framework. Every app is an ordinary `.js` file registered via `WujiApps.register({...})`.



## Live Demo

- iWuji (web phone / iWuji OS): <https://zhuziexe.github.io/iwuji/>
- ZhuziOS (web desktop OS): <https://zhuziexe.github.io/iwuji/zhuzios.html>

🎈 Just click the links above to try it online.



## Run Locally

> ⚠️ **Do NOT just double-click `index.html` (the `file://` protocol).**
> The app store manifest (`store/apps.json`), store product data, meal data, and app source code during installation are all loaded via `fetch()`. The `file://` protocol is blocked by browser CORS policy, leaving the store empty and apps uninstallable. 
Use any local HTTP server instead:

```bash
# Python
python -m http.server 8080

# or Node.js
npx serve .
```

Then open <http://localhost:8080/> in your browser.

> Some features need browser permissions or a secure context: geolocation, camera/microphone, battery, and real map tiles require **HTTPS or localhost** and will prompt for permission on first use. Unsupported browsers automatically fall back to simulated data.



## Entry Points

| File | Purpose |
| --- | --- |
| `index.html` | **iWuji phone simulator** — the phone shell (frame, side buttons, fullscreen) that loads the OS in an iframe; this is the normal entry point |
| `wujios.html` | WujiOS core system — do not open directly |
| `zhuzios.html` | **ZhuziOS desktop simulator** — the normal desktop entry point |
| `phone.html` | Standalone phone page |
| `studio.html` | **iWuji Studio** — visually write / package your own apps |



## What's Inside

**System-level**: home screen with pages, draggable icons, Notification Center, Control Center (brightness / volume / always-on, etc.), light & dark themes, file system, backup & restore, app installer & store, real battery level in the status bar, and Developer Options (tap the version number 7 times).

**Built-in apps**: Calculator, Camera, Clock, File Preview, Files, Phone, Photos, Settings, Task Manager, Themes, Weather, Gallery.

**Store apps**: Milk Map, Metro Map / Drive the Metro, Wuji MC, Notes, Music, Radio, Wuji Bilibili, AI News, Encyclopedia, Stocks, What to Eat Today, and more.

> Download **Wuji Chick** from the App Store and raise one of your own:

<p>
  <img src="./assets/chick/chick.svg"      width="128" alt="Idle chick">
  <img src="./assets/chick/phonechick.svg" width="128" alt="Chick playing phone">
  <img src="./assets/chick/bathchick.svg"  width="128" alt="Chick in bath">
</p>



## Build an App with Studio

Open `studio.html`, fill in the app info, write your HTML/CSS/JS, then export and install it into the system. An app is essentially a JS file that calls `WujiApps.register()`:

```js
WujiApps.register({
  bundlename: 'com.example.helloworld',
  name: 'Hello World',
  icon: './assets/app.svg',
  initialRoute: 'main',
  styles: `.hello { padding: 40px; }`,
  routes: {
    main: {
      name: 'main',
      render() {
        return `<div class="hello"><h1>Hello, iWuji!</h1></div>`;
      }
    }
  }
});
```

- Put apps in `store-apps/` and register them in `store/apps.json` with `bundle / name / icon / version / author / description / src`;
- Icons go in `assets/`, themes in `themes/`.



## Directory Layout

```
.
├── index.html            # Phone shell + iframe entry
├── wujios.html           # WujiOS core system
├── niubeeos.html         # Alternate OS skin
├── zhuzios.html
├── phone.html            # Standalone phone
├── studio.html           # iWuji Studio
├── core.js               # App registry + system-level storage
├── app-loader.js / installer.js / app-storage.js / app-code-store.js
├── builtin-apps.js       # Built-in app manifest
├── control-center.js / notification.js / panelsystem.js / overlay.js
├── theme.js / desktop-layout.js / navigation.js / device-compat.js
├── fs.js / fs-worker.js / backup.js / file-opener.js / dialog.js / toast.js
├── manual.js             # User manual
├── apps/                 # Built-in apps
├── store-apps/           # Store apps (30+)
├── store/apps.json       # App store manifest
├── assets/               # Icons and images
├── styles/               # System styles (os.css / tokens.css, etc.)
├── themes/               # Themes
├── scripts/              # Helper scripts (daily store stock refresh)
└── .github/workflows/    # GitHub Actions scheduled tasks
```



## Compatibility

Targets modern Chromium / Firefox / Safari. Latest desktop Chrome / Edge or a mobile browser is recommended. `getBattery`, `wakeLock`, and similar APIs fall back to simulated values when unavailable; camera and geolocation features require user permission.



## Notes

This is a hobby / toy project for tinkering with front-end and "OS-like" interactions. It is **not** a real operating system and is not intended for production. Weather, news, map, and other data come from third-party public services, so availability depends on those services.

Issues and PRs are welcome — especially new mini apps 😄
