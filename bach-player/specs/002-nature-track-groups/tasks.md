---

description: "Task list template for feature implementation"
---

# Tasks: Nature Sound Groups Toggle

**Input**: Design documents from `/specs/002-nature-track-groups/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md, quickstart.md (all present). Depends on `specs/001-nature-sounds-mixer` already being implemented.

**Tests**: Not requested — this project has no automated test suite (Constitution "Development Workflow"); validation is manual via `quickstart.md`. No test tasks are generated.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path in this repo's flat extension layout (no `src/`)

---

## Phase 1: Setup

**Purpose**: Confirm the existing data this feature builds on before adding group logic on top of it.

- [X] T001 In `offscreen.js`, verify the existing `NATURE_TRACKS` ids are exactly `rain`, `birds`, `wind`, `thunder`, `ocean` — the same ids `data-model.md`'s `NATURE_GROUPS.trackIds` will reference — so no group ends up pointing at a nonexistent track id.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core group data, state, and the shared effective-volume computation that every user story (US1, US2, US3) depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 In `offscreen.js`, add the `NATURE_GROUPS` constant per `data-model.md`: `[{id:'forest', label:'Forest', trackIds:['rain','birds','wind']}, {id:'storm', label:'Storm', trackIds:['thunder','ocean']}]`.
- [X] T003 In `offscreen.js`, add in-memory state `let activeGroup = 'forest';` (data-model.md default).
- [X] T004 In `offscreen.js`, add an `applyNatureVolumes()` helper that, for every track in `NATURE_TRACKS`, computes `effectiveVolume = (natureVolumes[id] / 100) * (id is in the active group's trackIds ? 1 : 0)` (data-model.md's Effective Volume formula) and sets `natureAudioElements[id].volume = effectiveVolume` (skip tracks with no element yet). Depends on T002, T003.
- [X] T005 In `offscreen.js`'s `initNatureAudio()`, replace the direct `el.volume = (natureVolumes[track.id] ?? 100) / 100` assignment with a call to `applyNatureVolumes()` after all elements are created, so initial playback already respects the default active group. Depends on T004.
- [X] T006 In `offscreen.js`'s `natureSetVolume(trackId, value)`, replace the direct `el.volume = clamped / 100` assignment with a call to `applyNatureVolumes()` after updating `natureVolumes[trackId]`, so a slider move is filtered through whichever group is currently active. Depends on T004.
- [X] T007 In `offscreen.js`, change `natureLoadState(isPlaying, volumes)` to `natureLoadState(isPlaying, volumes, activeGroupArg)`: set the in-memory `activeGroup` to `activeGroupArg` if it matches a `NATURE_GROUPS` id, otherwise default it to `'forest'` (data-model.md validation rule, research.md D5); call `applyNatureVolumes()` after restoring `natureVolumes` and `activeGroup`. Also update the `natureLoadState` branch in the `chrome.runtime.onMessage` listener to pass `msg.activeGroup` as the third argument. Depends on T002, T004.
- [X] T008 In `offscreen.js`'s `getState()`, add `natureActiveGroup: activeGroup` to the returned object (contracts/messages.md). Depends on T003.
- [X] T009 [P] In `popup.html`, add a 2-button segmented control inside `natureSoundsPanel` — `natureGroupForestBtn` labeled "Forest" and `natureGroupStormBtn` labeled "Storm" — styled consistently with the existing panel buttons (plan.md, research.md D4).

**Checkpoint**: Group data and the effective-volume mechanism exist in `offscreen.js`; the UI shell has both group buttons rendered, but nothing can switch groups yet. Foundation ready for user stories.

---

## Phase 3: User Story 1 - Switch the ambient mood with one action (Priority: P1) 🎯 MVP

**Goal**: A single group toggle switches which of the two groups is audible, muting the other, with the active group always visibly indicated.

