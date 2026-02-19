# Mindweave v0.2.0

Chrome extension for AI-assisted tab grouping with preview editing, revert history, and archive-first destructive actions.

## What v0.2.0 Ships
- Preview-first organize flow:
  - `Generate Preview` -> review/edit -> `Apply Groups`
- Stronger grouping quality:
  - richer tab context (title/domain/path hints/page context)
  - stricter same-domain split behavior
  - post-processing guardrails
- Model cascade:
  - primary model (default `gpt-4.1`)
  - fallback model (default `gpt-4o-mini`) when primary fails
- Preview editor improvements:
  - drag/drop tab movement
  - `Move to...` fallback control per tab
  - stable collapse/open behavior
  - compact controls with corner `x` tab close
- Safety and recovery:
  - revert snapshots (last 3 apply runs)
  - destructive actions archive locally in IndexedDB
  - 10-second undo for latest close batch

## Scope
- In scope:
  - AI grouping + local heuristic fallback
  - preview editing + apply + revert
  - local archive DB for destructive preview actions
- Out of scope:
  - cloud sync/backend
  - archive browser UI
  - reminders/focus mode/monthly reports

## Requirements
- Node.js 18+
- Chrome with MV3 support
- OpenAI API key

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build:
   ```bash
   npm run build
   ```
3. Load unpacked extension:
   - open `chrome://extensions`
   - enable `Developer mode`
   - click `Load unpacked`
   - select `apps/extension/dist`
4. Open extension `Settings` and save:
   - `OpenAI API Key`
   - `Model` (default `gpt-4.1`)
   - `Fallback model` (default `gpt-4o-mini`)
   - `Include full URL` (optional)
   - `Include lightweight page context` (recommended ON)
   - `Organize scope` (`All windows` or `Current window only`)
   - `Allow moving tabs across windows` (default OFF)

## Daily Usage
1. Click `Generate Preview`.
2. Adjust groups:
   - rename groups
   - drag/drop or `Move to...`
   - fold/open groups
3. For destructive edits in preview:
   - tab corner `x` -> archive + close tab
   - `Del` on group -> archive + close group tabs
   - undo toast available for 10 seconds
4. Click `Apply Groups` to commit grouping.
5. Use `Revert` section to restore one of the last 3 apply snapshots.

## Commands
- Build:
  ```bash
  npm run build
  ```
- Package:
  ```bash
  npm run package
  ```

Release zip:
- `apps/extension/release/mindweave-v0.2.0.zip`

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
  manual-qa-v0.2.md
```

## Known Limits
- Undo restores from the latest close batch only and expires after 10 seconds.
- Revert snapshots are best-effort for tabs that are still open.
- Archive data is local-only (IndexedDB), no cloud backup.
- Page-context enrichment requires optional site permission.
- If AI fails fully, local heuristic fallback still runs and returns a preview.
