<script setup lang="ts">
// @ts-nocheck
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { RouterLink } from 'vue-router';
import { usePicklistStore } from '@/stores/picklist-store';
import { useAuthStore } from '@/stores/auth-store';
import { useEventStore } from '@/stores/event-store';
import { useOfflineQueueStore } from '@/stores/offline-queue-store';
import { computeBasicStats, computeFlagStats } from '@/lib/picklist-stats';
import PitScoutingSection from '@/components/PitScoutingSection.vue';

const picklistStore = usePicklistStore();
const authStore = useAuthStore();
const eventStore = useEventStore();
const queueStore = useOfflineQueueStore();

const userId = computed(() => authStore.currentUserId);
const eventId = computed(() => eventStore.eventId);

const teamsLoaded = ref(false);

// Teams still waiting to be placed, in the order they'll be presented.
const queue = ref<number[]>([]);
// The team currently being placed via binary search.
const candidate = ref<number | null>(null);
// Binary-search bounds into sortedSnapshot.
const lo = ref(0);
const hi = ref(0);
// A local copy of personalRankedFlatOrder, taken once per candidate — safe
// since the store is only mutated between candidates, never mid-search.
const sortedSnapshot = ref<number[]>([]);
// The team at the current comparison midpoint.
const compareAgainst = ref<number | null>(null);

const totalToPlace = ref(0);
const placedCount = ref(0);

// Once every team has been placed at least once, pick'em doesn't stop —
// rankings drift as more matches are played, so it keeps presenting
// adjacent pairs from the current order for continuous re-evaluation.
// 'insufficient' only applies if the event has fewer than 2 teams total.
const phase = ref<'placing' | 'refining' | 'insufficient'>('placing');
const refinementCount = ref(0);
// The flat index of the "upper" (currently better-ranked) team in the
// pair being shown, so a swap knows exactly where to reinsert the winner.
let refinementUpperIndex = 0;
let lastRefinementPair: [number, number] | null = null;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Loading ───────────────────────────────────────────────────────────────────

onMounted(async () => {
    await authStore.checkUser();
    await eventStore.updateEvent();
    await picklistStore.loadTeams(eventId.value);
    await picklistStore.loadPersonalList(userId.value, eventId.value);
    teamsLoaded.value = true;

    // Shuffle so placement order doesn't always start with the lowest team number.
    const shuffled = [...picklistStore.personalTierSections.Unranked];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    queue.value = shuffled;
    totalToPlace.value = shuffled.length;

    startNextTeam();
});

onUnmounted(() => {
    flushSave();
});

// ─── Placement flow ─────────────────────────────────────────────────────────────

function startNextTeam() {
    if (queue.value.length === 0) {
        enterRefinementMode();
        return;
    }

    candidate.value = queue.value.shift();

    // First team ever ranked — nothing to compare against yet. Bootstraps
    // into the middle tier; the very next comparison immediately tests it
    // against something real.
    if (picklistStore.personalRankedFlatOrder.length === 0) {
        picklistStore.placeTeamAtFlatIndex(candidate.value, 0);
        placedCount.value++;
        scheduleSave();
        startNextTeam();
        return;
    }

    sortedSnapshot.value = [...picklistStore.personalRankedFlatOrder];
    lo.value = 0;
    hi.value = sortedSnapshot.value.length;
    presentNextComparison();
}

// The pivot within [lo, hi) most recently presented — jittered around the
// true midpoint (bounded to ~30% of the remaining range) rather than
// always the exact midpoint, so the same "central" teams don't get shown
// as the reference on every single search. Bounded (not fully random)
// so worst-case comparison count stays close to binary search's O(log n)
// instead of risking a near-linear search if jitter kept landing at the
// edge of the range.
let currentMid = 0;

function presentNextComparison() {
    if (lo.value >= hi.value) {
        finalizePlacement();
        return;
    }
    const width = hi.value - lo.value;
    const trueMid = lo.value + (width >> 1);
    const jitter = width > 2 ? Math.round((Math.random() - 0.5) * width * 0.6) : 0;
    currentMid = Math.min(hi.value - 1, Math.max(lo.value, trueMid + jitter));
    compareAgainst.value = sortedSnapshot.value[currentMid];
}

function chooseTeam(winner: number) {
    if (winner === candidate.value) {
        hi.value = currentMid;
    } else {
        lo.value = currentMid + 1;
    }
    presentNextComparison();
}

function finalizePlacement() {
    picklistStore.placeTeamAtFlatIndex(candidate.value, lo.value);
    placedCount.value++;
    scheduleSave();
    startNextTeam();
}

// ─── Continuous refinement ────────────────────────────────────────────────────

function enterRefinementMode() {
    if (picklistStore.personalRankedFlatOrder.length < 2) {
        phase.value = 'insufficient';
        candidate.value = null;
        compareAgainst.value = null;
        return;
    }
    phase.value = 'refining';
    presentRefinementPair();
}

