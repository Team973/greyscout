<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted, onUnmounted } from 'vue';
import draggable from 'vuedraggable';
import Papa from 'papaparse';
import { usePicklistStore } from '@/stores/picklist-store';
import { useAuthStore } from '@/stores/auth-store';
import { useEventStore } from '@/stores/event-store';
import { useOfflineQueueStore } from '@/stores/offline-queue-store';
import { TIER_GROUPS } from '@/lib/picklist-query';
import PicklistRow from '@/components/PicklistRow.vue';

const picklistStore = usePicklistStore();
const authStore = useAuthStore();
const eventStore = useEventStore();
const queueStore = useOfflineQueueStore();

// Which row is expanded
const expandedTeam = ref<number | null>(null);
const expandedData = ref<{ stats: unknown[]; comments: unknown[] } | null>(null);
const expandedLoading = ref(false);

const isOnline = ref(navigator.onLine);
window.addEventListener('online', () => { isOnline.value = true; });
window.addEventListener('offline', () => { isOnline.value = false; });

// ─── Drag autoscroll ────────────────────────────────────────────────────────────
// vuedraggable/Sortable's built-in autoscroll only supports a flat scroll speed
// once the pointer enters the sensitivity zone, which overshoots and is hard to
// control. This runs a self-contained autoscroll loop instead, driven off the
// standard @start/@end drag events: while dragging, track the pointer's Y
// position and scroll the page every animation frame at a speed proportional to
// how far past the deadband (edge-activation zone) the pointer is.
//
// The whole SPA scrolls inside #app (position: fixed + overflow: auto in
// main.css), not the window/document, so window.scrollBy is a silent no-op here
// — the actual scroll container has to be looked up and scrolled directly.
const AUTOSCROLL_SENSITIVITY = 80; // deadband: no scroll within this many px of the viewport edge
const AUTOSCROLL_MIN_SPEED = 8; // px/frame right at the deadband boundary, so it's usable immediately
const AUTOSCROLL_MAX_SPEED = 90; // px/frame right at the true edge

let dragPointerY = null;
let autoscrollRafId = null;
let autoscrollContainer = null;

function getScrollContainer() {
    return document.getElementById('app') || document.scrollingElement || document.documentElement;
}

function trackDragPointer(evt) {
    const point = evt.touches ? evt.touches[0] : evt;
    dragPointerY = point.clientY;
}

// depth: 0 at the deadband boundary, 1 at the true edge.
function speedForDepth(depth) {
    return AUTOSCROLL_MIN_SPEED + (AUTOSCROLL_MAX_SPEED - AUTOSCROLL_MIN_SPEED) * depth;
}

function autoscrollTick() {
    if (dragPointerY != null && autoscrollContainer) {
        const distFromTop = dragPointerY;
        const distFromBottom = window.innerHeight - dragPointerY;

        let speed = 0;
        if (distFromTop < AUTOSCROLL_SENSITIVITY) {
            speed = -speedForDepth(1 - Math.max(0, distFromTop) / AUTOSCROLL_SENSITIVITY);
        } else if (distFromBottom < AUTOSCROLL_SENSITIVITY) {
            speed = speedForDepth(1 - Math.max(0, distFromBottom) / AUTOSCROLL_SENSITIVITY);
        }

        if (speed !== 0) {
            autoscrollContainer.scrollBy(0, speed);
        }
    }
    autoscrollRafId = requestAnimationFrame(autoscrollTick);
}

function onDragStart() {
    dragPointerY = null;
    autoscrollContainer = getScrollContainer();
    document.addEventListener('pointermove', trackDragPointer);
    document.addEventListener('touchmove', trackDragPointer, { passive: true });
    document.addEventListener('mousemove', trackDragPointer);
    autoscrollRafId = requestAnimationFrame(autoscrollTick);
}

function onDragEnd() {
    document.removeEventListener('pointermove', trackDragPointer);
    document.removeEventListener('touchmove', trackDragPointer);
    document.removeEventListener('mousemove', trackDragPointer);
    if (autoscrollRafId != null) {
        cancelAnimationFrame(autoscrollRafId);
        autoscrollRafId = null;
    }
    dragPointerY = null;
    autoscrollContainer = null;
}

