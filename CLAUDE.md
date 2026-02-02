# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install    # Install dependencies
npm start      # Run Electron app
npm run build  # Package with electron-builder (Windows target)
```

No test runner, linter, or build step is configured.

## Architecture

Electron desktop app for controlling vMix playlists via the vMix HTTP API.

**File structure:**
- `main.js` — Electron main process: window creation, IPC handlers, vMix API calls, playlist file reading
- `preload.js` — Context bridge exposing `electronAPI.getLists()` and `electronAPI.selectItem()` to the renderer
- `index.html` — Static HTML with dark-themed CSS (settings bar, column layout)
- `renderer.js` — Renderer process JS: builds UI dynamically from playlist data, handles button clicks via IPC

**Playlist discovery:** On each `get-lists` IPC call, `findListFiles()` scans the app directory for files matching `list-*.txt`. Each file contains one media file path per line (Windows paths). The filename stem (e.g. `list-1`) becomes the playlist name used both in the UI and as the vMix input name.

**vMix integration:** `callVmixApi()` in the main process makes HTTP requests to the configured vMix host/port. When a user selects a media item, the `select-item` IPC handler runs three sequential vMix API calls: `SelectIndex` → `ListRemoveAll` → `ListAdd`, replacing the playlist contents with the single selected item.

**IPC channels:**
- `get-lists` — Returns array of `{name, filename, items}` objects
- `select-item` — Receives `{list, item, vmixHost, vmixPort}`, returns `{ok}` or `{ok, error}`

## Key Constants (hardcoded in main.js)

- Default vMix host: `127.0.0.1`
- Default vMix port: `8088`
- API timeout: `5000ms`
