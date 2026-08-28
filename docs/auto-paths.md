# Auto Path Feature

Implements [issue #14](https://github.com/Team973/greyscout/issues/14): scouts can draw a
team's autonomous path on a field map, save it, and later preview how up to
three teams' autos fit together on the same alliance.

## Overview

| Piece | Where |
|---|---|
| Drawing a path | **Team Analysis** → "Auto Paths" section, below Pit Scouting |
| Viewing/flipping a saved path | Same section — each saved path is a card with its own alliance/side "view as" toggle |
| Combining several teams' autos | **Match Preview** (`/match-preview`) — new "Auto Path Preview" tile under each alliance |

The field background is the real 2026 field overlay
(`src/assets/2026-field.png`, provided by the team). It depicts the field
in a fixed physical orientation — red alliance wall on the image's left,
blue on the right — plus off-field context (numbered starting zones,
human player stations) outside the actual playing-field rectangle. Every
consumer of a path only depends on the normalized `[0, 1]` point
coordinates described below, not the image directly, so re-exporting a
higher-res or corrected version of the field art later only means
replacing that PNG and re-measuring `FIELD_BOUNDS` in
`AutoPathCanvas.vue` (see below).

---

## Data model

### `AutoPath` table

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` (PK, identity) | |
| `created_at` / `updated_at` | `timestamptz` | Default `now()` |
| `event` | `text` | Event id, e.g. `"2026cc"` |
| `scouted_by` | `uuid` | FK → `User.user_id`, default `auth.uid()` |
| `team_number` | `smallint` | |
| `name` | `text` | Scout-provided name, renameable |
| `alliance` | `text` | `"red"` or `"blue"` — the alliance the path was **drawn** as |
| `side` | `text` | `"left"` or `"right"` — the starting side it was **drawn** as |
| `path` | `jsonb` | Array of `{ x, y, t }` points, `x`/`y` in `[0, 1]` in the frame described below, `t` the point's recorded time as a `[0, 1]` fraction of the path's normalized duration (see "Timing" below). `t` is optional — paths saved before [issue #35](https://github.com/Team973/greyscout/issues/35) don't have it |
| `is_default` | `boolean` | This team's default auto for Match Preview to pre-select (see below) |

A partial unique index, `autopath_default_unique` on `(team_number, event)
WHERE is_default = true`, enforces at most one default per team per event
— `setAutoPathDefault()` in `auto-path-query.ts` clears any existing
default for that team/event before setting a new one, so it never
conflicts with that index.

Migrations: [`supabase/migrations/20260823120000_add_autopath.sql`](../supabase/migrations/20260823120000_add_autopath.sql)
(table + RLS) and [`20260824000000_add_autopath_default.sql`](../supabase/migrations/20260824000000_add_autopath_default.sql)
(`is_default` + the unique index). Both were pushed live via
`supabase db push --linked` and confirmed in `supabase migration list`.
The declarative schema at `supabase/database/schemas/prod.sql` was updated
by hand to match, since this environment had no Docker daemon available to
run `supabase db diff` locally — if you add further schema changes,
cross-check them against the live database directly (per the known
pgdelta cache bug making `db diff --linked` unreliable on its own).

**RLS policies** (mirrors `PitData`, plus delete since the issue calls
that out explicitly):
- `SELECT`: any authenticated user
- `INSERT`: `scouted_by = auth.uid()`
- `UPDATE` / `DELETE`: any authenticated user (team-wide edit model, same
  as pit scouting corrections — not owner-restricted)

### Coordinate frame — and why alliance and side are handled in different places

A path is stored in a frame anchored to its own recorded alliance/side:
- `x`: `0` = "my" own wall, `1` = the far/opposing wall
- `y`: `0` = "my" own left edge, `1` = "my" own right edge

By construction this frame is **alliance-agnostic**: `(0.1, 0.1)` means
"started near my own wall, near my own left" whichever alliance "my"
refers to. The same numbers are valid input for placing the path under
*either* alliance — alliance never has to change the stored numbers.
**Side is the only thing that's a real mirror within this frame:**
`transformPath()` in [`src/lib/2026/auto-path-field.ts`](../src/lib/2026/auto-path-field.ts)
takes `(points, fromSide, toSide)` and flips `y` (`1 - y`) when the side
differs, leaving `x` untouched. It has no alliance parameter at all.

All alliance-based repositioning happens in exactly one place:
`AutoPathCanvas.vue`, because it alone has to deal with the fact that
there's only **one** fixed field image (`2026-field.png`) — red is always
physically drawn on its left, blue always on its right, it doesn't
re-render per alliance. Its internal `toView()`/`fromEvent()` rotate a
point 180° (`x, y → 1-x, 1-y`) whenever `displayAlliance` is blue, since
blue's own-relative origin sits at the diagonally opposite corner of that
fixed image from red's, then rescale into the sub-rectangle of the PNG
that the actual playing-field boundary occupies (`FIELD_BOUNDS` —
measured directly from the pixels: the field's black border spans
roughly `x:[1048,6943]`, `y:[171,3068]` of the 7992×3240 source image; the
image has margin around that for off-field labels/zones). If the field
art is ever replaced, re-measure that rectangle and update `FIELD_BOUNDS`
to match.

**Do not reintroduce an alliance-based rotation in `transformPath()`.**
An earlier version did exactly that (matching the field's real point
symmetry), and it's tempting — but every caller that calls `transformPath`
*and* then passes the result into `AutoPathCanvas` with a matching
`display-alliance` was rotating the point twice, which cancels out
exactly on an alliance change and made the alliance flip look like it did
nothing. `AutoPathCanvas`'s rotation, driven solely by its
`display-alliance` prop, is already a complete, self-contained "show this
own-relative path as if it belonged to alliance X" — it doesn't care what
alliance a point was actually recorded under. Callers (`AutoPathCard`,
Match Preview) rely on exactly that: they pass a path's raw stored points
straight through — optionally side-mirrored via `transformPath` — and let
`display-alliance` alone decide where it lands on the image.

---

## Components

| File | Purpose |
|---|---|
| [`src/components/AutoPathCanvas.vue`](../src/components/AutoPathCanvas.vue) | The field SVG, background image is `src/assets/2026-field.png`. Two modes: single editable/viewable path (`points`/`color` props), or a read-only multi-path overlay (`layers` prop: `[{ key, points, color }]`) used by Match Preview. Drawing uses Pointer Events (`touch-action: none`) so mouse, touch, and pen all work the same way. Also owns per-point time recording and time-relative playback — see "Timing" below. |
| [`src/components/AutoPathTimeline.vue`](../src/components/AutoPathTimeline.vue) | The scrub/timing-adjustment bar rendered below the canvas in the editor — see "Timing" below. |
| [`src/components/AutoPathEditor.vue`](../src/components/AutoPathEditor.vue) | Create/edit form: name, alliance/side dropdowns, the canvas, the timeline, Reset/Save/Cancel/Delete. Reuses `submitScoutData`/`updateScoutData` from `data-submission.ts` (same as pit scouting) so a failed save enqueues into the existing offline-queue FAB instead of a bespoke path. |
| [`src/components/AutoPathCard.vue`](../src/components/AutoPathCard.vue) | Read-only list card for Team Analysis: renders a saved path plus an alliance/side "view as" toggle (backed by `transformPath`), a default-auto badge/button, and an Edit button. |
| [`src/lib/2026/auto-path-field.ts`](../src/lib/2026/auto-path-field.ts) | `transformPath()`, the alliance/side dropdown choice lists, and the timing helpers `pointTime()`/`pathTimeColor()` shared by the canvas and timeline. |
| [`src/lib/auto-path-query.ts`](../src/lib/auto-path-query.ts) | Supabase queries: `fetchTeamAutoPaths`, `fetchAutoPathById`, `deleteAutoPath`, `setAutoPathDefault`. |

The editor, card, and Match Preview overlay canvases all render at `large`
size (`AutoPathCanvas`'s `large` prop drops its `max-width` cap entirely),
so each fills the available content width on desktop instead of being
capped at a small thumbnail size.

### Continuous-path drawing

Per the issue, a path must render as continuous even if the scout's
real-world drawing wasn't (finger lifted and replaced mid-draw on a touch
screen). `AutoPathCanvas` implements this by never clearing its point
buffer on pointer-up — every stroke just keeps appending to the same
ordered point array, which is rendered as one `<polyline>`. "Reset" in the
editor is the only way to clear it.

### Timing ([issue #35](https://github.com/Team973/greyscout/issues/35))

Playback used to move the marker at constant speed along the path's arc
length, taking `duration` (20s) end to end regardless of how the scout
actually drew it. It's now **time-relative**: each point carries its own
recorded time (`t`, `[0,1]` fraction of the normalized duration), and
`markerAtTime()` in `AutoPathCanvas.vue` interpolates between points by
that recorded time, not by distance — a stretch the scout drew quickly
plays back quickly, a stretch drawn slowly (e.g. a scoring action) plays
back slowly, independent of how much on-field distance either covers.

- **Recording.** `AutoPathCanvas` tracks each point's *active* elapsed
  drawing time in a parallel `drawTimestamps` array (raw ms, not yet
  normalized) — active meaning the clock only runs while the pointer is
  down, pausing across a lift/resume between strokes (a lift is a
  recording pause per "Continuous-path drawing" above, not something the
  robot did, so it shouldn't inject dead time into the pacing). Every
  emitted point is normalized on the fly: `t = drawTimestamps[i] /
  drawTimestamps[last]`, so the saved path's `t`s always span exactly
  `[0, 1]` — this is what "normalized to a 20-second standard duration"
  means: the *shape* of the pacing is recorded, and it's stretched or
  compressed to fill `duration` at playback time (`t * duration`),
  regardless of how many real seconds the scout spent drawing.
- **Resuming a path.** If drawing resumes on top of points that already
  have a `t` (continuing after a lift, or continuing to draw on a loaded
  saved path), `resyncTimestamps()` reconstructs an assumed elapsed-ms
  baseline from the existing `t`s (`t * duration`) so the new strokes'
  timing stays on a comparable scale before everything gets re-normalized.
- **Legacy paths.** Points saved before this existed have no `t`.
  `pointTime()` in `auto-path-field.ts` falls back to even spacing by
  index in that case, so old paths still animate (roughly their old
  constant-speed behavior) instead of breaking. `transformPath()` passes
  `t` through unchanged (via `{ ...p }`) — don't reintroduce a hand-picked
  `{ x, y }` there, it'll silently drop timing again.
- **Rainbow rendering, fixed by point order.** `AutoPathCanvas`'s
  `time-gradient` prop (on for the editor only, off for cards/Match
  Preview, which still use one flat `color` per path) renders the path as
  many short colored segments instead of one `<polyline>`, hue driven by
  each segment's midpoint **rank** — `((i-1) + i) / 2 / (len-1)` — via
  `pathTimeColor()` (red at the start → violet at the end). Deliberately
  **not** driven by each point's recorded `t`: coloring by rank means "the
  red part of the path" always means the same stretch of drawing, however
  its timing gets edited on the timeline below — the path's colors never
  repaint. The animated marker's color follows suit via `rankAtTime()` (the
  inverse of `markerAtTime()` — given the current time progress, what
  fixed-rank color is that point in the path currently colored?), so the
  marker's color always matches the segment it's visibly passing through
  even after a non-uniform timing edit. The editor's canvas always has
  `time-gradient` on, so a scout sees the same fixed coloring while
  drawing, adjusting timing, and previewing.
- **Start/End labels (flat-color viewer only).** The rainbow gradient
  already shows direction at a glance (red = start, violet = end), so
  `AutoPathCanvas` only draws an end-point dot and "Start"/"End" text labels
  (`labelPos()`) when `time-gradient` is *off* — the flat single-`color`
  viewer used by `AutoPathCard`/Match Preview has no such built-in cue.
- **The timeline editor** (`AutoPathTimeline.vue`, rendered below the
  canvas once `points.length > 2`): a horizontal bar that answers "how many
  seconds does each (fixed) color take?", modeled as resizable regions
  rather than draggable points — an earlier dot-based version (drag a small
  floating circle to re-time the point under it) was hard to land a precise
  drag on and had the two-neighbor clamping logic in `dragHandleTo` right
  next to your finger/cursor, which read as "unexpected" behavior; a
  region's own border is both a much bigger drag target and a much more
  legible one, since you're visibly grabbing the edge of the thing you're
  resizing.
  - **Regions** (`regions`, one per pair of adjacent boundaries in
    `handleIndices`): positioned and *widthed* by real time (`left`/`width`
    from the boundary points' own `t`s, so a region's width literally is
    how many seconds that stretch takes) and rendered as a `linear-gradient`
    sampled at several stops across the region's own point-rank span (not
    one flat midpoint color — a flat color only matches the canvas's
    per-point coloring at the region's exact middle, drifting further off
    at the edges the wider the region is; multiple gradient stops keep each
    inter-stop hop small enough that the RGB-space interpolation CSS
    gradients do stays visually indistinguishable from `pathTimeColor`'s
    HSL-based hue sweep). Adjacent regions share a boundary point's exact
    color as their touching gradient stop, so they meet with no visible
    seam — the whole bar reads as one continuous rainbow that exactly
    matches the canvas above it, stretching or compressing as regions are resized.
  - **Draggable bounds** (`interiorBounds`): a divider rendered at the
    border between two regions — a wide (~16px) invisible hit area
    centered on the boundary's time position, with a slim visible line in
    the middle, so a drag is easy to land without needing to hit a small
    exact point. Dragging one resizes both neighboring regions
    (`rescaleRange()` on each) without changing either region's color:
    "red for 4 seconds" always means the same red stretch of the path,
    just currently taking 4 seconds. The two `rescaleRange()` calls split
    the point range at `cur.pointIndex + 1`, not `cur.pointIndex` — the
    dragged boundary's own point is the shared edge between the two
    ranges, and only the *first* call may touch it. An earlier version had
    the second call start at `cur.pointIndex` too, so it read back the
    value the first call had just written as its own "old" reference
    instead of the true original — silently corrupting both the boundary's
    saved time and every point after it. This is why the boundary's
    persisted `t` must be checked against what it was dragged to, not just
    that the UI *looks* right immediately after dragging.
  - Dragging is also clamped to a `MIN_REGION_T` (~500ms of the 20s
    duration) on either side of the boundary being moved, not just enough
    to prevent inverting past a neighbor. A region allowed to shrink
    arbitrarily thin gives `requestAnimationFrame` — which only samples
    `animProgress` every ~16ms during playback — too few frames to render
    through it, so the marker visibly teleports across that stretch instead
    of gliding. (An earlier fix for the same symptom added a CSS
    `transition` on the marker's `cx`/`cy` to fake a glide; that was
    reverted — it desynced the marker's rendered *position* from its color
    and from the timeline's scrub bar, which both still update instantly
    off the same `animProgress`, since only position was artificially
    delayed. Capping how thin a region can get fixes the root cause instead
    of papering over it.)
  - The bound set starts at 10 roughly-equal regions by point count (exposing every raw drawn point —
    there can be hundreds — as its own region would be unusable) but isn't
    fixed — double-click a region to split it (adds a bound at the point
    nearest the clicked time), double-click a bound to remove it (merges
    its two regions back into one). The bar's own far-left/far-right edges
    are the two absolute end anchors (`t=0`/`t=1`) and aren't rendered as
    interactive bounds at all — there's no region beyond them to resize.
  - **The scrub thumb and the ruler below the bar** (`tickSeconds`,
    1-second resolution, major/labeled every 5s) are also positioned by
    real time, same as the regions and bounds — the ruler itself never
    moves regardless of any edit, it's just seconds.
  - Dragging a bound only re-seeds `handleIndices` (the set of point
    indices with a bound) from scratch when `points.length` itself changes
    (still drawing) — never by proportionally remapping the *existing*
    indices, which was tried first and silently collapsed bounds onto each
    other after enough small growth steps (rounding error compounds over
    ~one recompute per drawn point in a stroke). A custom split/merge only
    "sticks" once the scout has stopped drawing and the point count stops
    changing, matching the normal draw-first-then-adjust workflow.
- **Play preview while editing.** `AutoPathEditor.vue` has its own Play/Stop
  button (mirroring `AutoPathCard.vue`'s), wired to the same canvas via
  `:playing`/`@finished`. Its `previewProgress` binding
  (`canvasPreviewProgress`) passes through the timeline's scrub value only
  while *not* playing — `AutoPathCanvas` treats any non-null
  `previewProgress` as taking priority over the play animation, so without
  this guard the scrub thumb (which defaults to `0`, not `null`) would
  permanently pin the marker and the play animation would never visibly move.
  `AutoPathCanvas` also emits a `progress` event every animation frame
  (alongside updating its own internal `animProgress`); the editor forwards
  that straight into `scrubProgress`, so the timeline's white scrub bar
  visibly tracks along in real time while playing, instead of sitting
  frozen whereever it was last left from manual scrubbing — from the
  timeline's own view, playback and scrubbing are the same "where is the
  white bar" state, just driven by a different source.
- **Timing edits are disabled while playing.** `AutoPathTimeline` takes a
  `disabled` prop (`AutoPathEditor` passes `isPlaying`) that ignores bound
  drag/split/merge and manual scrubbing, and a `disabled` watcher cleanly
  drops any drag/scrub already in progress the instant playback starts.
  Editing the same points the canvas is actively animating out from under
  the edit was the original source of the timeline feeling "glitchy" and
  getting stuck — the bounds dim and the hint text swaps to say playback is
  in progress; pressing stop hands editing back.

---

## Team Analysis integration

`TeamAnalysisView.vue` order is Charts → Scout Comments → Pit Scouting →
Auto Paths (Comments was moved above Pit Scouting). The Auto Paths section
follows the exact same view/add/edit mode pattern already used for pit
scouting (`autoPathFormMode: 'view' | 'add' | 'edit'`). Saved paths render
as a list of `AutoPathCard`s, each assigned a color from a small fixed
palette (cycled by list position, first slot orange) so multiple paths
stay visually distinguishable even though only one renders at a time here.

### Default auto

Each team can mark one saved path as their default, via a "Set as Default"
button on its card (`AutoPath.is_default`, see Data Model above). Rules,
enforced in `AutoPathCard.vue`/`TeamAnalysisView.vue`:
- **A team with only one saved path always shows that path as the
  default**, whether or not `is_default` is actually set in the database —
  `AutoPathCard`'s `isOnlyPath` prop (`teamAutoPaths.length === 1`, passed
  down from `TeamAnalysisView`) drives this, so scouts never have to
  manually flag a team's sole auto.
- **There is no "unset default."** Once a path is default (explicitly or
  because it's the only one), the only way to change it is to set a
  *different* path as default — `setAutoPathDefault()` clears the old one
  as part of setting the new one. The "Set as Default" button simply
  doesn't render on whichever path is already effectively default.

## Match Preview

`MatchPreviewView.vue` already existed but was effectively dead — its nav
links were commented out in `NavBar.vue`, **and its route was registered
at `/match`, silently shadowed by Match Scouting's identical `/match`
route.** Both are fixed as part of this work: the route moved to
`/match-preview`, and the nav links were uncommented. The old per-alliance
"highlights" stat tile was removed — it never actually rendered anything,
since its data source (`getAllianceOverview`'s `highlightColumns`) is an
empty stub — along with the now-dead `teamsData` aggregation, `queryEventData`/`aggregateData`
calls, and `allianceHighlights`/`getTeamNumbers` methods that fed it.

Each alliance tile (Red/Blue) has an "Auto Path Preview" sub-tile:
- A color swatch next to each team-selector dropdown too (not just the
  auto-path row), so it's easy to see at a glance which color belongs to
  which teammate slot.
- Two dropdowns per teammate slot: which of that team's saved auto paths
  to preview (populated via `fetchTeamAutoPaths`, refreshed whenever that
  slot's team changes; each option's text is prefixed with the team
  number, e.g. `"973 - Left Corner Auto"`), and which side (left/right) to
  preview it as. Picking a team pre-selects their **default** auto (see
  above) instead of "No Auto Selected"; picking an auto path resets the
  side dropdown to that path's own recorded side, which can then be
  flipped independently.
- A single `AutoPathCanvas` in overlay (`layers`) mode draws all three
  selected paths on one field. Side is applied via `transformPath` (the
  one legitimate use of it outside the card); the tile's fixed
  `display-alliance` ("red" or "blue") alone places all three consistently
  on that alliance, even if a given path was originally recorded under the
  other alliance.
- Each slot keeps a stable color *within* its own alliance tile, but the
  two tiles use **separate palettes** (`autoPathSlotColorsRed` /
  `autoPathSlotColorsBlue` in `MatchPreviewView.vue`) rather than one
  shared-by-position palette: paths cluster near their own tile's wall, and
  blue/purple read poorly against the field art's blue tower on the Blue
  tile, so that tile swaps in orange/green/magenta instead. This means a
  slot's color is no longer guaranteed to match between the Red and Blue
  tiles — a deliberate readability trade-off.

---

## Verification

- `npm run type-check` and `npm run build` pass after every change in this
  doc.
- Both migrations were pushed to the linked Supabase project via
  `supabase db push --linked` and confirmed applied with
  `supabase migration list` (no Docker daemon was available in this
  environment to run `supabase db diff` locally beforehand — the SQL was
  instead hand-reviewed against the existing `PitData`/`PickList`
  migrations for syntax before pushing).
- **Not done:** live browser verification through the Claude-in-Chrome
  extension (it wasn't connected in this environment) — the user tested
  interactively in their own browser instead, which is how the bugs fixed
  above (alliance flip canceling out, the Match Preview crash on an event
  with no match data, the dead stat tile) were actually found. Still worth
  a manual pass before considering this fully done: pointer/touch drawing
  feel on a real mobile device in particular hasn't been confirmed by
  either party yet.

**Timing (issue #35)** was verified live via Claude-in-Chrome: drew a path
with deliberately slow-then-fast pacing, confirmed the saved `t`s were
monotonic `[0,1]` and matched the drawn pacing, confirmed a handle drag
persisted correctly, and confirmed scrub/play both landed the marker at the
expected point via `markerAtTime`. Also confirmed two pre-existing
(`t`-less) saved paths still load and play without error under the
even-spacing fallback. One caveat found along the way: dispatching
synthetic `PointerEvent`s with a fabricated `pointerId` from a JS console
(as opposed to real input, or the browser-automation tool's own drag
action) throws inside `setPointerCapture()`, silently aborting the
drag-start handler — real user input never hits this, so it's a testing
artifact rather than a product bug, but worth knowing if you reach for the
same shortcut later.

A later pass fixed the `rescaleRange()` double-processing bug described
above (the boundary's saved `t` didn't match where it was dragged to) and
re-verified it two ways: a standalone numeric replay of `dragHandleTo`'s
exact logic against known before/after values (no browser needed), and live
via Claude-in-Chrome — drew a 12-point path (the drawing tool's synthetic
clicks each register as two points, pointerdown + a same-position
pointermove — harmless, just denser than a real single click, and not
something worth "fixing" since real input isn't affected), dragged an
interior bound to a specific target time, saved, and confirmed via
`supabase db query --linked` that the persisted point's `t` matched the
drag target exactly. The same session also confirmed, by reading the live
Vue component's `fill` style during playback against an independent
recompute of `pathTimeColor(rankAtTime(...))`, that the marker's color
stays exactly in sync with the timeline/canvas rainbow at every instant —
this was checked specifically because the CSS-transition marker-smoothing
approach mentioned above had briefly broken that sync before being reverted
in favor of the `MIN_REGION_T` fix.

## Future work

- Per-path thumbnail caching if the auto-path list grows long enough that
  re-rendering N inline SVGs becomes a visible cost.
- Undo (not just full Reset) while drawing.
- Re-measure `FIELD_BOUNDS` if `2026-field.png` is ever swapped for a
  corrected or higher-res export.
- The timeline's drag/double-click handle interactions haven't been
  confirmed on a real touch device — `touch-action: none` is set, but
  double-tap-to-add/remove in particular may need real hardware to
  validate (see the `setPointerCapture` caveat above for why simulating
  this from a script isn't reliable).