// Nearby-but-not-strictly-adjacent pairing: picking only true neighbors
// means whichever pair a random anchor happens to land on has just one
// possible partner, so the same two teams keep coming back around. A
// small window keeps comparisons meaningful (close in rank, so there's
// real ambiguity to resolve) while giving each anchor several possible
// partners instead of one.
const REFINEMENT_WINDOW = 5;

function presentRefinementPair() {
    const flat = picklistStore.personalRankedFlatOrder;
    const n = flat.length;
    const anchor = Math.floor(Math.random() * n);
    const maxWindow = Math.min(REFINEMENT_WINDOW, n - 1);
    const candidates = [];
    for (let w = 1; w <= maxWindow; w++) {
        if (anchor - w >= 0) candidates.push(anchor - w);
        if (anchor + w < n) candidates.push(anchor + w);
    }
    let other = candidates[Math.floor(Math.random() * candidates.length)];

    let i = Math.min(anchor, other);
    let j = Math.max(anchor, other);

    // Avoid immediately re-showing the exact same pair, when there's a choice.
    if (candidates.length > 1 && lastRefinementPair &&
        flat[i] === lastRefinementPair[0] && flat[j] === lastRefinementPair[1]) {
        other = candidates.find((c) => c !== other) ?? other;
        i = Math.min(anchor, other);
        j = Math.max(anchor, other);
    }

    refinementUpperIndex = i;
    candidate.value = flat[i];
    compareAgainst.value = flat[j];
    lastRefinementPair = [candidate.value, compareAgainst.value];
}

function chooseRefinementTeam(winner: number) {
    if (winner === compareAgainst.value) {
        // The lower-ranked team was actually preferred — swap it up.
        picklistStore.placeTeamAtFlatIndex(winner, refinementUpperIndex);
        scheduleSave();
    }
    refinementCount.value++;
    presentRefinementPair();
}

function pickWinner(winner: number) {
    if (phase.value === 'placing') {
        chooseTeam(winner);
    } else if (phase.value === 'refining') {
        chooseRefinementTeam(winner);
    }
}

// ─── Saving ─────────────────────────────────────────────────────────────────────

function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 800);
}

async function flushSave() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (!userId.value) return;

    const success = await picklistStore.savePersonalList(userId.value, eventId.value);
    if (!success) {
        queueStore.enqueue('picklist_personal', {
            userId: userId.value,
            eventId: eventId.value,
            teamNumbers: picklistStore.personalFlatOrder,
            teamTiers: picklistStore.personalTiersMap
        }, picklistStore.lastSaveError ?? undefined);
    }
}

// ─── Display helpers ─────────────────────────────────────────────────────────────

const candidateTeam = computed(() => candidate.value != null ? picklistStore.teamMap[candidate.value] : null);
const compareTeam = computed(() => compareAgainst.value != null ? picklistStore.teamMap[compareAgainst.value] : null);

// ─── Per-team match stats/comments (picklistStore.getTeamData caches per
// team number, so re-showing a team already seen this session is free) ──────────

const candidateData = ref(null);
const compareData = ref(null);

watch(candidate, async (teamNumber) => {
    candidateData.value = null;
    if (teamNumber == null) return;
    candidateData.value = await picklistStore.getTeamData(teamNumber, eventId.value);
});
watch(compareAgainst, async (teamNumber) => {
    compareData.value = null;
    if (teamNumber == null) return;
    compareData.value = await picklistStore.getTeamData(teamNumber, eventId.value);
});

// One entry per matchup side, so the template renders both with a single
// v-for instead of duplicating the card/stats/pit markup twice.
const matchupSides = computed(() => [
    { teamNumber: candidate.value, team: candidateTeam.value, data: candidateData.value },
    { teamNumber: compareAgainst.value, team: compareTeam.value, data: compareData.value }
]);
</script>

