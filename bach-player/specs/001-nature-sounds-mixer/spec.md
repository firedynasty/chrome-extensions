# Feature Specification: Nature Sounds Mixer

**Feature Branch**: `001-nature-sounds-mixer`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Replace the beats section in bach-player with a nature-sounds mixer that plays three ambient tracks simultaneously: Rainforest Rain, Forest Birdsong, and Relaxing Wind. Each track gets its own volume slider, starting at max volume, plus a shared play/pause toggle button that starts and stops all three tracks together. This replaces the existing beats/metronome-maker section of the popup UI."

**Amendment (2026-09-11)**: Extended per follow-up user request to add two more tracks — "Epic Thunder Rain" and "Ocean Waves" — for a total of five. All requirements below are written in terms of "every track"/"all tracks" so they apply unchanged regardless of count; only FR-002 and Key Entities name the tracks explicitly and have been updated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play an ambient nature mix (Priority: P1)

A user opens the extension popup wanting background ambience instead of the drum-machine
beats panel. They open the nature-sounds mixer panel and press a single play/pause button;
all the ambient tracks start playing together, looping continuously as
ambient background sound.

**Why this priority**: This is the entire reason the beats panel is being replaced — an
ambient soundscape delivers value the moment all the tracks can be started together.
Without this, there is no feature.

**Independent Test**: With no other part of the mixer touched, open the popup, expand the
nature-sounds panel, and press the toggle button. Can be fully tested by confirming all
the tracks are audible together and that pressing the button again pauses all of them.

**Acceptance Scenarios**:

1. **Given** the mixer is paused and no track has ever played, **When** the user presses
   the play/pause toggle, **Then** all the tracks begin playing together, each looping
   from the start once it reaches the end of its recording.
2. **Given** all the tracks are playing, **When** the user presses the play/pause
   toggle again, **Then** all the tracks pause together at their current positions.
3. **Given** the mixer was paused mid-track, **When** the user presses play again,
   **Then** each track resumes from the position it was paused at, not from the beginning.

---

### User Story 2 - Balance the mix with per-track volume (Priority: P2)

While the ambient mix is playing (or paused), the user drags an individual volume slider
for one of the tracks — for example, turning down the wind sound while leaving the
other tracks at full volume — to get the blend they want.

**Why this priority**: All tracks played at a fixed, identical volume is far less
useful than a mix the user can balance to taste; this is the feature's main point of
customization, but the mix is already usable without it (P1 covers the baseline).

**Independent Test**: With the mix already playing at default (max) volume on every
track, move one track's slider down and confirm only that track's loudness changes while
the other tracks are unaffected, including when the slider is dragged to zero (silent but
still playing/looping in sync).

**Acceptance Scenarios**:

1. **Given** the mix is playing with all tracks at maximum volume, **When** the user
   drags one track's volume slider down, **Then** only that track's audible volume
   decreases; the other tracks are unaffected.
2. **Given** a track's volume slider is set to zero, **When** the mix is playing,
   **Then** that track is silent but keeps playing and looping in sync with the other
   tracks, so raising its slider again immediately makes it audible at the correct position.
3. **Given** the mixer panel is opened for the first time, **When** the user views the
   sliders, **Then** every slider is already set to maximum volume.

---

### User Story 3 - Mix settings persist across popup use (Priority: P3)

A user sets up a mix they like (particular volume balance, playing or paused), closes the
popup (or it closes automatically), and later reopens it. The mixer looks and sounds the
way they left it, without needing to reconfigure anything.

**Why this priority**: Nice-to-have continuity that matches how the rest of the player
already behaves (playback survives popup close via the offscreen document), but the mixer
is fully usable within a single popup session even without it.

**Independent Test**: Set a non-default volume on at least one track and start playback,
close the popup, reopen it, and confirm the toggle shows "playing", the sliders show the
previously chosen levels, and the mix is still audible without needing to press play
again.

**Acceptance Scenarios**:

1. **Given** the mix is playing with custom volume levels, **When** the user closes and
   reopens the popup, **Then** the toggle still shows "playing", every slider reflects
   its last-set level, and the tracks are still audible without user action.
2. **Given** the mix is paused with custom volume levels, **When** the user closes and
   reopens the popup, **Then** the toggle shows "paused" and every slider reflects its
   last-set level.

---

### Edge Cases

- What happens when a track's audio fails to load (e.g. the Dropbox link is temporarily
  unreachable)? The other tracks MUST still play; the failed track is shown as
  unavailable rather than silently blocking the whole mix or erroring the whole panel.
