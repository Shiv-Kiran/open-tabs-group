# Mindweave v0.1 Tasks

## Stage 0 - Bootstrap
- [ ] Create `apps/extension` folder structure
- [ ] Add Vite config and package scripts
- [ ] Add MV3 `manifest.json`
- [ ] Add popup shell (`html/js/css`)
- [ ] Add options shell (`html/js/css`)
- [ ] Verify extension loads unpacked
- [ ] Commit: `chore(repo): scaffold apps/extension with vite`
- [ ] Commit: `chore(extension): add mv3 manifest and base pages`
- [ ] Tag: `v0.1-stage-0`

## Stage 1 - Core Organize
- [ ] Implement all-window tab collection + normalization
- [ ] Implement OpenAI client and response parsing
- [ ] Implement group applier (tabGroups API)
- [ ] Wire popup action to background runtime message
- [ ] Persist `runs.lastSummary`
- [ ] Commit: `feat(tabs): collect and normalize tabs across windows`
- [ ] Commit: `feat(ai): add openai grouping client and response validator`
- [ ] Commit: `feat(groups): apply native chrome tab groups`
- [ ] Commit: `feat(popup): wire organize action and success summary`
- [ ] Tag: `v0.1-stage-1`

## Stage 2 - Reliability
- [ ] Add timeout and 1 retry for AI calls
- [ ] Add heuristic fallback (domain + title keywords)
- [ ] Add malformed/empty response guards
- [ ] Ensure fallback sets `usedFallback=true`
- [ ] Commit: `feat(reliability): add retry timeout policy for ai requests`
- [ ] Commit: `feat(fallback): add heuristic grouping fallback`
- [ ] Commit: `fix(validation): harden malformed ai output handling`
- [ ] Tag: `v0.1-stage-2`

## Stage 3 - Settings + UX
- [ ] Build options settings save/load flow
- [ ] Add missing key state with options shortcut
- [ ] Add loading/success/error popup states
- [ ] Apply minimal warm UI styling
- [ ] Commit: `feat(settings): add options page for api key and model`
- [ ] Commit: `feat(ux): add loading and error states in popup`
- [ ] Commit: `style(ui): add minimal warm theme`
- [ ] Tag: `v0.1-stage-3`

## Stage 4 - QA + Release
- [ ] Run manual QA checklist
- [ ] Fix critical issues
- [ ] Build production bundle
- [ ] Create zip for store draft
- [ ] Update root `README.md`
- [ ] Commit: `test(manual): execute v0.1 qa checklist and document results`
- [ ] Commit: `fix(v0.1): resolve qa defects`
- [ ] Commit: `chore(release): add packaged build and setup docs`
- [ ] Tag: `v0.1-stage-4`
- [ ] Tag: `v0.1.0-weekend`
