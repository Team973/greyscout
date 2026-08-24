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
| `path` | `jsonb` | Array of `{ x, y }` points, each in `[0, 1]`, in the frame described below |
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
| [`src/components/AutoPathCanvas.vue`](../src/components/AutoPathCanvas.vue) | The field SVG, background image is `src/assets/2026-field.png`. Two modes: single editable/viewable path (`points`/`color` props), or a read-only multi-path overlay (`layers` prop: `[{ key, points, color }]`) used by Match Preview. Drawing uses Pointer Events (`touch-action: none`) so mouse, touch, and pen all work the same way. |
| [`src/components/AutoPathEditor.vue`](../src/components/AutoPathEditor.vue) | Create/edit form: name, alliance/side dropdowns, the canvas, Reset/Save/Cancel/Delete. Reuses `submitScoutData`/`updateScoutData` from `data-submission.ts` (same as pit scouting) so a failed save enqueues into the existing offline-queue FAB instead of a bespoke path. |
| [`src/components/AutoPathCard.vue`](../src/components/AutoPathCard.vue) | Read-only list card for Team Analysis: renders a saved path plus an alliance/side "view as" toggle (backed by `transformPath`), a default-auto badge/button, and an Edit button. |
| [`src/lib/2026/auto-path-field.ts`](../src/lib/2026/auto-path-field.ts) | `transformPath()`, plus the alliance/side dropdown choice lists. |
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

## Future work

- Per-path thumbnail caching if the auto-path list grows long enough that
  re-rendering N inline SVGs becomes a visible cost.
- Undo (not just full Reset) while drawing.
- Re-measure `FIELD_BOUNDS` if `2026-field.png` is ever swapped for a
  corrected or higher-res export.
