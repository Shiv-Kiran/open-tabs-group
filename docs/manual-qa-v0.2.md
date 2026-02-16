# Mindweave v0.2.0 Manual QA Checklist

Date: 2026-02-16  
Branch: `feat/v0.1-weekend`

## Environment
- OS: Windows
- Browser: Chrome (Developer Mode, unpacked extension from `apps/extension/dist`)

## AI + Grouping
- [ ] Missing API key shows setup prompt.
- [ ] Invalid primary model falls back to fallback model.
- [ ] Fallback status/hint is explicit (model + error code).
- [ ] Same-domain mixed-topic tabs split by intent.
- [ ] AI hard failure still returns heuristic preview.
- [ ] 100+ tabs run without popup/service worker crash.

## Preview UX
- [ ] Preview generation does not mutate groups before apply.
- [ ] Collapse/open remains stable after rename and move actions.
- [ ] Drag/drop between groups works reliably.
- [ ] `Move to...` control works without drag/drop.
- [ ] `Unassign All Groups` leaves tabs unchanged on apply.
- [ ] Compact controls remain usable (including corner `x` close).

## Apply + Revert
- [ ] Apply creates expected native tab groups.
- [ ] Existing grouped tabs can be regrouped.
- [ ] Revert restores selected snapshot best-effort.
- [ ] Revert history remains capped at 3 snapshots.
- [ ] Default apply keeps tabs in original windows.
- [ ] Cross-window setting ON allows cross-window grouping.

## Archive + Undo
- [ ] Tab `x` archives + closes selected tab.
- [ ] Group `Del` archives + closes all tabs in that group.
- [ ] Undo toast appears after close actions.
- [ ] Undo within 10s restores tabs.
- [ ] Undo after expiry fails gracefully without crash.
- [ ] Archive pruning keeps DB bounded (manual high-volume check).

## Build / Package
- [x] `npm run build` passes.
- [x] `npm run package` produces release zip.
- [ ] Full browser-driven checklist completed in live Chrome session.

## Notes
- Browser-interactive checks must be run locally with real tab sets.
