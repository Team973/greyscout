<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from '@/stores/view-mode-store';
import { teamInfoTable } from "@/lib/constants";
import { fetchTeamAutoPaths } from "@/lib/auto-path-query";
import { queryMatchTeams } from "@/lib/data-query";
import { SIDE_CHOICES, transformPath } from "@/lib/2026/auto-path-field";

import '@material/web/select/outlined-select';
import '@material/web/select/select-option';
import Dropdown from "@/components/Dropdown.vue";
import NumberInput from "@/components/Number.vue";
import Switch from "@/components/Switch.vue";
import AutoPathCanvas from "@/components/AutoPathCanvas.vue";
import { supabase } from "@/lib/supabase-client";

</script>

<template>
    <div class="main-content">
        <h1>Match Preview</h1>
        <div v-if="teamsLoaded && isDataAvailable">
            <!-- Only show this if the team data is loaded. -->
            <div class="data-tile">
                <div class="autopath-preview-selector">
                    Match Number:
                    <NumberInput :model-value="matchNumber" @update:modelValue="onMatchNumberChange" label=""></NumberInput>
                </div>
                <div class="autopath-preview-selector">
                    Manual Team Selection:
                    <Switch :model-value="manualTeamSelection" @update:modelValue="onManualToggle"></Switch>
                </div>
                <p v-if="matchLookupFailed && !manualTeamSelection">No qualification schedule found for that match —
                    turn on Manual Team Selection to pick teams yourself.</p>
            </div>

            <h2>Red Alliance</h2>
            <div class="data-tile red-alliance">
                <div class="autopath-preview-selectors">
                    <div v-for="(slot, i) in [0, 1, 2]" :key="slot" class="autopath-preview-selector">
                        <span class="autopath-preview-swatch" :style="{ backgroundColor: slotColor(slot) }"></span>
                        Red {{ i + 1 }}:
                        <Dropdown v-if="manualTeamSelection" :choices="teamFilters" v-model="teamIndices[slot]"
                            @update:modelValue="setTeam(slot, $event)"></Dropdown>
                        <span v-else class="assigned-team">{{ teamFilters[teamIndices[slot]]?.text ?? 'Unassigned' }}</span>
                    </div>
                </div>
            </div>

            <div class="data-tile red-alliance">
                <h3>Auto Path Preview</h3>
                <div class="autopath-preview-selectors">
                    <div v-for="slot in [0, 1, 2]" :key="slot" class="autopath-preview-selector">
                        <span class="autopath-preview-swatch" :style="{ backgroundColor: slotColor(slot) }"></span>
                        <Dropdown :choices="autoPathChoices[slot] ?? []" :model-value="selectedAutoPathIndex[slot]"
                            @update:modelValue="onAutoPathChoiceChange(slot, $event)"></Dropdown>
                        <Dropdown :choices="SIDE_CHOICES" v-model="selectedSideIndex[slot]"></Dropdown>
                    </div>
                </div>
                <AutoPathCanvas :layers="allianceAutoPathLayers([0, 1, 2])" display-alliance="red" large="true"
                    :editable="false"></AutoPathCanvas>
            </div>

            <h2>Blue Alliance</h2>
            <div class="data-tile blue-alliance">
                <div class="autopath-preview-selectors">
                    <div v-for="(slot, i) in [3, 4, 5]" :key="slot" class="autopath-preview-selector">
                        <span class="autopath-preview-swatch" :style="{ backgroundColor: slotColor(slot) }"></span>
                        Blue {{ i + 1 }}:
                        <Dropdown v-if="manualTeamSelection" :choices="teamFilters" v-model="teamIndices[slot]"
                            @update:modelValue="setTeam(slot, $event)"></Dropdown>
                        <span v-else class="assigned-team">{{ teamFilters[teamIndices[slot]]?.text ?? 'Unassigned' }}</span>
                    </div>
                </div>
            </div>

            <div class="data-tile blue-alliance">
                <h3>Auto Path Preview</h3>
                <div class="autopath-preview-selectors">
                    <div v-for="slot in [3, 4, 5]" :key="slot" class="autopath-preview-selector">
                        <span class="autopath-preview-swatch" :style="{ backgroundColor: slotColor(slot) }"></span>
                        <Dropdown :choices="autoPathChoices[slot] ?? []" :model-value="selectedAutoPathIndex[slot]"
                            @update:modelValue="onAutoPathChoiceChange(slot, $event)"></Dropdown>
                        <Dropdown :choices="SIDE_CHOICES" v-model="selectedSideIndex[slot]"></Dropdown>
                    </div>
                </div>
                <AutoPathCanvas :layers="allianceAutoPathLayers([3, 4, 5])" display-alliance="blue" large="true"
                    :editable="false"></AutoPathCanvas>
            </div>
        </div>
        <div v-else-if="teamsLoaded">
            <h2>No Data Available</h2>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    data() {
        return {
            viewMode: null,
            eventStore: null,
            teamsLoaded: false,
            teamFilters: [],
            teamIndices: [0, 0, 0, 0, 0, 0],
            matchNumber: null,
            matchLookupFailed: false,
            // Default is schedule-driven auto-assignment; flip on to hand-pick
            // teams instead (e.g. the schedule hasn't been synced yet).
            manualTeamSelection: false,
            // Per-slot dropdown choices ({key, text, path}) of that slot's team's saved auto paths,
            // plus a leading "None" option. Index aligns with teamIndices (0-2 red, 3-5 blue).
            autoPathChoices: [[], [], [], [], [], []],
            selectedAutoPathIndex: [0, 0, 0, 0, 0, 0],
            // Which side (left/right) to preview each slot's chosen path as — defaults to
            // the path's own recorded side, but can be flipped independently per slot.
            selectedSideIndex: [0, 0, 0, 0, 0, 0],
            // Separate palettes per alliance tile (rather than one shared-by-position
            // palette) because paths cluster near that tile's own wall, and blue/purple
            // read poorly against the field art's blue tower/wall on the Blue tile.
            autoPathSlotColorsRed: ['#2f7de1', '#e08a1e', '#8a3fd1'],
            autoPathSlotColorsBlue: ['#e08a1e', '#1eae7a', '#d13f6a'],
            SIDE_CHOICES
        }
    },
    methods: {
        async loadTeamsData() {
            // Note: do this to avoid stale data on page refresh.
            await this.eventStore.updateEvent();

            const { data, error } = await supabase.from(teamInfoTable).select("*").eq("event_id", this.eventStore.eventId);
            let teamTextMap = {};
            if (error) {
                console.log(error);
            } else {
                for (var team of data) {
                    teamTextMap[team.team_number] = String(team.team_number) + " - " + String(team.name);
                }
            }

            this.teamFilters = [];
            Object.keys(teamTextMap).forEach(element => {
                let teamText = String(element);
                if (Object.keys(teamTextMap).includes(element)) {
                    teamText = teamTextMap[element];
                }
                this.teamFilters.push({ key: element, text: teamText });
            })

            // Mark the data as ready for the view to display.
            this.teamsLoaded = true;

            // Load auto path choices for whichever team currently occupies each slot.
            for (var slot = 0; slot < this.teamIndices.length; slot++) {
                this.loadAutoPathChoices(slot);
            }
        },
        async loadAutoPathChoices(slot: int) {
            this.selectedAutoPathIndex[slot] = 0;
            this.selectedSideIndex[slot] = 0;

            if (slot >= this.teamIndices.length || this.teamFilters.length === 0) {
                this.autoPathChoices[slot] = [{ key: 'none', text: 'No Auto Selected', path: null }];
                return;
            }

            const teamIndex = this.teamIndices[slot];
            const teamNumber = Number(this.teamFilters[teamIndex].key);
            const paths = await fetchTeamAutoPaths(teamNumber, this.eventStore.eventId);

            // A lone path is treated as the default even if is_default was never
            // explicitly set — matches AutoPathCard's isOnlyPath rule.
            const defaultId = paths.length === 1 ? paths[0].id : paths.find((p) => p.isDefault)?.id;

            this.autoPathChoices[slot] = [
                { key: 'none', text: 'No Auto Selected', path: null },
                ...paths.map((p) => ({
                    key: String(p.id),
                    text: `${teamNumber} - ${p.name}${p.id === defaultId ? ' (default)' : ''}`,
                    path: p
                }))
            ];

            // Default to the team's marked-default auto instead of "None" — or,
            // with only one saved path, that path is the default by definition.
            const defaultChoiceIdx = paths.length === 1
                ? 1
                : this.autoPathChoices[slot].findIndex((c) => c.path?.isDefault);
            if (defaultChoiceIdx > 0) {
                this.onAutoPathChoiceChange(slot, defaultChoiceIdx);
            }
        },
        slotColor(slot: int) {
            const palette = slot < 3 ? this.autoPathSlotColorsRed : this.autoPathSlotColorsBlue;
            return palette[slot % 3];
        },
        onAutoPathChoiceChange(slot: int, choiceIdx: int) {
            this.selectedAutoPathIndex[slot] = choiceIdx;

            // Default the side selector to whatever the newly-picked path was
            // actually recorded as, rather than leaving a stale choice in place.
            const choice = this.autoPathChoices[slot]?.[choiceIdx];
            const side = choice?.path?.side;
            const sideIdx = SIDE_CHOICES.findIndex((c) => c.key === side);
            this.selectedSideIndex[slot] = sideIdx >= 0 ? sideIdx : 0;
        },
        allianceAutoPathLayers(slots) {
            // display-alliance (set per alliance tile in the template) is
            // solely responsible for placing these alliance-agnostic [0,1]
            // points onto the real, fixed field image — see
            // auto-path-field.ts's file header for why that must stay the
            // only place alliance-based placement happens. Side, unlike
            // alliance, is a real mirror within that frame, so it's applied
            // here via transformPath before handing points to the canvas.
            const layers = [];

            slots.forEach((slot) => {
                const choiceIdx = this.selectedAutoPathIndex[slot];
                const choice = this.autoPathChoices[slot]?.[choiceIdx];
                if (!choice || !choice.path) return;

                const targetSide = SIDE_CHOICES[this.selectedSideIndex[slot]]?.key ?? choice.path.side;
                const points = transformPath(choice.path.points, choice.path.side, targetSide);

                layers.push({
                    key: `slot-${slot}`,
                    points,
                    color: this.slotColor(slot)
                });
            });

            return layers;
        },
        setTeam(idx: int, data: int) {
            this.teamIndices[idx] = data;
            this.loadAutoPathChoices(idx);
        },
        async onMatchNumberChange(value) {
            this.matchNumber = value;

            // In manual mode the match number is just informational context —
            // it doesn't overwrite the scout's hand-picked teams.
            if (this.manualTeamSelection) return;

            await this.applyScheduleTeams();
        },
        async applyScheduleTeams() {
            this.matchLookupFailed = false;

            if (!this.matchNumber) return;

            const matchTeams = await queryMatchTeams(this.eventStore.eventId, Number(this.matchNumber));
            if (!matchTeams) {
                this.matchLookupFailed = true;
                return;
            }

            // Slot order matches teamIndices: 0-2 red, 3-5 blue (see template).
            const slots = [matchTeams.red1, matchTeams.red2, matchTeams.red3, matchTeams.blue1, matchTeams.blue2, matchTeams.blue3];
            slots.forEach((teamNumber, slot) => {
                if (!teamNumber) return;
                const teamIdx = this.teamFilters.findIndex((t) => Number(t.key) === teamNumber);
                if (teamIdx >= 0) this.setTeam(slot, teamIdx);
            });
        },
        onManualToggle(value) {
            this.manualTeamSelection = value;

            // Switching back to auto mode: re-derive teams from the schedule
            // rather than leaving whatever was last manually picked.
            if (!value) this.applyScheduleTeams();
        }
    },
    computed: {
        isDataAvailable() {
            return this.teamFilters.length > 0;
        }
    },
    created() {
        this.viewMode = useViewModeStore();
        this.eventStore = useEventStore();
        this.loadTeamsData();
    }
}
</script>

<style>
.red-alliance {
    border: 2px solid red;
}

.blue-alliance {
    border: 2px solid blue;
}

.autopath-preview-selectors {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 12px;
}

.autopath-preview-selector {
    display: flex;
    align-items: center;
    gap: 8px;
}

.autopath-preview-swatch {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
}

.assigned-team {
    font-weight: bold;
}
</style>
