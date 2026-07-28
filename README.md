# Push-Up Tracker

A local-first, offline-capable Progressive Web App for tracking a daily push-up goal. No account, server, or dependencies are required.

## Run locally

Serve this folder with any static web server (service workers do not run from `file://`). For example: `python3 -m http.server 8080`, then visit `http://localhost:8080`.

## Deploy to GitHub Pages

1. Push the contents of this folder to a GitHub repository.
2. In GitHub, open **Settings → Pages** and choose the deployment branch/folder.
3. Open the Pages URL once while online; the app shell then works offline and can be added to an iPhone Home Screen from Safari's Share menu.

All assets use relative paths, so the project works at either a repository root or GitHub Pages project URL.

## Push reminders

Push reminders work on iPhone/iPad Home Screen web apps running iOS/iPadOS 16.4 or later. GitHub Pages serves the app but cannot deliver scheduled push messages; deploy the included `notifications-worker` once, then connect its URL in the app's Settings page. See `notifications-worker/README.md` for the complete setup.
