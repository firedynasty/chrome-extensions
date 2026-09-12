# Quickstart: Validating the Nature Sound Groups Toggle

## Prerequisites

- Same as [001-nature-sounds-mixer's quickstart.md](../001-nature-sounds-mixer/quickstart.md):
  Chrome/Chromium with Developer mode, this repo's `bach-player/` loaded (or
  reloaded) as an unpacked extension, no build step.
- Feature 001 (the base 5-track mixer) already working — this feature only adds a
  group toggle on top of it.

## Setup

Same as feature 001: `chrome://extensions` → reload the unpacked extension →
open the popup → expand the "Nature Sounds" panel.

## Scenario 1 — Switch groups with one action (User Story 1, P1)

1. With the panel expanded, locate the new group toggle (two buttons, "Forest"
   and "Storm") above or below the existing five volume sliders.
2. Confirm "Forest" is highlighted as active by default (FR-009).
3. Start playback (the existing play/pause toggle).
4. **Expected**: Rainforest Rain, Forest Birdsong, and Relaxing Wind are audible;
   Epic Thunder Rain and Ocean Waves are silent (even though all five sliders
   still show their own levels).
5. Press "Storm".
6. **Expected**: within the same instant (no restart/lag), Rainforest Rain,
   Forest Birdsong, and Relaxing Wind go silent, and Epic Thunder Rain / Ocean
   Waves become audible. "Storm" is now shown highlighted, "Forest" is not, and
   the three Forest sliders are visibly dimmed while the two Storm sliders are
   full-opacity (FR-003, FR-004, FR-005, FR-007).
7. Press "Forest" again.
8. **Expected**: audio flips back the other way, still without any restart lag.

## Scenario 2 — Per-track balance survives a group switch (User Story 2, P2)

1. With "Forest" active, drag "Forest Birdsong"'s slider down to roughly half.
2. Switch to "Storm", then back to "Forest".
3. **Expected**: "Forest Birdsong"'s slider is still at the same half-level, and
   it's audible at that level again — not reset to maximum (FR-006, SC-003).
4. While "Storm" is active (so "Forest" is muted), drag "Rainforest Rain"'s
   slider to a new level.
5. **Expected**: the slider visibly moves, but no sound is heard from it (Forest
   is still muted). Switch to "Forest".
6. **Expected**: Rainforest Rain is now audible at the new level just set in
   step 4 — the change took effect, it just wasn't audible until reactivated.

## Scenario 3 — Persistence across popup close (User Story 3, P3)

1. Switch to "Storm", close the popup, reopen it.
2. **Expected**: "Storm" is still shown highlighted, "Forest" tracks are still
   muted, and (if the mix was playing) Storm's tracks are still audible without
   any extra action (FR-008, SC-004).

## Scenario 4 — Group toggle works independent of play/pause (Edge Case)

1. Pause the mix entirely (existing play/pause toggle).
2. Switch the active group while paused.
3. **Expected**: nothing becomes audible yet (still paused); pressing play now
   MUST play the group that was just selected, confirming the switch took effect
   even while nothing was playing (FR-010).

## Scenario 5 — Exactly one group at a time (Edge Case, SC-002)

1. With the mix playing, repeatedly press the group toggle several times in a
   row.
2. **Expected**: at every point in time, exactly one group's tracks are audible
   — never both sets at once, never silence from both (aside from whatever
   individual sliders are already at zero, which is unrelated to the group
   toggle).

## Verifying against the constitution (Development Workflow)

- No automated test suite exists for this project — the scenarios above are the
  verification, run manually via "Load unpacked."
- This feature adds no new `manifest.json` permissions or CSP directives
  (nothing new is fetched — it only changes which already-loaded `<audio>`
  elements are audible), so no CSP-related reload/console check is expected
  beyond the general "no console errors" check.
