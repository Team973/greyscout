<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted, watch } from 'vue';
import draggable from 'vuedraggable';
import { usePicklistStore } from '@/stores/picklist-store';
import { useAuthStore } from '@/stores/auth-store';
import { useEventStore } from '@/stores/event-store';
import { useOfflineQueueStore } from '@/stores/offline-queue-store';

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

// ─── Computed helpers ──────────────────────────────────────────────────────────

const isLead = computed(() => authStore.isLead);
const isObserver = computed(() => authStore.isObserver);
const userId = computed(() => authStore.currentUserId);
const eventId = computed(() => eventStore.eventId);

const activeTab = computed({
    get: () => picklistStore.activeTab,
    set: (v) => picklistStore.setTab(v)
});

// Draggable list binding — sync back into the store on change
const draggablePersonal = computed({
    get: () => picklistStore.activeOrderedTeams,
    set: (newOrder) => {
        if (picklistStore.activeTab === 'personal') {
            picklistStore.setPersonalOrder(newOrder.map(t => t.team_number));
        } else if (picklistStore.activeTab === 'team') {
            picklistStore.setTeamOrder(newOrder.map(t => t.team_number));
        }
    }
});

const isEditable = computed(() =>
    (activeTab.value === 'personal') ||
    (activeTab.value === 'team' && isLead.value)
);

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
                teamNumbers: picklistStore.personalList
            }, picklistStore.lastSaveError ?? undefined);
        }
    } else if (activeTab.value === 'team' && isLead.value) {
        success = await picklistStore.saveTeamList(eventId.value);
        if (!success) {
            queueStore.enqueue('picklist_team', {
                eventId: eventId.value,
                teamNumbers: picklistStore.teamList
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

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function computeBasicStats(matchData: unknown[]) {
    if (!matchData.length) return [];

    // Derive numeric fields automatically from the first row
    const numericFields: string[] = [];
    if (matchData[0]) {
        Object.entries(matchData[0]).forEach(([key, val]) => {
            if (typeof val === 'number' && !key.includes('match_number') && !key.includes('team_number')) {
                numericFields.push(key);
            }
        });
    }

    return numericFields.slice(0, 8).map((field) => {
        const values = matchData.map(row => row[field]).filter(v => typeof v === 'number');
        const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : 0;
        const max = values.length ? Math.max(...values) : 0;
        return { label: formatFieldLabel(field), avg: avg.toFixed(1), max };
    });
}

function formatFieldLabel(field: string) {
    return field
        .replace(/^(prematch_|postmatch_|auto_|teleop_|endgame_)/g, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
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
                <span v-if="activeTab === 'personal'">Your personal ranking. Drag rows to reorder, then save.</span>
                <span v-else-if="activeTab === 'democratic'">Aggregated ranking from all scouts' personal lists
                    (read-only).</span>
                <span v-else>Official team pick list — only leads can edit. Drag to reorder, then save.</span>
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
                        :disabled="picklistStore.isSaving || picklistStore.democraticList.length === 0"
                        title="Overwrite the team list with the current democratic ranking" @click="resetTeamFromDemocratic">
                        ↺ Reset from Democratic
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
                <div v-if="activeTab === 'democratic' && picklistStore.democraticList.length === 0" class="picklist-empty">
                    <p>No personal lists have been submitted yet — submit yours on the "My List" tab first.</p>
                </div>

                <!-- Draggable / static list -->
                <draggable v-if="isEditable" v-model="draggablePersonal" group="picklist" item-key="team_number"
                    handle=".picklist-drag-handle" animation="200" ghost-class="picklist-row--ghost" :force-fallback="true"
                    :scroll-sensitivity="150" :scroll-speed="150" @change="saveList">
                    <template #item="{ element: team, index }">
                        <div class="picklist-row" :class="{ 'picklist-row--expanded': expandedTeam === team.team_number }"
                            :id="`picklist-team-${team.team_number}`">
                            <!-- Collapsed row -->
                            <div class="picklist-row-collapsed" @click="toggleExpand(team.team_number)">
                                <div class="picklist-drag-handle" @click.stop title="Drag to reorder">
                                    <span class="drag-dots">⠿</span>
                                </div>
                                <div class="picklist-rank">{{ index + 1 }}</div>
                                <div class="picklist-thumb-wrapper">
                                    <img v-if="team.photo_url" :src="team.photo_url" :alt="`Team ${team.team_number} robot`"
                                        class="picklist-thumb" loading="lazy" />
                                    <div v-else class="picklist-thumb-placeholder">
                                        <span>🤖</span>
                                    </div>
                                </div>
                                <div class="picklist-team-info">
                                    <span class="picklist-team-number">{{ team.team_number }}</span>
                                    <span class="picklist-team-name">{{ team.name }}</span>
                                </div>
                                <div class="picklist-expand-chevron"
                                    :class="{ 'picklist-expand-chevron--open': expandedTeam === team.team_number }">
                                    ›
                                </div>
                            </div>

                            <!-- Expanded detail -->
                            <transition name="expand">
                                <div v-if="expandedTeam === team.team_number" class="picklist-row-detail">
                                    <div v-if="expandedLoading" class="picklist-detail-loading">
                                        <div class="picklist-spinner picklist-spinner--sm"></div> Loading data…
                                    </div>
                                    <div v-else-if="expandedData" class="picklist-detail-content">
                                        <!-- Full robot image -->
                                        <div class="picklist-detail-photo" v-if="team.photo_url">
                                            <img :src="team.photo_url" :alt="`Team ${team.team_number} robot (full)`"
                                                class="picklist-full-photo" />
                                        </div>

                                        <!-- Stats -->
                                        <div class="picklist-detail-section" v-if="expandedData.stats.length > 0">
                                            <h3 class="picklist-detail-heading">Match Stats ({{ expandedData.stats.length }}
                                                matches)</h3>
                                            <div class="picklist-stats-grid">
                                                <div v-for="stat in computeBasicStats(expandedData.stats)" :key="stat.label"
                                                    class="picklist-stat-card">
                                                    <div class="stat-label">{{ stat.label }}</div>
                                                    <div class="stat-avg">{{ stat.avg }}</div>
                                                    <div class="stat-sub">avg &nbsp;|&nbsp; max {{ stat.max }}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-else class="picklist-no-data">No match data available.</div>

                                        <!-- Comments -->
                                        <div class="picklist-detail-section" v-if="expandedData.comments.length > 0">
                                            <h3 class="picklist-detail-heading">Scout Comments</h3>
                                            <ul class="picklist-comments-list">
                                                <li v-for="(comment, idx) in expandedData.comments" :key="idx"
                                                    class="picklist-comment">
                                                    <div class="comment-meta">
                                                        <span class="comment-author">{{ comment.author }}</span>
                                                        <span class="comment-source-badge">{{ comment.source }}</span>
                                                        <span class="comment-date">{{ formatDate(comment.created_at)
                                                        }}</span>
                                                    </div>
                                                    <p class="comment-text">{{ comment.comment }}</p>
                                                </li>
                                            </ul>
                                        </div>
                                        <div v-else-if="expandedData.stats.length === 0" class="picklist-no-data">
                                            No scouting data available for this team.
                                        </div>
                                    </div>
                                </div>
                            </transition>
                        </div>
                    </template>
                </draggable>

                <!-- Read-only list (democratic tab) -->
                <div v-else-if="activeTab === 'democratic' && picklistStore.democraticList.length > 0">
                    <div v-for="(team, index) in picklistStore.activeOrderedTeams" :key="team.team_number"
                        class="picklist-row" :class="{ 'picklist-row--expanded': expandedTeam === team.team_number }"
                        :id="`picklist-team-demo-${team.team_number}`">
                        <div class="picklist-row-collapsed" @click="toggleExpand(team.team_number)">
                            <div class="picklist-rank">{{ index + 1 }}</div>
                            <div class="picklist-thumb-wrapper">
                                <img v-if="team.photo_url" :src="team.photo_url" :alt="`Team ${team.team_number} robot`"
                                    class="picklist-thumb" loading="lazy" />
                                <div v-else class="picklist-thumb-placeholder">
                                    <span>🤖</span>
                                </div>
                            </div>
                            <div class="picklist-team-info">
                                <span class="picklist-team-number">{{ team.team_number }}</span>
                                <span class="picklist-team-name">{{ team.name }}</span>
                            </div>
                            <div class="picklist-expand-chevron"
                                :class="{ 'picklist-expand-chevron--open': expandedTeam === team.team_number }">
                                ›
                            </div>
                        </div>

                        <transition name="expand">
                            <div v-if="expandedTeam === team.team_number" class="picklist-row-detail">
                                <div v-if="expandedLoading" class="picklist-detail-loading">
                                    <div class="picklist-spinner picklist-spinner--sm"></div> Loading data…
                                </div>
                                <div v-else-if="expandedData" class="picklist-detail-content">
                                    <div class="picklist-detail-photo" v-if="team.photo_url">
                                        <img :src="team.photo_url" :alt="`Team ${team.team_number} robot (full)`"
                                            class="picklist-full-photo" />
                                    </div>
                                    <div class="picklist-detail-section" v-if="expandedData.stats.length > 0">
                                        <h3 class="picklist-detail-heading">Match Stats ({{ expandedData.stats.length }}
                                            matches)</h3>
                                        <div class="picklist-stats-grid">
                                            <div v-for="stat in computeBasicStats(expandedData.stats)" :key="stat.label"
                                                class="picklist-stat-card">
                                                <div class="stat-label">{{ stat.label }}</div>
                                                <div class="stat-avg">{{ stat.avg }}</div>
                                                <div class="stat-sub">avg &nbsp;|&nbsp; max {{ stat.max }}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-else class="picklist-no-data">No match data available.</div>

                                    <div class="picklist-detail-section" v-if="expandedData.comments.length > 0">
                                        <h3 class="picklist-detail-heading">Scout Comments</h3>
                                        <ul class="picklist-comments-list">
                                            <li v-for="(comment, idx) in expandedData.comments" :key="idx"
                                                class="picklist-comment">
                                                <div class="comment-meta">
                                                    <span class="comment-author">{{ comment.author }}</span>
                                                    <span class="comment-source-badge">{{ comment.source }}</span>
                                                    <span class="comment-date">{{ formatDate(comment.created_at) }}</span>
                                                </div>
                                                <p class="comment-text">{{ comment.comment }}</p>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </transition>
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

.picklist-spinner--sm {
    width: 20px;
    height: 20px;
    border-width: 2px;
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

/* ── Row ── */
.picklist-list-wrapper {
    display: flex;
    flex-direction: column;
}

.picklist-row {
    background: var(--tile-background-color);
    border-radius: 12px;
    margin-bottom: 8px;
    overflow: hidden;
    box-shadow:
        inset 0 0 0.5px 1px hsla(0, 0%, 100%, 0.07),
        0 1px 4px hsla(230, 13%, 9%, 0.07),
        0 2px 10px hsla(230, 13%, 9%, 0.06);
    transition: box-shadow 0.2s ease;
}

.picklist-row:hover {
    box-shadow:
        inset 0 0 0.5px 1px hsla(0, 0%, 100%, 0.1),
        0 2px 8px hsla(230, 13%, 9%, 0.12),
        0 4px 16px hsla(230, 13%, 9%, 0.1);
}

.picklist-row--expanded {
    box-shadow:
        0 0 0 2px #b05703,
        0 4px 20px hsla(230, 13%, 9%, 0.14);
}

.picklist-row--ghost {
    opacity: 0.45;
}

/* Collapsed row layout */
.picklist-row-collapsed {
    display: flex;
    align-items: center;
    padding: 10px 14px;
    cursor: pointer;
    gap: 12px;
    min-height: 68px;
    user-select: none;
}

.picklist-drag-handle {
    color: rgba(128, 128, 128, 0.5);
    cursor: grab;
    font-size: 20px;
    padding: 4px;
    flex-shrink: 0;
    transition: color 0.15s;
    line-height: 1;
}

.picklist-drag-handle:hover {
    color: #b05703;
}

.picklist-rank {
    font-size: 18px;
    font-weight: 700;
    color: #b05703;
    min-width: 30px;
    text-align: center;
    flex-shrink: 0;
}

.picklist-thumb-wrapper {
    width: 52px;
    height: 52px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background: rgba(128, 128, 128, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
}

.picklist-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.picklist-thumb-placeholder {
    font-size: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
}

.picklist-team-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.picklist-team-number {
    font-size: 16px;
    font-weight: 700;
    color: var(--primary-text-color);
    line-height: 1.2;
}

.picklist-team-name {
    font-size: 13px;
    color: rgba(128, 128, 128, 0.8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.picklist-expand-chevron {
    font-size: 24px;
    font-weight: 300;
    color: rgba(128, 128, 128, 0.5);
    transition: transform 0.22s ease, color 0.15s ease;
    flex-shrink: 0;
    line-height: 1;
    padding-left: 4px;
}

.picklist-expand-chevron--open {
    transform: rotate(90deg);
    color: #b05703;
}

/* ── Detail section ── */
.picklist-row-detail {
    border-top: 1px solid rgba(128, 128, 128, 0.15);
    padding: 16px 14px 20px;
    overflow: hidden;
}

.picklist-detail-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: rgba(128, 128, 128, 0.7);
    padding: 8px 0;
}

.picklist-detail-content {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.picklist-detail-photo {
    display: flex;
    justify-content: center;
}

.picklist-full-photo {
    max-width: 340px;
    width: 100%;
    border-radius: 10px;
    object-fit: cover;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.picklist-detail-heading {
    font-size: 14px;
    font-weight: 700;
    color: #b05703;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.picklist-detail-section {
    display: flex;
    flex-direction: column;
}

/* Stats grid */
.picklist-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
}

.picklist-stat-card {
    background: rgba(176, 87, 3, 0.08);
    border: 1px solid rgba(176, 87, 3, 0.2);
    border-radius: 10px;
    padding: 10px 12px;
    text-align: center;
}

.stat-label {
    font-size: 11px;
    color: rgba(128, 128, 128, 0.75);
    margin-bottom: 4px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.stat-avg {
    font-size: 22px;
    font-weight: 700;
    color: #b05703;
    line-height: 1.1;
}

.stat-sub {
    font-size: 10px;
    color: rgba(128, 128, 128, 0.6);
    margin-top: 2px;
}

/* Comments */
.picklist-comments-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.picklist-comment {
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 10px;
    padding: 10px 14px;
}

.comment-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
}

.comment-author {
    font-weight: 700;
    font-size: 13px;
    color: var(--primary-text-color);
}

.comment-source-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 20px;
    background: rgba(176, 87, 3, 0.15);
    color: #b05703;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.comment-date {
    font-size: 11px;
    color: rgba(128, 128, 128, 0.6);
    margin-left: auto;
}

.comment-text {
    font-size: 13px;
    color: var(--primary-text-color);
    line-height: 1.55;
    margin: 0;
}

.picklist-no-data {
    font-size: 13px;
    color: rgba(128, 128, 128, 0.6);
    font-style: italic;
    padding: 4px 0;
}

/* ── Transitions ── */
.expand-enter-active,
.expand-leave-active {
    transition: max-height 0.28s ease, opacity 0.22s ease;
    max-height: 1200px;
    overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
    max-height: 0;
    opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
