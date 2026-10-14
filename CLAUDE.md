# web-apps

## Default Stack

Build every app as simply as possible unless the user decides otherwise:

- Plain HTML, JavaScript, and CSS files.
- Store user data in the browser (localStorage, cookies, IndexedDB).
- Keep apps fully client-side: servers and third-party databases are used only when the user explicitly decides on them.

## New App Design Direction

When a new app is requested or designed, settle its visual direction with the user before any implementation starts:

1. **Color palette:** present at least 3 palette options, each shown as rendered swatches with hex values and the role of each color (background, surface, text, accent, etc.). Wait for the user to pick one.
2. **Layout:** present at least 3 distinct layout options as purely visual mockups in the chosen palette. Mockups are static, need no working functionality, and each one includes the logo in its standard bottom-right placement. Wait for the user to pick one.
3. Build the app in the chosen palette and layout.

## Logo

Every page of every app displays the shared logo, fixed to the bottom-right corner. `assets/logo/` holds the master image and its style (`logo.css`).

- Add these two lines to every page, the link in `<head>` and the image first in `<body>`:
  ```html
  <link rel="stylesheet" href="logo/logo.css">
  <img class="app-logo" src="logo/senor_claude.png" alt="">
  ```
- Run `node scripts/sync-logo.mjs` after creating an app or editing anything in `assets/logo/`. It copies the master folder into every `apps/<slug>/logo/`, because the Pages build deploys only each app's own folder.
- An app with a fixed bottom bar sets `--logo-floor` on `:root` to the bar's height (include `env(safe-area-inset-bottom, 0px)` when the bar pads for it), so the logo rests on the bar's top edge and the bar acts as the bottom of the window.
- Change the logo's look only in `assets/logo/`, then sync. CI runs `node scripts/sync-logo.mjs --check` and fails when an app's copy is out of date or a page is missing the two lines.
