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
// v-for instead of duplicating the card/comments/pit markup twice.
const matchupSides = computed(() => [
    { teamNumber: candidate.value, team: candidateTeam.value, data: candidateData.value },
    { teamNumber: compareAgainst.value, team: compareTeam.value, data: compareData.value }
]);

// ─── Per-team "More Info" modal ────────────────────────────────────────────
// Stats/comments/pit data live behind this modal (rather than always
// inline) specifically so the two picker cards above stay short enough to
// both fit on screen at once on mobile without scrolling — see issue #45
// follow-up. It shows one team at a time (a side-by-side comparison layout
// doesn't have room to work on a narrow screen), opened via a "More Info"
// button under whichever card the user taps.

const infoModalSide = ref<'candidate' | 'compare' | null>(null);

// Close automatically when a winner is picked and a new matchup loads —
// otherwise the modal would keep showing a team that's no longer on screen.
watch(candidate, () => { infoModalSide.value = null; });

const infoModalTeam = computed(() => infoModalSide.value === 'candidate' ? candidateTeam.value : compareTeam.value);
const infoModalData = computed(() => infoModalSide.value === 'candidate' ? candidateData.value : compareData.value);
const infoModalTeamNumber = computed(() => infoModalSide.value === 'candidate' ? candidate.value : compareAgainst.value);
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
                        <button type="button" class="pickem-more-info-button" :disabled="!side.data"
                            @click="infoModalSide = idx === 0 ? 'candidate' : 'compare'">
                            More Info
                        </button>
                    </div>

                    <div v-if="idx === 0" class="pickem-vs">VS</div>
                </template>
            </div>
        </template>

        <div v-if="infoModalSide" class="pickem-modal-overlay" @click.self="infoModalSide = null">
            <div class="pickem-modal" role="dialog" aria-modal="true"
                :aria-label="`Team ${infoModalTeamNumber} info`">
                <div class="pickem-modal-header">
                    <h2>{{ infoModalTeam?.team_number }} - {{ infoModalTeam?.name }}</h2>
                    <button type="button" class="pickem-modal-close" @click="infoModalSide = null"
                        aria-label="Close">✕</button>
                </div>

                <div class="pickem-modal-body">
                    <!-- Same expanded-detail data summary as the ranked Pick List rows
                         (PicklistRow.vue) — full photo, per-match-count stat cards, and
                         comments with their match number — so a team looks the same
                         whether you're reviewing it here or on the Pick List. -->
                    <div class="pickem-detail-photo" v-if="infoModalTeam?.photo_url">
                        <img :src="infoModalTeam.photo_url" :alt="`Team ${infoModalTeamNumber} robot (full)`"
                            class="pickem-full-photo" />
                    </div>

                    <div class="pickem-detail-section" v-if="infoModalData?.stats.length > 0">
                        <h3 class="pickem-detail-heading">Match Stats ({{ infoModalData.stats.length }} matches)</h3>
                        <div class="pickem-stats-grid">
                            <div v-for="stat in computeFlagStats(infoModalData.stats)" :key="stat.label"
                                class="pickem-stat">
                                <div class="stat-label">{{ stat.label }}</div>
                                <div class="stat-avg">{{ stat.pct }}%</div>
                                <div class="stat-sub">{{ stat.count }} / {{ stat.total }} matches</div>
                            </div>
                            <div v-for="stat in computeBasicStats(infoModalData.stats)" :key="stat.label"
                                class="pickem-stat">
                                <div class="stat-label">{{ stat.label }}</div>
                                <div class="stat-avg">{{ stat.avg }}</div>
                                <div class="stat-sub">avg &nbsp;|&nbsp; max {{ stat.max }}</div>
                            </div>
                        </div>
                    </div>
                    <p v-else class="pickem-no-data">No match data available.</p>

                    <div class="pickem-detail-section" v-if="infoModalData?.comments.length > 0">
                        <h3 class="pickem-detail-heading">Scout Comments</h3>
                        <ul class="pickem-comments">
                            <li v-for="(comment, cIdx) in infoModalData.comments" :key="cIdx" class="pickem-comment">
                                <div class="comment-meta">
                                    <span class="comment-author">{{ comment.author }}</span>
                                    <span class="comment-source-badge">{{ comment.source }}</span>
                                    <span class="comment-match" v-if="comment.match_number != null">Match
                                        {{ comment.match_number }}</span>
                                </div>
                                <p class="comment-text">{{ comment.comment }}</p>
                            </li>
                        </ul>
                    </div>
                    <p v-else-if="infoModalData?.stats.length === 0" class="pickem-no-data">
                        No scouting data available for this team.
                    </p>

                    <PitScoutingSection :team-number="infoModalTeamNumber"></PitScoutingSection>
                </div>
            </div>
        </div>
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

