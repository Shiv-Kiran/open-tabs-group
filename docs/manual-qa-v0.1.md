# Mindweave v0.1 Manual QA Checklist

Date: 2026-02-15
Branch: `feat/v0.1-weekend`

## Environment
- OS: Windows
- Browser: Chrome (Developer Mode, unpacked extension from `apps/extension/dist`)

## Checklist
- [ ] Missing API key shows actionable setup prompt in popup.
- [ ] Organize groups tabs across multiple windows.
- [ ] Pinned tabs are included in grouping.
- [ ] 100+ tab run completes without extension crash.
- [ ] AI timeout triggers fallback and still groups tabs.
- [ ] Invalid AI JSON triggers fallback gracefully.
- [ ] Existing grouped tabs can be regrouped without failures.
- [ ] Duplicate titles/URLs do not create empty groups.
- [ ] Popup state transitions are clear (idle/loading/success/error).
- [ ] Last run summary persists after popup/browser reopen.

## What Was Executed in This Session
- [x] `npm run build` passes for extension bundle.
- [x] `npm run package` creates release zip.
- [ ] Full browser-driven manual checklist (run by user in Chrome).

## Notes
- Browser-interactive checks require local Chrome session with real tab data.