<template>
    <div class="main-content">
        <h1>Pick'em</h1>
        <p class="pickem-subtitle">Pick the team you'd rather have — we'll slot it into your Pick List for you.</p>

        <div v-if="!teamsLoaded" class="data-tile pickem-status">Loading teams…</div>

        <div v-else-if="phase === 'insufficient'" class="data-tile pickem-status">
            Add at least 2 teams to your Pick List to start comparing.
        </div>

        <template v-else-if="candidateTeam && compareTeam">
            <div class="pickem-progress">
                <template v-if="phase === 'placing'">{{ placedCount }} of {{ totalToPlace }} teams placed</template>
                <template v-else>
                    Every team's ranked — keep comparing to refine as you see more matches
                    ({{ refinementCount }} so far this session).
                    <RouterLink to="/picklist" class="pickem-cta">View your Pick List</RouterLink>
                </template>
            </div>
            <div class="pickem-matchup">
                <template v-for="(side, idx) in matchupSides" :key="side.teamNumber">
                    <div class="pickem-column">
                        <button type="button" class="pickem-card" @click="pickWinner(side.teamNumber)">
                            <div class="pickem-card-photo">
                                <img v-if="side.team.photo_url" :src="side.team.photo_url"
                                    :alt="`Team ${side.team.team_number} robot`" loading="lazy" />
                                <div v-else class="pickem-card-placeholder"><span>🤖</span></div>
                            </div>
                            <div class="pickem-card-number">{{ side.team.team_number }}</div>
                            <div class="pickem-card-name">{{ side.team.name }}</div>
                        </button>

                        <div class="data-tile pickem-info-card">
                            <div v-if="!side.data" class="pickem-no-data">Loading stats…</div>
                            <template v-else>
                                <div v-if="side.data.stats.length > 0" class="pickem-stats-grid">
                                    <div v-for="stat in computeFlagStats(side.data.stats)" :key="stat.label"
                                        class="pickem-stat">
                                        <div class="stat-label">{{ stat.label }}</div>
                                        <div class="stat-avg">{{ stat.pct }}%</div>
                                    </div>
                                    <div v-for="stat in computeBasicStats(side.data.stats)" :key="stat.label"
                                        class="pickem-stat">
                                        <div class="stat-label">{{ stat.label }}</div>
                                        <div class="stat-avg">{{ stat.avg }}</div>
                                    </div>
                                </div>
                                <div v-else class="pickem-no-data">No match data available.</div>

                                <ul v-if="side.data.comments.length > 0" class="pickem-comments">
                                    <li v-for="(comment, cIdx) in side.data.comments" :key="cIdx" class="pickem-comment">
                                        <div class="comment-meta">
                                            <span class="comment-author">{{ comment.author }}</span>
                                            <span class="comment-source-badge">{{ comment.source }}</span>
                                        </div>
                                        <p class="comment-text">{{ comment.comment }}</p>
                                    </li>
                                </ul>
                            </template>
                        </div>

                        <PitScoutingSection :team-number="side.teamNumber"></PitScoutingSection>
                    </div>

                    <div v-if="idx === 0" class="pickem-vs">VS</div>
                </template>
            </div>
        </template>
    </div>
</template>

<style scoped>
.pickem-subtitle {
    color: rgba(128, 128, 128, 0.9);
    margin-top: -8px;
    margin-bottom: 20px;
}

.pickem-status {
    text-align: center;
    padding: 60px 20px;
}

.pickem-cta {
    margin-left: 6px;
    color: #b05703;
    font-weight: 600;
    text-decoration: none;
}

.pickem-cta:hover {
    text-decoration: underline;
}

.pickem-progress {
    text-align: center;
    color: rgba(128, 128, 128, 0.9);
    margin-bottom: 16px;
}

.pickem-matchup {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
}

.pickem-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 320px;
    max-width: 90vw;
    gap: 16px;
}

.pickem-vs {
    font-size: 22px;
    font-weight: 800;
    color: rgba(128, 128, 128, 0.7);
    margin-top: 60px;
}

.pickem-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 20px;
    background: var(--tile-background-color);
    border: 2px solid transparent;
    border-radius: 14px;
    cursor: pointer;
    font: inherit;
    color: var(--primary-text-color);
    transition: border-color 0.15s ease, transform 0.1s ease;
}

.pickem-card:hover {
    border-color: #b05703;
    transform: translateY(-2px);
}

.pickem-card-photo {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(128, 128, 128, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
}

.pickem-card-photo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.pickem-card-placeholder {
    font-size: 40px;
}

.pickem-card-number {
    font-size: 24px;
    font-weight: 800;
    margin-top: 12px;
}

.pickem-card-name {
    font-size: 14px;
    color: rgba(128, 128, 128, 0.9);
    text-align: center;
}

.pickem-info-card {
    width: 100%;
    margin: 0;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pickem-no-data {
    font-size: 13px;
    color: rgba(128, 128, 128, 0.6);
    font-style: italic;
}

.pickem-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
    gap: 8px;
}

.pickem-stat {
    background: rgba(176, 87, 3, 0.08);
    border: 1px solid rgba(176, 87, 3, 0.2);
    border-radius: 8px;
    padding: 6px 8px;
    text-align: center;
}

.stat-label {
    font-size: 10px;
    color: rgba(128, 128, 128, 0.75);
    margin-bottom: 2px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.stat-avg {
    font-size: 16px;
    font-weight: 700;
    color: #b05703;
    line-height: 1.1;
}

.pickem-comments {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.pickem-comment {
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 8px;
    padding: 8px 10px;
}

.comment-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    flex-wrap: wrap;
}

.comment-author {
    font-weight: 700;
    font-size: 12px;
    color: var(--primary-text-color);
}

.comment-source-badge {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 20px;
    background: rgba(176, 87, 3, 0.15);
    color: #b05703;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.comment-text {
    font-size: 12px;
    color: var(--primary-text-color);
    line-height: 1.5;
    margin: 0;
}

@media (max-width: 700px) {
    .pickem-matchup {
        flex-direction: column;
    }
}
</style>