.pickem-no-data {
    font-size: 13px;
    color: rgba(128, 128, 128, 0.6);
    font-style: italic;
}

.pickem-more-info-button {
    width: 100%;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    background-color: var(--accent-color);
    color: var(--primary-text-color);
    cursor: pointer;
    font: inherit;
    font-weight: 600;
}

.pickem-more-info-button:hover:not(:disabled) {
    background-color: var(--header-hover-color);
}

.pickem-more-info-button:disabled {
    opacity: 0.6;
    cursor: default;
}

.pickem-modal-overlay {
    position: fixed;
    inset: 0;
    /* Above NavBar.vue's fixed header (z-index: 9999) so the modal's own
       header/close button never end up hidden underneath it. */
    z-index: 10000;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.pickem-modal {
    width: 100%;
    max-width: 640px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    background: var(--tile-background-color);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.pickem-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(128, 128, 128, 0.25);
}

.pickem-modal-header h2 {
    margin: 0;
    font-size: 18px;
}

.pickem-modal-close {
    border: none;
    background: transparent;
    color: var(--primary-text-color);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 8px;
}

.pickem-modal-body {
    padding: 16px 20px 20px;
    overflow-y: auto;
}

.pickem-detail-photo {
    display: flex;
    justify-content: center;
    margin-bottom: 18px;
}

.pickem-full-photo {
    max-width: 340px;
    width: 100%;
    border-radius: 10px;
    object-fit: cover;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.pickem-detail-section {
    margin-bottom: 18px;
}

.pickem-detail-heading {
    font-size: 14px;
    font-weight: 700;
    color: #b05703;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.pickem-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 10px;
}

.pickem-stat {
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
    font-size: 20px;
    font-weight: 700;
    color: #b05703;
    line-height: 1.1;
}

.stat-sub {
    font-size: 10px;
    color: rgba(128, 128, 128, 0.6);
    margin-top: 2px;
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

.comment-match {
    font-size: 10px;
    color: rgba(128, 128, 128, 0.6);
    margin-left: auto;
}

.comment-text {
    font-size: 12px;
    color: var(--primary-text-color);
    line-height: 1.5;
    margin: 0;
}

@media (max-width: 700px) {
    /* Both cards need to stay in view together without scrolling, so they
       stay side-by-side (never stacked) and shrink to fit instead — the
       heavier stats/comments/pit content that used to sit inline under each
       card now lives behind the per-team More Info modal for exactly this
       reason. */
    .pickem-matchup {
        flex-wrap: nowrap;
        gap: 10px;
    }

    .pickem-column {
        width: auto;
        max-width: none;
        flex: 1 1 0;
        min-width: 0;
        gap: 8px;
    }

    .pickem-vs {
        flex-shrink: 0;
        margin-top: 40px;
        font-size: 16px;
    }

    .pickem-card {
        padding: 10px;
    }

    .pickem-card-number {
        font-size: 18px;
        margin-top: 8px;
    }

    .pickem-card-name {
        font-size: 12px;
    }

    .pickem-more-info-button {
        padding: 8px 10px;
        font-size: 0.85em;
    }
}
</style>
