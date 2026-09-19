<script setup lang="ts">
// @ts-nocheck
import type { TeamEntry } from '@/stores/picklist-store';

// `team` can be undefined for a team number that's on an alliance but isn't
// in this event's team list — it still renders (number only, no photo).
defineProps<{
    teamNumber: number;
    team?: TeamEntry;
    // 'slot' = wide row that fills an alliance slot; 'tile' = square card for the pool.
    variant: 'slot' | 'tile';
    draggable?: boolean;
}>();

// Keep this template to a single root node: a comment (or second element)
// before the root compiles to a fragment, which breaks vuedraggable — it
// would capture the fragment anchor instead of the real element.
</script>

<template>
    <div class="team-chip" :class="[`team-chip--${variant}`, { 'team-chip--draggable': draggable }]" @contextmenu.prevent
        :title="team?.name ? `${teamNumber} — ${team.name}` : String(teamNumber)">
        <div class="team-chip-photo">
            <img v-if="team?.photo_url" :src="team.photo_url" :alt="`Team ${teamNumber} robot`" loading="lazy"
                draggable="false" />
            <span v-else class="team-chip-placeholder">🤖</span>
        </div>
        <div class="team-chip-number">{{ teamNumber }}</div>
    </div>
</template>

<style scoped>
.team-chip {
    display: flex;
    background: var(--tile-background-color);
    color: var(--primary-text-color);
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
}

.team-chip--draggable {
    cursor: grab;
}

.team-chip-photo {
    background: rgba(128, 128, 128, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
}

.team-chip-photo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    /* So a long-press lands on the chip (starting a drag), not the image's
       native "save image" menu. */
    pointer-events: none;
}

.team-chip-number {
    font-weight: 700;
}

/* ── Alliance slot: photo thumbnail + number in one row ── */
.team-chip--slot {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    height: 100%;
    border-radius: 8px;
    box-shadow: 0 0 0 1.5px rgba(176, 87, 3, 0.55);
}

.team-chip--slot .team-chip-photo {
    height: 100%;
    aspect-ratio: 4 / 3;
    flex-shrink: 0;
}

.team-chip--slot .team-chip-number {
    font-size: 16px;
}

.team-chip--slot .team-chip-placeholder {
    font-size: 20px;
}

/* ── Pool tile: photo over number ── */
.team-chip--tile {
    flex-direction: column;
    width: 92px;
    aspect-ratio: 1;
    border-radius: 10px;
}

.team-chip--tile .team-chip-photo {
    flex: 1;
    min-height: 0;
}

.team-chip--tile .team-chip-number {
    text-align: center;
    font-size: 14px;
    padding: 4px;
}

.team-chip--tile .team-chip-placeholder {
    font-size: 26px;
}
</style>
