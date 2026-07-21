# Pick List Feature

## Requirements

* Members shall be able to make their own pick lists on their accounts  
* Leads shall be able to view aggregation of all user picklists (democratic picklist)  
* Leads shall be able to maintain a “team picklist” which is the official picklist for the team.   
  * There is only 1 team picklist, and the leads can collaborate on it  
* The picklist should be a compact list view of rows containing team number, team name, and a robot picture. If a user taps/clicks on the row, the view should expand to show a bigger version of the robot picture, and any stats / scout comments about the team.  
  * The stats/comments should come from match scouting and pit scouting.  
  * Any comments should be attributed to the user who commented on the team so they can be asked for any clarification

## Overview

The Pick List feature allows scouts and lead members to collaboratively rank teams attending the active event. It includes three views:

| Tab | Who can edit | Description |
|---|---|---|
| **My List** | All logged-in members | Each user's personal ranking of event teams |
| **Democratic** | Read-only | Computed aggregate of all personal lists |
| **Team List** | Leads & Admins only | Official shared team ranking |

---

## User Guide

### Accessing the Pick List

Navigate to **Pick List** in the nav bar (or go to `/picklist`). You must be logged in.

### Reordering Teams

On the **My List** or **Team List** tab, drag the `⠿` handle on the left of any row to change that team's rank. Click **Save List** when finished.

### Expanding a Team Row

Tap or click any team row to expand it. The expanded view shows:
- A full-size robot photo (if one has been uploaded)
- Aggregated match stats (averages and max values from scouting data)
- All scout comments from both match scouting and pit scouting, each attributed to the scout who wrote it

### Saving

Click the **Save List** button at the top-right of the list. If you are offline, the save is enqueued locally (see [Offline Behaviour](#offline-behaviour)).

### Democratic View

The democratic tab shows a read-only ranking computed from all personal lists submitted so far. Teams are ranked by their aggregate score: each list contributes `(list_length - rank)` points per team. Higher score = higher democratic ranking.

### Resetting the Team List from Democratic Results

On the **Team List** tab, leads/admins can click **↺ Reset from Democratic** to overwrite the current team list with the current democratic ranking as a starting point, then continue reordering from there. This immediately saves — it's a real overwrite, not a staged draft — so use it when you want to discard the team list's current order, not to preview the democratic results. The button is disabled when no personal lists have been submitted yet (nothing to copy).

---

## Offline Behaviour

GreyScout is designed to be usable in low-connectivity environments (e.g. competition pit areas with poor WiFi).

- When the device goes offline, a **banner** appears below the nav bar.
- Saving a pick list while offline **enqueues the save** in `localStorage` under the key `greyscout_offline_queue`.
- A **floating action button (FAB)** in the bottom-right corner shows the count of pending items.
- Clicking the FAB opens a drawer where each queued item can be retried individually or all at once.
- Items are retried automatically when the browser regains connectivity (via the **Retry All** button — the user still clicks it manually to confirm).

---

## Roles

| Role | Personal list | Democratic view | Team list |
|---|---|---|---|
| `observer` | ❌ hidden | ❌ hidden | ❌ hidden |
| `member` | ✅ read/write | ✅ read | ❌ hidden |
| `lead` | ✅ read/write | ✅ read | ✅ read/write |
| `admin` | ✅ read/write | ✅ read | ✅ read/write |

Roles are stored in the `User` table under the `role` column (see [users.md](./users.md)). Observers cannot see the pick list at all — the whole feature is hidden for that role.

---

## Database Schema

### `PickList` table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK, default `gen_random_uuid()`) | |
| `user_id` | `uuid` | Nullable for team list |
| `event_id` | `text` | e.g. `"2025cafr"` |
| `type` | `text` | `"personal"` or `"team"` |
| `team_numbers` | `integer[]` | Ordered list of team numbers |
| `created_at` | `timestamptz` | Default `now()` |
| `updated_at` | `timestamptz` | Updated on each save |

**Unique constraints:**
- `(user_id, event_id, type)` for personal lists
- `(event_id, type)` for the team list

**Recommended RLS policies:**
- `SELECT`: authenticated users can read all rows
- `INSERT/UPDATE`: user can only write rows where `user_id = auth.uid()` (personal) or `role IN ('lead','admin')` (team)

### `User` table

See [users.md](./users.md) for the full `User` table schema, roles, and role-management rules.

---

## Source Files

| File | Purpose |
|---|---|
| [`src/views/PicklistView.vue`](../src/views/PicklistView.vue) | Main picklist page — tabs, draggable list, expand/collapse |
| [`src/stores/picklist-store.ts`](../src/stores/picklist-store.ts) | Pinia store: list state, CRUD actions, democratic computation |
| [`src/lib/picklist-query.ts`](../src/lib/picklist-query.ts) | All Supabase queries for the picklist feature |
| [`src/stores/offline-queue-store.ts`](../src/stores/offline-queue-store.ts) | Persistent offline save queue (localStorage) |
| [`src/components/OfflineQueue.vue`](../src/components/OfflineQueue.vue) | Global offline banner + FAB + retry drawer |
| [`src/stores/auth-store.ts`](../src/stores/auth-store.ts) | Expanded with `role`, `userId`, `isLead`, `isAdmin` |

---

## Future Work

- **Auto-retry on reconnect**: currently manual; could auto-trigger using `window.addEventListener('online', ...)` in the store.
- **Conflict resolution**: if two leads edit the team list simultaneously, the last save wins. A version/timestamp check could detect conflicts.
- **Notes per team**: add a per-team free-text notes field to the picklist entry.
- **Export**: allow leads to export the team picklist as a CSV or printable sheet.
