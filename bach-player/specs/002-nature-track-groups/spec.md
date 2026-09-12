# Feature Specification: Nature Sound Groups Toggle

**Feature Branch**: `002-nature-track-groups`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "so I got 5 tracks, I would want like a grouping like first grouping is rain, birds, wind (Rainforest Rain, Forest Birdsong, Relaxing Wind); second grouping is thunder, ocean (Epic Thunder Rain, Ocean Waves); and that a toggle first grouping second grouping so one grouping will have volume 0 while the other grouping is on so 100 / 0 or 0 / 100 please"

**Depends on**: [001-nature-sounds-mixer](../001-nature-sounds-mixer/spec.md) — this feature extends the existing five-track Nature Sounds Mixer; it does not replace that mixer's play/pause toggle, per-track volume sliders, or persistence mechanism.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch the ambient mood with one action (Priority: P1)

A user has the nature-sounds mixer's five tracks organized into two groups — a calm
"forest" group (rain, birdsong, wind) and a dramatic "storm" group (thunder, ocean
waves). Instead of adjusting up to five individual sliders to change the mood of the
background sound, they press a single group toggle to switch which group is audible.

**Why this priority**: This is the entire point of the request — collapsing "mute three
sliders and un-mute two others" into one action. Without this, there is no feature.

**Independent Test**: With the mix already playing at default per-track volumes, press
the group toggle. Can be fully tested by confirming the previously audible group's three
(or two) tracks go silent and the other group's tracks become audible, with no other
sliders touched.

**Acceptance Scenarios**:

1. **Given** Group 1 (rain, birdsong, wind) is active and Group 2 (thunder, ocean) is
   muted, **When** the user presses the group toggle, **Then** Group 1's tracks become
   silent and Group 2's tracks become audible.
2. **Given** Group 2 is active, **When** the user presses the group toggle again,
   **Then** Group 2's tracks become silent and Group 1's tracks become audible again.
3. **Given** either group is active, **When** the user checks the toggle control,
   **Then** it visibly indicates which group is currently active.

---

### User Story 2 - Per-track balance survives a group switch (Priority: P2)

A user has adjusted individual track volumes within a group to their liking (for
example, turning "Forest Birdsong" down while leaving "Rainforest Rain" and "Relaxing
Wind" at full volume). They switch to the other group and back.

**Why this priority**: Without this, every group switch would silently discard the
user's earlier volume balancing (from the existing per-track sliders), making the two
features fight each other. It matters less than the toggle itself existing (P1).

**Independent Test**: With Group 1 active, set a non-default volume on one of its
tracks. Switch to Group 2, then switch back to Group 1. Confirm the previously adjusted
track is still at the volume it was left at, not reset to maximum.

**Acceptance Scenarios**:

1. **Given** a track in the active group has a non-default volume, **When** the user
   switches to the other group and back, **Then** that track's volume slider and
   audible loudness are unchanged from before the switch.
2. **Given** a group is muted (inactive), **When** the user adjusts that group's
   individual sliders while it is muted, **Then** the sliders visibly update but no
   sound is heard until that group becomes active again, at which point the new levels
   are audible.

---

### User Story 3 - Active group persists across popup use (Priority: P3)

A user picks a group, closes the popup, and reopens it later. The mixer remembers which
group was active.

**Why this priority**: Consistent with how the rest of the mixer already persists
(play/paused state, per-track volumes); a group choice that resets every time the popup
is reopened would be a regression relative to that existing behavior. Lower priority
than P1/P2 because the feature is still useful within a single popup session without it.

**Independent Test**: Switch to Group 2, close the popup, reopen it, and confirm the
toggle still shows Group 2 as active and Group 2's tracks (not Group 1's) are the ones
audible if the mix is playing.

**Acceptance Scenarios**:

1. **Given** Group 2 is active when the popup is closed, **When** the user reopens the
   popup, **Then** the toggle still shows Group 2 as active and Group 1 remains muted.

---

### Edge Cases

- What happens if the user presses the group toggle while the mixer's overall
  play/pause is paused (nothing audible at all)? The toggle MUST still update which
  group will be audible once play is pressed; it MUST NOT itself start playback.