- What happens when a ~30-minute track file reaches its end while the mix is playing?
  It MUST loop back to the start seamlessly, without user action and without stopping
  the other tracks.
- What happens if the user starts the nature-sounds mix while the main music player is
  already playing a track (or vice versa)? Both MUST be able to play at the same time,
  as independent audio layers — starting one MUST NOT pause or stop the other.
- What happens the very first time the mixer is used, before any settings have been
  saved? The toggle MUST default to paused (no autoplay on first use) with every slider
  at maximum volume.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST replace the existing embedded Beats Maker panel (its toggle
  button, preset controls, sequencer grid, BPM control, and volume control) with a
  nature-sounds mixer panel in the same location of the popup UI.
- **FR-002**: System MUST offer exactly five fixed nature sound tracks — "Rainforest
  Rain", "Forest Birdsong", "Relaxing Wind", "Epic Thunder Rain", and "Ocean Waves" —
  each streamed from its designated source audio file.
- **FR-003**: System MUST provide a single play/pause toggle control that starts all
  the tracks together and pauses all of them together; partial states (some playing,
  some paused) MUST NOT occur as a result of using the toggle.
- **FR-004**: System MUST provide an independent volume slider for each of the
  tracks, adjustable at any time regardless of whether the mix is playing or paused.
- **FR-005**: Every volume slider MUST default to maximum volume the first time the
  mixer is used (before any user adjustment has been saved).
- **FR-006**: System MUST loop each track continuously and seamlessly back to its start
  whenever it reaches the end of its recording, for as long as the mix remains playing.
- **FR-007**: System MUST keep the tracks' playback positions synchronized to each
  other (all started together, all paused together, all looping on the same schedule)
  regardless of individual volume settings.
- **FR-008**: System MUST allow the nature-sounds mix to play concurrently and
  independently of the main music player — starting or stopping one MUST NOT affect the
  other.
- **FR-009**: System MUST persist each track's volume level and the mixer's play/paused
  state across the popup being closed and reopened, and MUST resume playback
  automatically on reopen if it was playing when last closed.
- **FR-010**: System MUST visually reflect the current play/paused state on the toggle
  control and the current level of each track on its slider at all times.
- **FR-011**: If a track's audio source fails to load, system MUST continue playing the
  remaining track(s) and visibly indicate that the failed track is unavailable, rather
  than blocking playback of the whole mix.

### Key Entities

- **Nature Sound Track**: One of the five fixed ambient audio sources in the mixer
  ("Rainforest Rain", "Forest Birdsong", "Relaxing Wind", "Epic Thunder Rain", "Ocean
  Waves"). Has a display name, a source audio file, a current volume level
  (0–maximum, defaulting to maximum), and shares the mixer's single playing/paused
  state with the other tracks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can start all the nature sounds playing together with a single
  action (one press of the toggle button).
- **SC-002**: A user can change the relative loudness of any one track without affecting
  the other tracks, in a single drag action on that track's slider.
- **SC-003**: 100% of the time, the tracks stay in sync with each other (start,
  pause, and loop together) across at least one full loop cycle of continuous playback.
- **SC-004**: Reopening the popup after closing it during playback resumes the same mix
  (playing/paused state and volume levels) with no additional user action required.
- **SC-005**: If one of the tracks' audio is unreachable, the user can still hear
  the other tracks rather than losing the whole ambient mix.

## Assumptions

- "The beats section" refers to the embedded, in-popup Beats Maker panel (preset
  selector, play button, BPM slider, step grid, and volume slider) — not the separate
  "Famous Beats Maker" external link that opens a different website; that link is
  unrelated to this panel and is out of scope for this feature.
- The source audio files are already loudness-normalized, fixed-length (~30
  minute) recordings intended to loop as ambient background sound; no trimming, mixing,
  or re-encoding is required beyond what the files already are.
- "Maximum volume" for the default slider position matches the same 0–100 volume range
  already used elsewhere in this popup (e.g. the previous beats volume slider), not a
  separately defined scale.
- The nature-sounds mixer, like the beats panel it replaces, runs as an independent audio
  layer from the main music player rather than being mutually exclusive with it.
- No stop/reset control is required beyond play/pause — "stopping" a track for this
  feature means pausing it in place, consistent with the play/pause toggle described by
  the user.
- Storage keys and any other data specific to the removed Beats Maker panel (presets,
  live grid/BPM state) are no longer needed once it is replaced and may be cleaned up.
