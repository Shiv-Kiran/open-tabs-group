# Mindweave v0.1.1

Chrome extension for AI-assisted tab grouping with safer preview and revert.

## What v0.1.1 Does
- Generates a **preview** of proposed groups before applying.
- Applies groups only when you click **Apply Groups**.
- Lets you edit preview groups before apply:
  - drag/drop tabs across groups
  - rename groups
  - collapse groups
  - delete individual groups
  - delete all preview groups
  - exclude specific tabs from apply
  - close tabs directly from preview
- Uses enriched AI context:
  - title + domain + full URL
  - optional lightweight page context (description/headings/snippet)
- Uses fallback local heuristics if AI is unavailable.
- Stores revert snapshots and supports restoring the last 3 organize runs.

## Current Scope (v0.1.1)
- In scope:
  - Preview-first organize flow
  - Revert menu (last 3 snapshots)
  - Options page for API key/model/settings/context toggles
  - AI grouping + targeted enrichment + heuristic fallback
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
   - `Include full URL` (recommended ON)
   - `Include lightweight page context` (recommended ON)
   - `Organize scope` (`All windows` or `Current window only`)
   - `Allow moving tabs across windows` (default OFF)

## Usage
1. Open popup.
2. Click `Generate Preview`.
3. Review group cards (name, count, sample tabs, rationale).
4. Choose:
   - `Apply Groups`
   - `Regenerate`
   - `Cancel`
5. Optional edits before apply:
   - Drag tabs between groups or to `Excluded`
   - Rename group names inline
   - Delete group or clear all preview groups
   - Close individual tabs
5. If needed, use Revert section to restore a previous run.

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
- `apps/extension/release/mindweave-v0.1.1.zip`

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
- Revert is best-effort for currently open tabs in snapshot scope.
- Page context enrichment requires optional site permission grant.
- No server-side sync/backups in v0.1.1.
- Manual QA in Chrome is required before store submission.
- If AI fails (for example invalid key/rate limits/network), preview runs in fallback mode and shows the error code in the hint text.
