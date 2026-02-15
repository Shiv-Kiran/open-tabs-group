# Mindweave v0.1

Weekend Chrome extension for one-click tab grouping.

## What v0.1 Does
- Organizes tabs across all windows (including pinned tabs).
- Uses one OpenAI call (BYOK) to generate tab groups.
- Falls back to local heuristic grouping if AI fails.
- Applies native Chrome Tab Groups with names and colors.
- Stores last run summary in extension local storage.

## Current Scope (v0.1)
- In scope:
  - Popup with `Organize Now`
  - Options page for API key/model/settings
  - AI grouping + retry/timeout + heuristic fallback
  - Build + package zip for release draft
- Out of scope:
  - Focus mode
  - Reminder scheduler/email/monthly reports
  - Archive memories
  - Decision fatigue mode
  - Backend sync

## Requirements
- Node.js 18+
- Chrome browser (MV3 support)
- OpenAI API key

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build extension:
   ```bash
   npm run build
   ```
3. Load unpacked extension:
   - Open `chrome://extensions`
   - Enable `Developer mode`
   - Click `Load unpacked`
   - Select `apps/extension/dist`
4. Open extension options and save:
   - `OpenAI API Key`
   - `Model` (default: `gpt-4o-mini`)
   - `Include full URL` (optional)

## Usage
1. Open popup.
2. Click `Organize Now`.
3. Wait for status:
   - `Done. Tabs organized.` (AI path)
   - `Done with fallback grouping.` (heuristic path)

## Commands
- Build:
  ```bash
  npm run build
  ```
- Package zip:
  ```bash
  npm run package
  ```

Packaged artifact is created at:
- `apps/extension/release/mindweave-v0.1.0.zip`

## Project Structure
```text
apps/extension/
  public/manifest.json
  src/background/service-worker.js
  src/popup/popup.js
  src/options/options.js
  src/lib/*
  scripts/package.ps1
docs/
  manual-qa-v0.1.md
```

## Known Limits
- Group quality depends on tab title/domain quality.
- No tab content scraping in v0.1.
- No server-side sync/backups in v0.1.
- Manual QA in Chrome is required before store submission.
