# Phase 1 Data Model: Nature Sound Groups Toggle

This extends [001-nature-sounds-mixer's data-model.md](../001-nature-sounds-mixer/data-model.md).
Only what's new or changed is described here; `Nature Sound Track` (the 5 fixed
tracks) is unchanged.

## Nature Sound Group (fixed, code-defined — not persisted as its own record)

One of exactly two constant entries defined in `offscreen.js`, alongside the
existing `NATURE_TRACKS`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable short key: `forest` or `storm`. |
| `label` | string | Display name shown on its segmented-control button: "Forest", "Storm" (research.md D4). |
| `trackIds` | array of string | The `Nature Sound Track` ids that belong to this group, per FR-001. |

Fixed set (no create/update/delete — group membership is not user-editable, per
spec.md Assumptions):

```js
const NATURE_GROUPS = [
  { id: 'forest', label: 'Forest', trackIds: ['rain', 'birds', 'wind'] },
  { id: 'storm',  label: 'Storm',  trackIds: ['thunder', 'ocean'] },
];
```

## Nature Mixer State (persisted) — extended

The existing `natureMix` record (`chrome.storage.local`, written by `popup.js`,
replayed into a fresh offscreen document by `background.js`) gains one field:

| Field | Type | Range / Default | Notes |
|---|---|---|---|
| `isPlaying` | boolean | default `false` | Unchanged from feature 001. |
| `volumes` | object, keyed by track `id` | each value `0–100`, default `100` | Unchanged from feature 001. Never written to by group muting (research.md D1) — see Effective Volume below. |
| `activeGroup` | string | `'forest'` or `'storm'`, default `'forest'` | New. Which `Nature Sound Group.id` is currently active (FR-002, FR-009). |

Example shape:

```json
{
  "isPlaying": true,
  "volumes": { "rain": 100, "birds": 40, "wind": 100, "thunder": 100, "ocean": 100 },
  "activeGroup": "storm"
}
```

**Validation rules**:
- `activeGroup` MUST be one of the `NATURE_GROUPS` ids; a missing or unrecognized
  value is treated as `'forest'` (research.md D5).
- `volumes`' existing validation rules (clamped `0–100`, missing id defaults to
  `100`) are unchanged and independent of `activeGroup`.

## Effective volume (derived — not stored anywhere)

For each `Nature Sound Track` with id `t`:

```
effectiveVolume(t) = (natureVolumes[t] / 100) * (t is in the active group's trackIds ? 1 : 0)
```

This is what's actually assigned to `natureAudioElements[t].volume`. It is
recomputed — for every track — whenever any of its inputs change:
- a volume slider moves (`natureSetVolume`),
- the active group switches (`natureGroupToggle`),
- state is loaded on offscreen-document creation (`natureLoadState`).

`natureVolumes[t]` itself (the number shown on that track's slider) is set **only**
by `natureSetVolume` and by `natureLoadState`'s initial restore — group toggling
never touches it, which is what makes FR-006 (muting doesn't lose the slider
position) hold without any extra bookkeeping.

## Runtime-only state (not persisted)

Unchanged from feature 001 (`natureAudioElements`, `natureTrackErrors`).
`activeGroup` is *not* runtime-only — like `isPlaying` and `volumes`, it is
in-memory state that mirrors the persisted record and is written back to storage
by `popup.js` on every relevant broadcast.

## State transitions (new / changed)

```
[forest active] --(group toggle pressed / natureGroupToggle message)--> [storm active]
  effect: every forest track's <audio>.volume recomputed to 0 (muted);
  every storm track's <audio>.volume recomputed to natureVolumes[id]/100 (audible);
  no track's natureVolumes entry changes; no track's play/pause state changes — FR-003,
  FR-004, FR-005, FR-006

[storm active] --(group toggle pressed / natureGroupToggle message)--> [forest active]
  effect: mirror of the above, forest becomes audible and storm is muted

[any active group] --(volume slider moved for track X)--> [same activeGroup, natureVolumes[X] updated]
  effect: natureVolumes[X] updated (as in feature 001); effectiveVolume(X) recomputed —
  audible immediately if X's group is active, otherwise the audio element's volume
  stays 0 even though natureVolumes[X] changed (User Story 2, Acceptance Scenario 2)

[offscreen doc created] --(natureLoadState message)--> [isPlaying/volumes/activeGroup restored]
  effect: activeGroup restored from storage, defaulting to 'forest' if absent
  (upgrade path from feature 001, or true first-ever use) — FR-008, FR-009
```