**Independent Test**: With the mix playing at default per-track volumes, click the inactive group's button — that group's tracks become audible and the previously active group's tracks go silent, instantly and with the correct button now highlighted. Per `quickstart.md` Scenario 1.

### Implementation for User Story 1

- [X] T010 [US1] In `offscreen.js`, implement `natureGroupToggle()`: flip `activeGroup` between `'forest'` and `'storm'`, call `applyNatureVolumes()`, then call `broadcastState()` (FR-002, FR-003, FR-004, FR-005).
- [X] T011 [US1] In `offscreen.js`'s `chrome.runtime.onMessage` listener, add the `msg.type === 'natureGroupToggle'` branch calling `natureGroupToggle()` (contracts/messages.md).
- [X] T012 [US1] In `popup.js`, add a module-level `let natureActiveGroup = 'forest';` variable, and in `applyState()`, when `state.natureActiveGroup !== undefined`: update this variable and toggle highlighted styling between `natureGroupForestBtn`/`natureGroupStormBtn` (active = same gold styling already used for `natureToggleBtn` when playing; inactive = dimmed) so the active group is always visibly indicated (FR-007).
- [X] T013 [US1] In `popup.js`, add click listeners: `natureGroupForestBtn` sends `{ type: 'natureGroupToggle' }` only when `natureActiveGroup !== 'forest'`; `natureGroupStormBtn` sends it only when `natureActiveGroup !== 'storm'` — so clicking the already-active button is a no-op instead of flipping away (contracts/messages.md's stateless toggle message combined with FR-004's "exactly one active" guarantee).

**Checkpoint**: User Story 1 is fully functional and independently testable — pressing either group button switches audible groups instantly with correct visual feedback.

---

## Phase 4: User Story 2 - Per-track balance survives a group switch (Priority: P2)

**Goal**: Muting/reactivating a group never alters any track's stored volume-slider position.

**Independent Test**: With Group 1 active, set a non-default volume on one of its tracks, switch to Group 2 and back, and confirm the volume is exactly as left. Also confirm adjusting a muted group's slider updates the slider (and takes effect silently) without needing to be re-set once reactivated. Per `quickstart.md` Scenario 2.

### Implementation for User Story 2

- [X] T014 [US2] In `offscreen.js`, add a comment directly above `natureSetVolume()` documenting the invariant that it MUST only ever read/write `natureVolumes[trackId]` and MUST NOT read or write `activeGroup` — so muting and reactivating a group can never lose or reset a slider's position (FR-006). This guards Foundational's T004/T006 design against being accidentally coupled to `activeGroup` in a future edit.
- [ ] T015 [US2] Run `quickstart.md` Scenario 2 manually: confirm a slider's level survives a switch away and back (FR-006, SC-003), and confirm moving a muted group's slider is reflected on reopen/reactivation without further code changes — this validates that Foundational (T004, T006) plus User Story 1 (T010) already satisfy this story with no additional implementation.

**Checkpoint**: User Stories 1 AND 2 both hold — switching groups works, and it never disturbs individual track balance.

---

## Phase 5: User Story 3 - Active group persists across popup use (Priority: P3)

**Goal**: The currently active group survives the popup being closed and reopened, the same way play/paused state and per-track volumes already do.

**Independent Test**: Switch to Group 2 (Storm), close the popup, reopen it, and confirm "Storm" is still shown active and its tracks (not Forest's) are the ones audible if the mix is playing. Per `quickstart.md` Scenario 3.

### Implementation for User Story 3

- [X] T016 [US3] In `popup.js`'s `saveNatureMixState()`, add `activeGroup: natureActiveGroup` (the variable tracked by T012) to the object written to the `natureMix` key in `chrome.storage.local` (contracts/messages.md persistence side effects). Depends on T012.
- [X] T017 [US3] In `background.js`'s `ensureOffscreen()`, add `activeGroup: natureMix.activeGroup` to the `natureLoadState` message it already sends after creating the offscreen document (contracts/messages.md's extended payload).