onUnmounted(onDragEnd);

// ─── Computed helpers ──────────────────────────────────────────────────────────

const isLead = computed(() => authStore.isLead);
const isObserver = computed(() => authStore.isObserver);
const userId = computed(() => authStore.currentUserId);
const eventId = computed(() => eventStore.eventId);

const activeTab = computed({
    get: () => picklistStore.activeTab,
    set: (v) => picklistStore.setTab(v)
});

const isEditable = computed(() =>
    (activeTab.value === 'personal') ||
    (activeTab.value === 'team' && isLead.value)
);

// Vote (tier) stats are only meaningful once more than one person's ranking
// is in play — shown on the Team tab (leads deciding) and the Democratic tab.
const showVoteStats = computed(() => activeTab.value !== 'personal');

// The picked checkbox reflects real-world alliance selection. It's only
// shown (and only ever editable) on the official Team tab — not on a
// scout's own personal draft ranking, and not on the read-only Democratic
// aggregate.
const showPickedCheckbox = computed(() => activeTab.value === 'team');

const hasDemocraticVotes = computed(() => Object.keys(picklistStore.teamTierStats).length > 0);

// ─── Loading ───────────────────────────────────────────────────────────────────

onMounted(async () => {
    await authStore.checkUser();
    if (isObserver.value) return;
    await eventStore.updateEvent();
    await picklistStore.loadAll(eventId.value, userId.value, isLead.value);
});

// ─── Expand / collapse row ────────────────────────────────────────────────────

async function toggleExpand(teamNumber: number) {
    if (expandedTeam.value === teamNumber) {
        expandedTeam.value = null;
        expandedData.value = null;
        return;
    }
    expandedTeam.value = teamNumber;
    expandedData.value = null;
    expandedLoading.value = true;

    expandedData.value = await picklistStore.getTeamData(teamNumber, eventId.value);
    expandedLoading.value = false;
}

// ─── Picked toggle ─────────────────────────────────────────────────────────────