- What happens to an inactive group's tracks technically while muted — do they stop, or
  keep playing silently? They MUST keep playing and looping in perfect sync (consistent
  with how an individual track already behaves at volume 0), so switching back is
  instant with no restart lag or re-sync delay.
- Can both groups be silent, or both audible, at the same time via this toggle? No —
  exactly one group MUST be active at any time; the toggle only ever produces "100/0" or
  "0/100" at the group level, never both-off or both-on.
- What happens the very first time this feature is used, before any group selection has
  been saved? The system MUST default to Group 1 (rain, birdsong, wind) as the active
  group.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST organize the five existing nature sound tracks into exactly
  two fixed groups: Group 1 ("Rainforest Rain", "Forest Birdsong", "Relaxing Wind") and
  Group 2 ("Epic Thunder Rain", "Ocean Waves").
- **FR-002**: System MUST provide a single two-position toggle control that selects
  which one of the two groups is currently active.
- **FR-003**: When a group is active, every track in it MUST be audible at its own
  individually configured volume level; when a group is inactive, every track in it
  MUST be silent regardless of its individually configured volume level.
- **FR-004**: Exactly one group MUST be active at any time — the toggle MUST NOT allow
  both groups to be silent or both audible simultaneously.
- **FR-005**: Switching the active group MUST take effect immediately, without
  restarting, reloading, or losing the current playback position of any track in either
  group.
- **FR-006**: Muting a group MUST NOT alter the stored individual volume-slider position
  of any track in it — reactivating that group MUST restore the exact per-track balance
  it had before it was muted.
- **FR-007**: System MUST visually indicate which group is currently active — both on
  the toggle control itself and on each individual track's volume slider (muted
  tracks' sliders are visibly dimmed, without changing their position or disabling
  dragging) — at all times.
- **FR-008**: System MUST persist the currently active group across the popup being
  closed and reopened, restoring the same active group on reopen.
- **FR-009**: The first time this feature is used, before any group selection has been
  saved, the system MUST default to Group 1 as the active group.
- **FR-010**: The group toggle MUST function independently of the mixer's overall
  play/pause control — switching groups while paused MUST update which group will be
  audible once playback resumes, without itself starting or stopping playback.

### Key Entities

- **Nature Sound Group**: A named, fixed collection of Nature Sound Tracks (the track
  entity defined in the Nature Sounds Mixer feature this extends). Has an id, a display
  name, and an ordered list of member track ids. Exactly one of the two groups is
  "active" at any time relative to the mixer's single group-toggle state; the other is
  "inactive" (muted).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can change which set of ambient tracks is audible with a single
  action, instead of adjusting each track's slider individually.
- **SC-002**: 100% of the time, after using the toggle, exactly one group is audible —
  never both groups at once, never neither.
- **SC-003**: A user's individual track volume balance within a group survives at least
  one full switch away and back, unchanged.
- **SC-004**: Reopening the popup after switching groups shows and plays the same group
  that was active when it was closed.

## Assumptions

- The two groups' membership (Group 1: rain, birdsong, wind; Group 2: thunder, ocean) is
  fixed as specified by the user and is not user-editable or reconfigurable within this
  feature.
- Group display names shown next to the toggle (e.g. something like "Forest" / "Storm")
  are chosen by whoever implements this as reasonably descriptive labels, since the user
  did not specify exact wording; the precise copy is a UI detail, not a functional
  requirement, as long as it's clear which group is which.
- The five existing per-track volume sliders (from the Nature Sounds Mixer feature this
  extends) remain visible and individually adjustable regardless of which group is
  active. The group toggle is an additional master-mute layer on top of them, not a
  replacement — this matches the request's own wording ("and that a toggle...") as an
  addition to the existing mixer rather than a redesign of it.
- "Muted" for an inactive group means silent audio while its tracks keep playing and
  looping in the background, exactly like an individual track already behaves when its
  own slider is at zero in the existing feature — not literally pausing that group.
- This feature depends on and extends specs/001-nature-sounds-mixer; it does not modify
  that feature's play/pause toggle, per-track sliders, or persistence mechanism beyond
  adding the new active-group field alongside them.