**Checkpoint**: All three user stories are independently functional — switching, balancing, and persisting the active group all work, matching `quickstart.md` Scenarios 1–5 end to end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all three stories.

- [ ] T018 [P] Run `quickstart.md` Scenarios 1, 4, and 5 manually via "Load unpacked" in `chrome://extensions` (group switch while playing, group switch while paused, repeated toggling never produces both-audible or both-silent), confirming no console errors in either the popup's or the offscreen document's DevTools console (Constitution "Development Workflow").
- [X] T019 [P] Run `node --check` on `offscreen.js`, `popup.js`, and `background.js` after all edits land, to catch syntax errors before manual browser testing.
- [X] T020 [US1] Follow-up from manual testing (FR-007 amended): in `popup.html`, give each of the 5 track rows in `natureSoundsPanel` an id (`natureRowRain`/`Birds`/`Wind`/`Thunder`/`Ocean`); in `popup.js`, add a `NATURE_TRACK_GROUP` map and, in `applyState()`'s `natureActiveGroup` handling, dim (`opacity: 0.4`) the rows whose group is inactive and restore (`opacity: 1`) the active group's rows — without touching slider position or disabling dragging, so a muted group's silence is visible on the sliders themselves, not just the group buttons.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1's verification (T001) confirming the track ids T002's `NATURE_GROUPS` will reference are correct — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion.
  - US1 (T010–T013), US2 (T014–T015), and US3 (T016–T017) touch largely disjoint functions/files, so they can be implemented in priority order (US1 → US2 → US3) or, with care around `popup.js`'s shared `applyState()`/`natureActiveGroup` variable (introduced by US1, read by US3), in parallel once US1's T012 lands.
- **Polish (Phase 6)**: Depends on US1–US3 all being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3. Fully testable alone once Foundational is done.
- **US2 (P2)**: Requires no new implementation beyond Foundational + US1 (T004, T006, T010) — it is a validation-only phase confirming those already satisfy FR-006/SC-003.
- **US3 (P3)**: Depends on US1's T012 (the `natureActiveGroup` tracking variable in `popup.js`) to know what to persist.

### Parallel Opportunities

- T009 (Foundational UI shell) can run in parallel with T002–T008 (Foundational offscreen logic) — different files.
- T018, T019 (Polish) can run in parallel.

---

## Parallel Example: Foundational Phase

```bash
# Offscreen-side foundational work:
Task: "Add NATURE_GROUPS constant and activeGroup state in offscreen.js"
Task: "Add applyNatureVolumes() effective-volume helper in offscreen.js"

# UI-side foundational work (different file, runs alongside the above):
Task: "Add Forest/Storm segmented control markup to popup.html"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (group data, effective-volume mechanism, UI shell).
3. Complete Phase 3: User Story 1 (the toggle itself).
4. **STOP and VALIDATE**: Run `quickstart.md` Scenario 1 independently.
5. This alone delivers the entire point of the feature — one-action group switching.

### Incremental Delivery

1. Setup + Foundational → group data and effective-volume math exist, UI shell rendered.
2. Add US1 → validate with Scenario 1 → usable MVP (switch groups, correct visual feedback).
3. Add US2 → validate with Scenario 2 → confirms balance survives switching (mostly "free" from Foundational's design).
4. Add US3 → validate with Scenario 3 → active group now survives popup close/reopen.
5. Polish → full `quickstart.md` pass (Scenarios 1, 4, 5) plus syntax checks.

---

## Notes

- US2's phase is intentionally light on new code: the derived effective-volume design (data-model.md, research.md D1) built in Foundational already guarantees FR-006 by construction, so US2's job is documenting that invariant (T014) and validating it (T015), not writing new logic.
- Every task's file path is one of the four files this feature touches per `plan.md`: `offscreen.js`, `popup.html`, `popup.js`, `background.js` — no new files are created.
- Commit after each task or logical group; stop at any checkpoint to validate that story independently via the matching `quickstart.md` scenario.