async function togglePicked(teamNumber: number) {
    if (!isLead.value) return;
    await picklistStore.togglePicked(eventId.value, teamNumber);
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function saveList() {
    let success = false;

    if (activeTab.value === 'personal' && userId.value) {
        success = await picklistStore.savePersonalList(userId.value, eventId.value);
        if (!success) {
            // Enqueue for later
            queueStore.enqueue('picklist_personal', {
                userId: userId.value,
                eventId: eventId.value,
                teamNumbers: picklistStore.personalFlatOrder,
                teamTiers: picklistStore.personalTiersMap
            }, picklistStore.lastSaveError ?? undefined);
        }
    } else if (activeTab.value === 'team' && isLead.value) {
        success = await picklistStore.saveTeamList(eventId.value);
        if (!success) {
            queueStore.enqueue('picklist_team', {
                eventId: eventId.value,
                teamNumbers: picklistStore.teamFlatOrder,
                teamTiers: picklistStore.teamTiersMap
            }, picklistStore.lastSaveError ?? undefined);
        }
    }
}

// ─── Refresh Democratic ───────────────────────────────────────────────────────

const isRefreshingDemocratic = ref(false);
async function refreshDemocratic() {
    isRefreshingDemocratic.value = true;
    await picklistStore.loadDemocraticList(eventId.value);
    isRefreshingDemocratic.value = false;
}

// ─── Reset Team List from Democratic ──────────────────────────────────────────

async function resetTeamFromDemocratic() {
    picklistStore.resetTeamListFromDemocratic();
    await saveList();
}

// ─── Export ───────────────────────────────────────────────────────────────────

function exportTeamListCsv() {
    const rows: Record<string, unknown>[] = [];
    let rank = 0;
    TIER_GROUPS.forEach((group) => {
        (picklistStore.teamTierSections[group] ?? []).forEach((teamNumber) => {
            const team = picklistStore.teamMap[teamNumber];
            if (!team) return;
            rank += 1;
            rows.push({
                rank,
                tier: group,
                team_number: team.team_number,
                name: team.name,
                picked: picklistStore.isTeamPicked(teamNumber)
            });
        });
    });

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `team-picklist-${eventId.value}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ─── Tier stats (Democratic / Team tabs) ──────────────────────────────────────

function tierStatsFor(teamNumber: number) {
    return picklistStore.teamTierStats[teamNumber] ?? null;
}

function tierGroupLabel(group: string) {
    return group === 'Unranked' ? 'Unranked' : group;
}

// The orange number is the overall rank across the whole list, not a
// per-tier count — so it keeps climbing across tier section boundaries.
function groupRankOffset(group: string) {
    const sections = picklistStore.activeSections;
    let offset = 0;
    for (const g of TIER_GROUPS) {
        if (g === group) break;
        offset += (sections[g] ?? []).length;
    }
    return offset;
}
</script>

<template>
    <div class="main-content">
        <div class="picklist-page" v-if="isObserver">
            <div class="picklist-empty">
                <div class="picklist-empty-icon">🔒</div>
                <h2>Not available</h2>
                <p>Observers do not have access to the pick list.</p>
            </div>
        </div>
        <div class="picklist-page" v-else>
            <!-- Page header -->
            <div class="picklist-header">
                <h1>Pick List</h1>
                <div class="picklist-event-name">{{ eventStore.eventName }}</div>
            </div>

            <!-- Tab bar -->
            <div class="picklist-tabs" role="tablist">
                <button id="tab-personal" class="picklist-tab" :class="{ 'picklist-tab--active': activeTab === 'personal' }"
                    role="tab" :aria-selected="activeTab === 'personal'" @click="activeTab = 'personal'">
                    My List
                </button>
                <button v-if="isLead" id="tab-democratic" class="picklist-tab"
                    :class="{ 'picklist-tab--active': activeTab === 'democratic' }" role="tab"
                    :aria-selected="activeTab === 'democratic'" @click="activeTab = 'democratic'">
                    Democratic
                </button>
                <button v-if="isLead" id="tab-team" class="picklist-tab"
                    :class="{ 'picklist-tab--active': activeTab === 'team' }" role="tab"
                    :aria-selected="activeTab === 'team'" @click="activeTab = 'team'">
                    Team List
                </button>
            </div>

            <!-- Tab description -->
            <div class="picklist-tab-description">
                <span v-if="activeTab === 'personal'">Your personal tier ranking. Drag rows between tiers or reorder
                    within a tier, then save.</span>
                <span v-else-if="activeTab === 'democratic'">Aggregated tier ranking from all scouts' personal lists
                    (read-only).</span>
                <span v-else>Official team pick list — only leads can edit. Drag between tiers, then save.</span>
            </div>

            <!-- Loading state -->
            <div v-if="!picklistStore.teamsLoaded" class="picklist-loading">
                <div class="picklist-spinner"></div>
                <span>Loading teams…</span>
            </div>

            <!-- Empty state -->
            <div v-else-if="picklistStore.allTeams.length === 0" class="picklist-empty">
                <div class="picklist-empty-icon">🤖</div>
                <h2>No teams found</h2>
                <p>No team data is available for the current event.</p>
            </div>

            <!-- List -->
            <div v-else class="picklist-list-wrapper">
                <!-- Save / status bar -->
                <div class="picklist-save-bar" v-if="isEditable">
                    <button v-if="activeTab === 'team'" id="btn-reset-democratic" class="picklist-reset-btn"
                        :disabled="picklistStore.isSaving || !hasDemocraticVotes"
                        title="Overwrite the team list with the current democratic tier grouping" @click="resetTeamFromDemocratic">
                        ↺ Reset from Democratic
                    </button>
                    <button v-if="activeTab === 'team'" id="btn-export-team-csv" class="picklist-reset-btn"
                        title="Download the current team pick list as a CSV" @click="exportTeamListCsv">
                        ⬇ Export CSV
                    </button>
                    <transition name="fade">
                        <span v-if="picklistStore.lastSaveSuccess" class="save-status save-status--ok">
                            ✓ Saved
                        </span>
                        <span v-else-if="picklistStore.lastSaveError" class="save-status save-status--err">
                            ⚠ Save failed — queued for retry
                        </span>
                    </transition>
                    <button id="btn-save-picklist" class="picklist-save-btn" :disabled="picklistStore.isSaving"
                        @click="saveList">
                        {{ picklistStore.isSaving ? 'Saving…' : 'Save List' }}
                    </button>
                </div>

                <!-- Democratic bar -->
                <div class="picklist-save-bar" v-else-if="activeTab === 'democratic'">
                    <button id="btn-refresh-democratic" class="picklist-save-btn" :disabled="isRefreshingDemocratic"
                        @click="refreshDemocratic">
                        <span v-if="isRefreshingDemocratic">Refreshing…</span>
                        <span v-else>↻ Refresh</span>
                    </button>
                </div>

                <!-- Democratic hint -->
                <div v-if="activeTab === 'democratic' && !hasDemocraticVotes" class="picklist-empty">
                    <p>No personal lists have been submitted yet — submit yours on the "My List" tab first.</p>
                </div>

                <!-- Tier-grouped sections -->
                <div v-else class="tier-sections">
                    <div v-for="group in TIER_GROUPS" :key="group" class="tier-section">
                        <div class="tier-section-header" :class="`tier-section-header--${group}`">
                            <span class="tier-section-name">{{ tierGroupLabel(group) }}</span>
                            <span class="tier-section-count">{{ (picklistStore.activeSections[group] || []).length }}</span>
                        </div>

                        <!-- Editable: draggable within and across tier sections -->
                        <draggable v-if="isEditable" :list="picklistStore.activeSections[group]" group="picklist"
                            :item-key="(el) => el" handle=".picklist-drag-handle" animation="200"
                            ghost-class="picklist-row--ghost" :force-fallback="true" :scroll="false"
                            class="tier-section-body" @start="onDragStart" @end="onDragEnd" @change="saveList">
                            <template #item="{ element: teamNumber, index }">
                                <PicklistRow :row-id="`picklist-team-${teamNumber}`" :team="picklistStore.teamMap[teamNumber]"
                                    :position="groupRankOffset(group) + index + 1" :show-drag-handle="true" :show-vote-stats="showVoteStats"
                                    :tier-stats="tierStatsFor(teamNumber)" :show-picked="showPickedCheckbox"
                                    :is-picked="picklistStore.isTeamPicked(teamNumber)"
                                    :can-toggle-picked="isLead" :expanded="expandedTeam === teamNumber"
                                    :expanded-data="expandedData" :expanded-loading="expandedLoading"
                                    @toggle-expand="toggleExpand(teamNumber)" @toggle-picked="togglePicked(teamNumber)" />
                            </template>
                        </draggable>

                        <!-- Read-only (democratic tab) -->
                        <div v-else class="tier-section-body tier-section-body--static">
                            <PicklistRow v-for="(teamNumber, index) in picklistStore.activeSections[group]" :key="teamNumber"
                                :row-id="`picklist-team-demo-${teamNumber}`" :team="picklistStore.teamMap[teamNumber]"
                                :position="groupRankOffset(group) + index + 1" :show-drag-handle="false" :show-vote-stats="showVoteStats"
                                :tier-stats="tierStatsFor(teamNumber)" :show-picked="showPickedCheckbox"
                                :is-picked="picklistStore.isTeamPicked(teamNumber)"
                                :can-toggle-picked="isLead" :expanded="expandedTeam === teamNumber"
                                :expanded-data="expandedData" :expanded-loading="expandedLoading"
                                @toggle-expand="toggleExpand(teamNumber)" @toggle-picked="togglePicked(teamNumber)" />
                        </div>

                        <div v-if="(picklistStore.activeSections[group] || []).length === 0" class="tier-section-empty">
                            {{ isEditable ? 'Drag teams here' : 'No teams in this tier' }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.picklist-page {
    max-width: 860px;
    margin: 0 auto;
}

/* ── Header ── */
.picklist-header {
    display: flex;
    align-items: baseline;
    gap: 16px;
    margin-bottom: 4px;
    flex-wrap: wrap;
}

.picklist-event-name {
    font-size: 14px;
    color: rgba(128, 128, 128, 0.8);
    font-style: italic;
}

/* ── Tabs ── */
.picklist-tabs {
    display: flex;
    gap: 4px;
    border-bottom: 2px solid rgba(128, 128, 128, 0.2);
    margin-bottom: 4px;
}

.picklist-tab {
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
    padding: 10px 20px;
    font-size: 15px;
    font-weight: 500;
    color: var(--primary-text-color);
    cursor: pointer;
    border-radius: 6px 6px 0 0;
    transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.picklist-tab:hover {
    background: rgba(176, 87, 3, 0.1);
    color: #b05703;
}

.picklist-tab--active {
    border-bottom-color: #b05703;
    color: #b05703;
    font-weight: 700;
}

.picklist-tab-description {
    font-size: 13px;
    color: rgba(128, 128, 128, 0.75);
    min-height: 20px;
    margin-bottom: 16px;
}

/* ── Loading ── */
.picklist-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 60px 0;
    color: rgba(128, 128, 128, 0.8);
    font-size: 15px;
}

.picklist-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(176, 87, 3, 0.2);
    border-top-color: #b05703;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ── Empty ── */
.picklist-empty {
    text-align: center;
    padding: 60px 0;
    color: rgba(128, 128, 128, 0.8);
}

.picklist-empty-icon {
    font-size: 52px;
    margin-bottom: 12px;
}

/* ── Save bar ── */
.picklist-save-bar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    margin-bottom: 12px;
}

.save-status {
    font-size: 13px;
    font-weight: 600;
}

.save-status--ok {
    color: #3a9e3a;
}

.save-status--err {
    color: #b05703;
}

.picklist-save-btn {
    background: #b05703;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 9px 22px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
    box-shadow: 0 2px 8px rgba(176, 87, 3, 0.3);
}

.picklist-save-btn:hover:not(:disabled) {
    background: #cd8900;
    transform: translateY(-1px);
}

.picklist-save-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
}

.picklist-reset-btn {
    background: none;
    color: #b05703;
    border: 1.5px solid #b05703;
    border-radius: 8px;
    padding: 7.5px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    margin-right: auto;
}

.picklist-reset-btn:hover:not(:disabled) {
    background: rgba(176, 87, 3, 0.1);
}

.picklist-reset-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

/* ── Tier sections ── */
.tier-sections {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.tier-section {
    display: flex;
    flex-direction: column;
}

.tier-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    margin-bottom: 8px;
    border-left: 4px solid rgba(128, 128, 128, 0.4);
}

.tier-section-name {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--primary-text-color);
}

.tier-section-count {
    font-size: 12px;
    font-weight: 600;
    color: rgba(128, 128, 128, 0.7);
    background: rgba(128, 128, 128, 0.12);
    border-radius: 20px;
    padding: 1px 8px;
}

.tier-section-header--S {
    border-left-color: #d4a017;
}

.tier-section-header--A {
    border-left-color: #3a9e3a;
}

.tier-section-header--B {
    border-left-color: #3a78c8;
}

.tier-section-header--C {
    border-left-color: #8c64c8;
}

.tier-section-header--D {
    border-left-color: #b05703;
}

.tier-section-header--DNP {
    border-left-color: #c83c3c;
}

.tier-section-header--Unranked {
    border-left-color: rgba(128, 128, 128, 0.4);
}

.tier-section-body {
    display: flex;
    flex-direction: column;
    min-height: 50px;
}

.tier-section-empty {
    font-size: 12px;
    color: rgba(128, 128, 128, 0.55);
    font-style: italic;
    text-align: center;
    padding: 10px;
    border: 1.5px dashed rgba(128, 128, 128, 0.25);
    border-radius: 10px;
    margin-top: -4px;
}

/* ── Transitions ── */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
