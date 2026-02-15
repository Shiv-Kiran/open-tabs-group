# Mindweave v0.1 Implementation Plan (`IMPLEMENTATION_PLAN.md`)

## Summary
Ship a weekend `v0.1` Chrome extension that is immediately useful for you:
1. Click `Organize Now`.
2. Group tabs across all windows (including pinned).
3. Apply native Chrome tab groups with names/colors.
4. Use OpenAI BYOK direct call with heuristic fallback if AI fails.

This plan is optimized for frequent commits, safe rollback, and professional traceability.

## Public Interfaces / Contracts
1. Runtime messages
- `ORGANIZE_NOW`
- `GET_LAST_RUN`

2. Storage keys
- `settings.openaiApiKey: string`
- `settings.model: string` (default cost-balanced mini model)
- `settings.includeFullUrl: boolean` (default `false`)
- `runs.lastSummary: { groupedTabs: number, groupsCreated: number, usedFallback: boolean, ranAt: number }`

3. Core function contracts
- `groupTabsWithAI(tabs, settings) => Promise<GroupSuggestion[]>`
- `groupTabsHeuristic(tabs) => GroupSuggestion[]`
- `applyTabGroups(tabs, suggestions) => Promise<ApplySummary>`

4. Type contracts
- `GroupSuggestion: { name: string, tabIndices: number[], confidence?: number }`
- `ApplySummary: { groupedTabs: number, groupsCreated: number, skippedTabs: number }`

## Stage Plan With Tasks

## Stage 0: Repo and Build Bootstrap (2-3 hours)
- [ ] Create monorepo folders: `apps/extension`
- [ ] Add Vite config and package scripts
- [ ] Add MV3 `manifest.json` with required permissions
- [ ] Add popup and options shell pages
- [ ] Verify extension loads unpacked in Chrome

Commits for this stage:
1. `chore(repo): scaffold apps/extension with vite`
2. `chore(extension): add mv3 manifest and base pages`

Checkpoint tag:
- `v0.1-stage-0`

Definition of done:
- Extension loads, popup opens, options route works.

## Stage 1: Core Organize Pipeline (5-7 hours)
- [ ] Implement tab collection for all windows
- [ ] Normalize tab data (`title`, `domain`, optional `url`)
- [ ] Implement OpenAI client with JSON-only response parsing
- [ ] Implement tab-group applier via `chrome.tabs.group` and `chrome.tabGroups.update`
- [ ] Wire popup `Organize Now` to background action
- [ ] Persist last run summary in storage

Commits for this stage:
1. `feat(tabs): collect and normalize tabs across windows`
2. `feat(ai): add openai grouping client and response validator`
3. `feat(groups): apply native chrome tab groups`
4. `feat(popup): wire organize action and success summary`

Checkpoint tag:
- `v0.1-stage-1`

Definition of done:
- One click creates real tab groups from AI output.

## Stage 2: Reliability and Fallback (4-6 hours)
- [ ] Add timeout + retry policy (1 retry) for AI call
- [ ] Add heuristic fallback (domain + keyword clustering) after failed retry
- [ ] Add defensive guards for empty/invalid suggestions
- [ ] Ensure fallback path sets `usedFallback=true` in summary

Commits for this stage:
1. `feat(reliability): add retry timeout policy for ai requests`
2. `feat(fallback): add heuristic grouping fallback`
3. `fix(validation): harden malformed ai output handling`

Checkpoint tag:
- `v0.1-stage-2`

Definition of done:
- Organize always completes with either AI or fallback.

## Stage 3: Settings and UX Finishing (3-4 hours)
- [ ] Build options page for API key/model/toggle settings
- [ ] Add "missing key" UX state in popup with options shortcut
- [ ] Add loading and error states in popup
- [ ] Apply minimal warm functional styling

Commits for this stage:
1. `feat(settings): add options page for api key and model`
2. `feat(ux): add loading and error states in popup`
3. `style(ui): add minimal warm theme`

Checkpoint tag:
- `v0.1-stage-3`

Definition of done:
- Setup is clear, status feedback is clear, UI is usable daily.

## Stage 4: QA, Packaging, and Release Prep (4-5 hours)
- [ ] Run manual QA suite (see section below)
- [ ] Fix critical defects found in QA
- [ ] Build production extension package
- [ ] Create zip for store draft submission
- [ ] Update root `README.md` with setup and known limits

Commits for this stage:
1. `test(manual): execute v0.1 qa checklist and document results`
2. `fix(v0.1): resolve qa defects`
3. `chore(release): add packaged build and setup docs`

Checkpoint tag:
- `v0.1-stage-4`
- final tag: `v0.1.0-weekend`

Definition of done:
- Local unpacked use is stable and store draft artifact is ready.

## Git Discipline and Revert Strategy
1. Work on branch: `feat/v0.1-weekend`.
2. Commit every 45-90 minutes or at each completed task cluster.
3. Keep commits atomic and single-purpose.
4. Use conventional messages (`feat`, `fix`, `chore`, `test`, `style`).
5. Tag every stage checkpoint as above.
6. Revert safely with `git revert <commit>` or rollback to checkpoint tags if needed.

## Manual Test Cases and Scenarios
1. Missing API key shows actionable setup prompt.
2. Organize groups tabs across multiple windows.
3. Pinned tabs are included and grouped.
4. 100+ tab run completes without extension crash.
5. AI timeout triggers fallback and still groups tabs.
6. Invalid AI JSON triggers fallback gracefully.
7. Existing pre-grouped tabs do not break regroup flow.
8. Duplicate titles/URLs do not create empty groups.
9. Popup states transition correctly: idle -> loading -> success/error.
10. Last run summary persists after browser restart.

## Assumptions and Defaults
1. v0.1 has no backend.
2. English-only copy.
3. No reminders/focus/archive in this weekend scope.
4. Default payload is `title + domain`; full URL is optional.
5. First implementation step in execution mode: create root file `IMPLEMENTATION_PLAN.md` with this exact plan.
