# Mindweave v0.1.1 Manual QA Checklist

Date: 2026-02-15
Branch: `feat/v0.1-weekend`

## Environment
- OS: Windows
- Browser: Chrome (Developer Mode, unpacked extension from `apps/extension/dist`)

## Checklist
- [ ] Missing API key shows actionable setup prompt in popup.
- [ ] Generate Preview does not mutate tab groups before apply.
- [ ] Apply Groups mutates tabs only after preview review.
- [ ] Pinned tabs are included in grouping.
- [ ] Optional site permission denied path still returns preview.
- [ ] Optional site permission granted path enriches ambiguous tabs.
- [ ] Drag/drop tabs between groups works before apply.
- [ ] Drag/drop to Excluded keeps tabs unchanged on apply.
- [ ] Rename group name is reflected in applied group title.
- [ ] Delete single group removes it from apply.
- [ ] Delete all preview groups results in no-op apply.
- [ ] Close tab action removes tab and refreshes preview.
- [ ] 100+ tab run completes without extension crash.
- [ ] AI timeout triggers fallback and still generates preview.
- [ ] Invalid AI JSON triggers fallback gracefully.
- [ ] Existing grouped tabs can be regrouped without failures after apply.
- [ ] Duplicate titles/URLs do not create empty groups.
- [ ] Popup state transitions are clear (idle/loading/success/error).
- [ ] Last run summary persists after popup/browser reopen.
- [ ] Revert Selected restores latest snapshot.
- [ ] Revert history keeps max 3 snapshots.
- [ ] Default behavior keeps tabs in original windows when applying groups.
- [ ] Enabling cross-window move option allows mixed-window group apply behavior.

## What Was Executed in This Session
- [x] `npm run build` passes for extension bundle.
- [x] `npm run package` creates release zip.
- [ ] Full browser-driven manual checklist (run by user in Chrome).

## Notes
- Browser-interactive checks require local Chrome session with real tab data.
