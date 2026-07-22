---
name: scouting-app-dev
description: Conventions and workflow for developing GreyScout, Team 973's FRC scouting web app (Vue 3 + Pinia + Supabase, with a Python/Poetry util/ toolkit for TBA sync). Use for any feature work, bug fixes, or schema changes in this repo.
---

# GreyScout development

FRC Team 973's scouting app: match scouting, pit scouting, team analysis, and
a drag-and-drop pick list. Frontend is Vue 3 (mostly Options API, some
`<script setup>`) + Pinia + Vue Router, backed by Supabase (Postgres, RLS,
Storage). A separate `util/` directory is a Python/Poetry toolkit that syncs
event/team/robot-photo data from The Blue Alliance into Supabase.

## Workflow rules

- **Only commit when the user explicitly says "commit this"** (or equivalent).
  Never commit proactively after finishing a task — report what changed and
  wait.
- **Only push when the user explicitly says "push it"** (or equivalent), even
  if a commit was just made. Each push needs its own explicit go-ahead.
- Before considering a frontend change done: run `npm run type-check` and
  `npm run build`, then revert the build output — it's git-tracked:
  `git checkout -- dist/ && git clean -fd dist/`.
- For UI changes, live-test with the claude-in-chrome browser tools rather
  than just trusting the build: log in, navigate, screenshot, verify, then
  log out. Test account: `test@greybots.com` / `test973` (role: member).
  There's also a live dev server (`npm run dev`, port 5173) with HMR — edits
  via the Edit tool land in the running page automatically, no rebuild needed
  for live testing.
- If Chrome is genuinely shared with the user's own testing session (they'll
  say so explicitly), be more cautious with login/logout cycles and
  destructive drag-and-drop tests against real data — ask if unsure, unless
  they've said it's fine to disrupt their session.
- Never test destructive or reordering UI actions against the real/default
  production event's Team List or other shared data without checking first —
  prefer a personal list, a test account, or confirming with the user.

## Data model conventions

- Scouting forms (`src/lib/2026/match-scouting-form.ts`,
  `src/lib/2026/pit-scouting-form.ts`) return an array of
  `{ key, name, components: [{ key, label, type, options, defaultValue,
  value, required, error }] }`. `parseScoutData()` in
  `src/lib/data-submission.ts` flattens this to
  `db_data[section.key + "_" + component.key] = value` for the DB insert.
  `validateForm()` in the same file handles required-field validation per
  component `type` (text/textarea, radio, number, dropdown) — a component
  type that doesn't have a validation branch there silently never blocks
  submission.
- Every shared input component (`TextInput.vue`, `TextAreaInput.vue`,
  `Dropdown.vue`, `RadioButtons.vue`, `Number.vue`) needs both a `required`
  and an `error` prop wired through to the underlying `md-*` element for
  required-field styling/validation to actually show — adding `required` to
  a form schema entry does nothing visually if the component itself doesn't
  accept/forward that prop.
- Form submissions are tied to the submitting user via `scouted_by`
  (`auth.uid()` default) rather than a free-text scout-name field — pull the
  scout's display name from the `User` table via that FK when attributing
  comments/data.
- Match/pit scouting submissions use the offline-first pattern: on submit
  failure, the payload goes into `useOfflineQueueStore`'s localStorage-backed
  queue (`greyscout_offline_queue`), retryable later via the `OfflineQueue.vue`
  FAB/drawer. Reuse this pattern (not QR codes or other ad hoc mechanisms)
  for any new offline-capable submission flow.
- When surfacing a Supabase error to the UI, use `error.message` — Supabase
  errors are plain objects (not `Error` instances), so `String(error)`
  produces `"[object Object]"`.

## Supabase schema changes

- Source of truth is the declarative schema at
  `supabase/database/schemas/prod.sql`, with generated migrations.
- `supabase db diff` (non-linked) replays local migrations and is reliable
  for syntax validation.
- `supabase db diff --linked` has a known stale pg-delta catalog cache bug
  and can report "No schema changes found" even when there are real diffs —
  **never trust it alone**. Cross-verify against the live database directly:
  `supabase db query --linked` against `information_schema.columns` /
  `information_schema.tables`.
- `supabase db push --linked` always prints a non-fatal
  "failed to cache migrations catalog" pgdelta cert error at the end — this
  is expected noise, not a real failure.
- `supabase migration repair --status applied/reverted <version> --linked`
  reconciles migration-history bookkeeping when it drifts from what's
  actually applied.
- Check whether a table already has real data before editing its schema —
  `db diff` can show a destructively-looking DROP/CREATE against live rows
  even when the intent is additive. If real season data is present, prefer
  renaming/archiving over drop-and-recreate.

## Known gotchas

- **The whole app scrolls inside `#app`, not the window.** `main.css` sets
  `#app { position: fixed; overflow: auto; }`, so `window.scrollBy()` /
  `document.scrollingElement` are silent no-ops. Any custom scroll logic
  (autoscroll, scroll-to-element, etc.) must target
  `document.getElementById('app')` (with a `document.scrollingElement` /
  `document.documentElement` fallback) instead of the window.
- vuedraggable/SortableJS's built-in autoscroll (`scroll-speed`,
  `scroll-sensitivity`, `scroll-fn` options) is unreliable in this app —
  a `scroll-fn` override was tried and silently did nothing in practice.
  The working pattern is a fully self-contained autoscroll: disable the
  built-in one (`:scroll="false"`), drive a `requestAnimationFrame` loop off
  the documented `@start`/`@end` events, track pointer position via
  `document`-level `pointermove`/`touchmove`/`mousemove` listeners, and
  scroll the real container (`#app`, see above) directly. See
  `src/views/PicklistView.vue` for the reference implementation.
- Browser automation (`left_click_drag`, synthetic `dispatchEvent` sequences)
  does not reliably reproduce real held-drag physics for SortableJS —
  it's fine for confirming a drag reorder *works*, but not for validating
  autoscroll speed/feel. A rapid loop of synthetic mouse events dispatched
  via `javascript_tool` can also stall/freeze the tab (seen once when
  simulating a long held drag) — keep synthetic drag scripts short, and get
  the user to confirm real-device feel for anything speed/timing-sensitive.
- `util/private_credentials.json` must **never** be tracked in git — it's
  gitignored; don't remove that pattern, and never print its contents.

## Python util toolkit (`util/`)

- Poetry-managed (`poetry run python util/main.py --mode event|offline|photos`).
- `robot_photos.py` syncs TBA robot photos: only TBA's `imgur` media type is
  a reliable direct image URL (`avatar` is a team icon, `youtube` is video,
  `cd-thread` is a forum link, not an image). Images are resized/compressed
  with Pillow before upload to Supabase Storage, uploaded with
  `cache-control` + `upsert: true`.
- Inline `python -c "..."` one-liners via Bash can silently produce no
  output on this Windows/git-bash environment — write a script file and run
  it with `poetry run python <file>.py` instead.

## CSV import/export

- CSV parsing (Data Upload) uses `papaparse` with `skipEmptyLines: true`
  (a trailing blank line from Excel/Sheets exports otherwise produces a
  null-filled row that fails a not-null constraint on the whole batch).
- CSV export uses `Papa.unparse()` + a `Blob`/temporary `<a download>` link
  — see `exportTeamListCsv()` in `src/views/PicklistView.vue` for the
  pattern.
