<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from '@/stores/view-mode-store';
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
import { teamInfoTable, autoPathTable, allianceRed, allianceBlue } from "@/lib/constants";
import { fetchTeamAutoPaths } from "@/lib/auto-path-query";
import { fetchRobotPhotoUrl } from "@/lib/robot-photo-query";
import { submitScoutData } from "@/lib/data-submission";
import { queryMatchTeams } from "@/lib/data-query";
import { SIDE_CHOICES, transformPath } from "@/lib/2026/auto-path-field";

import '@material/web/select/outlined-select';
import '@material/web/select/select-option';
import Dropdown from "@/components/Dropdown.vue";
import NumberInput from "@/components/Number.vue";
import TextInput from "@/components/TextInput.vue";
import Switch from "@/components/Switch.vue";
import AutoPathCanvas from "@/components/AutoPathCanvas.vue";
import StrategyBoard from "@/components/StrategyBoard.vue";
import FullscreenTile from "@/components/FullscreenTile.vue";
import ColorSwatchPicker from "@/components/ColorSwatchPicker.vue";
import { supabase } from "@/lib/supabase-client";

import "@material/web/button/filled-button";
</script>

<template>
    <div class="main-content">
        <h1>Strategy</h1>
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
                    <div v-for="(slot, i) in [0, 1, 2]" :key="slot" class="autopath-preview-selector alliance-slot-row">
                        <span class="alliance-slot-label">Red {{ i + 1 }}:</span>
                        <ColorSwatchPicker :choices="COLOR_CHOICES" v-model="slotColorIndex[slot]"></ColorSwatchPicker>
                        <Dropdown v-if="manualTeamSelection" :choices="teamFilters" v-model="teamIndices[slot]"
                            @update:modelValue="setTeam(slot, $event)"></Dropdown>
                        <span v-else class="assigned-team">{{ teamFilters[teamIndices[slot]]?.text ?? 'Unassigned' }}</span>
                    </div>
                </div>
            </div>

            <h2>Blue Alliance</h2>
            <div class="data-tile blue-alliance">
                <div class="autopath-preview-selectors">
                    <div v-for="(slot, i) in [3, 4, 5]" :key="slot" class="autopath-preview-selector alliance-slot-row">
                        <span class="alliance-slot-label">Blue {{ i + 1 }}:</span>
                        <ColorSwatchPicker :choices="COLOR_CHOICES" v-model="slotColorIndex[slot]"></ColorSwatchPicker>
                        <Dropdown v-if="manualTeamSelection" :choices="teamFilters" v-model="teamIndices[slot]"
                            @update:modelValue="setTeam(slot, $event)"></Dropdown>
                        <span v-else class="assigned-team">{{ teamFilters[teamIndices[slot]]?.text ?? 'Unassigned' }}</span>
                    </div>
                </div>
            </div>

            <!-- Preview / Auto Edit / Whiteboard all live in this one tile so
                 switching modes never means scrolling away from the field —
                 and so fullscreen (via FullscreenTile) covers every control
                 for whichever mode is active. -->
            <FullscreenTile class="data-tile strategy-main-tile">
                <div class="strategy-mode-toggle">
                    <md-filled-button v-on:click="strategyMode = 'preview'"
                        :class="{ 'mode-inactive': strategyMode !== 'preview' }">Preview</md-filled-button>
                    <md-filled-button v-on:click="strategyMode = 'autoEdit'"
                        :class="{ 'mode-inactive': strategyMode !== 'autoEdit' }">Auto Edit</md-filled-button>
                    <md-filled-button v-on:click="strategyMode = 'whiteboard'"
                        :class="{ 'mode-inactive': strategyMode !== 'whiteboard' }">Whiteboard</md-filled-button>
                </div>

                <template v-if="strategyMode === 'preview' || strategyMode === 'autoEdit'">
                    <div class="autopath-preview-heading">
                        <h3>Auto Path Preview</h3>
                    </div>

                    <template v-if="strategyMode === 'autoEdit'">
                        <div class="autopath-form-row autopath-selectors">
                            <div class="autopath-selector">
                                <label>Drawing For</label>
                                <Dropdown :choices="slotChoices" v-model="autoEditSlot"
                                    @update:modelValue="onAutoEditSlotChange"></Dropdown>
                            </div>
                            <div class="autopath-selector">
                                <label>Side</label>
                                <Dropdown :choices="SIDE_CHOICES" v-model="autoEditSideIndex"></Dropdown>
                            </div>
                        </div>
                        <div class="autopath-form-row">
                            <TextInput v-model="autoEditName" label="Path Name" :required="true"
                                :error="autoEditNameError"></TextInput>
                        </div>
                    </template>

                    <div class="autopath-canvas-full">
                        <AutoPathCanvas :layers="combinedLayers" :editable="strategyMode === 'autoEdit'"
                            :points="strategyMode === 'autoEdit' ? autoEditPoints : []"
                            :display-alliance="autoEditAlliance" :time-gradient="strategyMode === 'autoEdit'"
                            :robot-photo-url="strategyMode === 'autoEdit' ? robotPhotoUrls[autoEditSlot] : null"
                            large="true" :playing="isPlaying" @update:points="autoEditPoints = $event"
                            @finished="isPlaying = false"></AutoPathCanvas>
                    </div>

                    <div class="autopath-bottom-controls">
                        <span>Show Red</span>
                        <Switch :model-value="showRedPaths" @update:modelValue="showRedPaths = $event"></Switch>
                        <span>Show Blue</span>
                        <Switch :model-value="showBluePaths" @update:modelValue="showBluePaths = $event"></Switch>
                        <md-filled-button v-on:click="isPlaying = !isPlaying" class="play-button">
                            {{ isPlaying ? "■ STOP" : "▶ PLAY" }}
                        </md-filled-button>
                    </div>

                    <template v-if="strategyMode === 'autoEdit'">
                        <div v-if="autoEditPathError" class="data-tile error-tile">Draw at least a couple of points
                            before saving.</div>
                        <div class="autopath-actions">
                            <md-filled-button v-on:click="autoEditPoints = []" class="reset-button">RESET</md-filled-button>
                            <md-filled-button v-on:click="saveAutoEditPath" class="submit-button">SAVE PATH</md-filled-button>
                            <span v-if="autoEditSavedMessage" class="confirm-text">{{ autoEditSavedMessage }}</span>
                        </div>
                    </template>

                    <!-- Per-slot controls sit in two columns below the (now
                         full-width) field, red on the left / blue on the
                         right so they still line up with their alliance. -->
                    <div class="autopath-side-by-side">
                        <div class="autopath-side-column">
                            <div v-for="slot in [0, 1, 2]" :key="slot" class="autopath-slot-controls">
                                <span class="autopath-preview-swatch" :style="{ backgroundColor: slotColor(slot) }"></span>
                                <Dropdown :choices="autoPathChoices[slot] ?? []" :model-value="selectedAutoPathIndex[slot]"
                                    @update:modelValue="onAutoPathChoiceChange(slot, $event)"></Dropdown>
                                <Dropdown :choices="SIDE_CHOICES" v-model="selectedSideIndex[slot]"></Dropdown>
                                <NumberInput :model-value="selectedDelaySeconds[slot]"
                                    @update:modelValue="selectedDelaySeconds[slot] = $event" label="Delay (s)"></NumberInput>
                            </div>
                        </div>

                        <div class="autopath-side-column">
                            <div v-for="slot in [3, 4, 5]" :key="slot" class="autopath-slot-controls">
                                <span class="autopath-preview-swatch" :style="{ backgroundColor: slotColor(slot) }"></span>
                                <Dropdown :choices="autoPathChoices[slot] ?? []" :model-value="selectedAutoPathIndex[slot]"
                                    @update:modelValue="onAutoPathChoiceChange(slot, $event)"></Dropdown>
                                <Dropdown :choices="SIDE_CHOICES" v-model="selectedSideIndex[slot]"></Dropdown>
                                <NumberInput :model-value="selectedDelaySeconds[slot]"
                                    @update:modelValue="selectedDelaySeconds[slot] = $event" label="Delay (s)"></NumberInput>
                            </div>
                        </div>
                    </div>
                </template>

                <template v-else-if="strategyMode === 'whiteboard'">
                    <StrategyBoard :match-number="matchNumber" :team-indices="teamIndices" :team-filters="teamFilters"
                        :slot-color="slotColor"></StrategyBoard>
                </template>
            </FullscreenTile>
        </div>
        <div v-else-if="teamsLoaded">
            <h2>No Data Available</h2>
        </div>
    </div>
</template>

<script lang="ts">
// Fixed palette a team's color can be chosen from (issue #32 feedback) —
// at least 6 distinct colors, with 2 extras (magenta/white) for the rare
// case all 6 defaults collide with a scout's preference. Declared here
// (not in <script setup>) so it's plain module scope reachable from both
// this Options block's methods and, via data() below, the template.
const COLOR_CHOICES = [
    { key: 'red', text: 'Red', hex: '#e5383b' },
    { key: 'orange', text: 'Orange', hex: '#e08a1e' },
    { key: 'yellow', text: 'Yellow', hex: '#f2c14e' },
    { key: 'green', text: 'Green', hex: '#1eae7a' },
    { key: 'blue', text: 'Blue', hex: '#2f7de1' },
    { key: 'purple', text: 'Purple', hex: '#8a3fd1' },
    { key: 'magenta', text: 'Magenta', hex: '#d13f6a' },
    { key: 'white', text: 'White', hex: '#f2f2f2' }
];

export default {
    data() {
        return {
            deviceViewMode: null,
            eventStore: null,
            queueStore: null,
            teamsLoaded: false,
            teamFilters: [],
            teamIndices: [0, 0, 0, 0, 0, 0],
            matchNumber: null,
            matchLookupFailed: false,
            // Default is schedule-driven auto-assignment; flip on to hand-pick
            // teams instead (e.g. the schedule hasn't been synced yet).
            manualTeamSelection: false,
            // Which top-level mode the page is in — merges the old separate
            // Match Preview view with the new in-place path creation and
            // whiteboard strategy board behind one toggle.
            strategyMode: 'preview',
            // Per-slot dropdown choices ({key, text, path}) of that slot's team's saved auto paths,
            // plus a leading "None" option. Index aligns with teamIndices (0-2 red, 3-5 blue).
            autoPathChoices: [[], [], [], [], [], []],
            selectedAutoPathIndex: [0, 0, 0, 0, 0, 0],
            // Which side (left/right) to preview each slot's chosen path as — defaults to
            // the path's own recorded side, but can be flipped independently per slot.
            selectedSideIndex: [0, 0, 0, 0, 0, 0],
            // Visualization-only playback delay per slot, in seconds — not
            // persisted, just staggers when each marker starts moving.
            selectedDelaySeconds: [0, 0, 0, 0, 0, 0],
            // Per-slot robot photo URL (or null), used by the combined
            // canvas's per-layer marker and by the Auto Edit active marker.
            robotPhotoUrls: [null, null, null, null, null, null],
            showRedPaths: true,
            showBluePaths: true,
            // Index into COLOR_CHOICES per slot — user-selectable team color
            // (issue #32 feedback), defaulting to 6 distinct colors so every
            // slot starts visually unique; magenta/white are extra choices.
            slotColorIndex: [0, 1, 2, 3, 4, 5],
            isPlaying: false,
            // Auto Edit mode state — drawing a brand-new path in place,
            // auto-named "Match N Path" by default.
            autoEditSlot: 0,
            autoEditName: '',
            // The default name last auto-applied — used to tell "the scout
            // hasn't touched the name yet" apart from "the scout typed
            // something," so a later match-number change can keep the
            // default in sync without clobbering a manual edit.
            previousAutoEditDefault: '',
            autoEditSideIndex: 0,
            autoEditPoints: [],
            autoEditNameError: false,
            autoEditPathError: false,
            autoEditSavedMessage: '',
            SIDE_CHOICES,
            COLOR_CHOICES
        }
    },
    watch: {
        matchNumber() {
            this.refreshAutoEditDefaultName();
        },
        manualTeamSelection() {
            this.refreshAutoEditDefaultName();
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
            this.robotPhotoUrls[slot] = null;

            if (slot >= this.teamIndices.length || this.teamFilters.length === 0) {
                this.autoPathChoices[slot] = [{ key: 'none', text: 'No Auto Selected', path: null }];
                return;
            }

            const teamIndex = this.teamIndices[slot];
            const teamNumber = Number(this.teamFilters[teamIndex].key);
            const paths = await fetchTeamAutoPaths(teamNumber, this.eventStore.eventId);
            fetchRobotPhotoUrl(teamNumber).then((url) => { this.robotPhotoUrls[slot] = url; });

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
            return COLOR_CHOICES[this.slotColorIndex[slot]]?.hex ?? '#ff8c00';
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
        },
        onAutoEditSlotChange() {
            this.autoEditPoints = [];
            this.autoEditSideIndex = 0;
            this.autoEditName = this.autoEditDefaultName();
            this.previousAutoEditDefault = this.autoEditName;
        },
        // Auto-named from the match number by default. When teams are
        // manually selected, the match number may not correspond to a real
        // scheduled match, so auto-naming from it would be misleading —
        // leave the name blank instead and let the scout type their own.
        autoEditDefaultName() {
            if (this.manualTeamSelection) return '';
            return this.matchNumber ? `Match ${this.matchNumber} Path` : '';
        },
        // Keeps the auto-generated name in sync as the match number (or
        // manual-selection toggle) changes — but only while the scout
        // hasn't typed their own name over the last auto-applied default.
        refreshAutoEditDefaultName() {
            const nextDefault = this.autoEditDefaultName();
            if (this.autoEditName === this.previousAutoEditDefault) {
                this.autoEditName = nextDefault;
            }
            this.previousAutoEditDefault = nextDefault;
        },
        async saveAutoEditPath() {
            this.autoEditNameError = this.autoEditName.trim() === '';
            this.autoEditPathError = this.autoEditPoints.length < 2;
            if (this.autoEditNameError || this.autoEditPathError) return;

            const teamIndex = this.teamIndices[this.autoEditSlot];
            const teamNumber = Number(this.teamFilters[teamIndex]?.key);
            const data = {
                team_number: teamNumber,
                name: this.autoEditName.trim(),
                alliance: this.autoEditAlliance,
                side: SIDE_CHOICES[this.autoEditSideIndex]?.key,
                path: this.autoEditPoints,
                event: this.eventStore.eventId
            };

            const error = await submitScoutData(data, autoPathTable);
            if (error) {
                console.log(error);
                this.queueStore.enqueue('scout_data', { table: autoPathTable, data, id: null }, error.message ?? String(error));
                this.autoEditSavedMessage = "Couldn't save — queued for sync.";
            } else {
                this.autoEditSavedMessage = 'Saved!';
            }

            this.autoEditPoints = [];
            await this.loadAutoPathChoices(this.autoEditSlot);
            setTimeout(() => { this.autoEditSavedMessage = ''; }, 4000);
        }
    },
    computed: {
        isDataAvailable() {
            return this.teamFilters.length > 0;
        },
        // Builds every slot with a selected path into one set of layers for
        // a single combined canvas — each layer carries its own alliance so
        // red and blue render together (see AutoPathCanvas's per-layer
        // alliance support), filtered by the show/hide alliance toggles.
        // display-alliance stays out of this entirely: alliance-based
        // placement is driven per-layer now, not by a canvas-wide prop (see
        // auto-path-field.ts's file header for why that placement must stay
        // centralized in AutoPathCanvas's toView). Side, unlike alliance, is
        // a real mirror within the stored frame, so it's applied here via
        // transformPath before handing points to the canvas.
        combinedLayers() {
            const layers = [];

            [0, 1, 2, 3, 4, 5].forEach((slot) => {
                const alliance = slot < 3 ? allianceRed : allianceBlue;
                if (alliance === allianceRed && !this.showRedPaths) return;
                if (alliance === allianceBlue && !this.showBluePaths) return;

                const choiceIdx = this.selectedAutoPathIndex[slot];
                const choice = this.autoPathChoices[slot]?.[choiceIdx];
                if (!choice || !choice.path) return;

                const targetSide = SIDE_CHOICES[this.selectedSideIndex[slot]]?.key ?? choice.path.side;
                const points = transformPath(choice.path.points, choice.path.side, targetSide);
                const delaySeconds = Number(this.selectedDelaySeconds[slot]) || 0;

                layers.push({
                    key: `slot-${slot}`,
                    points,
                    color: this.slotColor(slot),
                    alliance,
                    photoUrl: this.robotPhotoUrls[slot] ?? null,
                    delayFraction: delaySeconds > 0 ? (delaySeconds * 1000) / 20000 : 0
                });
            });

            return layers;
        },
        slotChoices() {
            const labels = ['Red 1', 'Red 2', 'Red 3', 'Blue 1', 'Blue 2', 'Blue 3'];
            return [0, 1, 2, 3, 4, 5].map((slot) => ({
                key: slot,
                text: `${labels[slot]} — ${this.teamFilters[this.teamIndices[slot]]?.text ?? 'Unassigned'}`
            }));
        },
        autoEditAlliance() {
            return this.autoEditSlot < 3 ? allianceRed : allianceBlue;
        }
    },
    created() {
        this.deviceViewMode = useViewModeStore();
        this.eventStore = useEventStore();
        this.queueStore = useOfflineQueueStore();
        this.autoEditName = this.autoEditDefaultName();
        this.previousAutoEditDefault = this.autoEditName;
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

.autopath-preview-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
}

.autopath-preview-selectors {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    margin-bottom: 12px;
}

.autopath-preview-selector {
    display: flex;
    align-items: center;
    gap: 10px;
}

.alliance-slot-row {
    padding: 6px 0;
}

.alliance-slot-label {
    font-weight: 600;
    min-width: 52px;
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

.strategy-mode-toggle {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
}

.strategy-mode-toggle md-filled-button.mode-inactive {
    --md-filled-button-container-color: rgba(128, 128, 128, 0.4);
}

.autopath-form-row {
    margin-bottom: 20px;
}

.autopath-selectors {
    display: flex;
    gap: 28px;
}

.autopath-selector {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.autopath-selector label {
    font-size: 11px;
    color: rgba(128, 128, 128, 0.75);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

/* The field fills the full width of the tile; per-slot controls sit in two
   columns below it (red left, blue right) instead of narrowing the canvas
   by flanking it. The shared .data-tile class is a centered flex column
   (align-items: center), which shrink-wraps block children to their
   content width by default — align-self: stretch opts these specific
   sections back into filling the tile's full width. */
.autopath-canvas-full {
    align-self: stretch;
    margin-bottom: 20px;
}

.autopath-bottom-controls {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
    margin-bottom: 20px;
}

.autopath-side-by-side {
    align-self: stretch;
    display: flex;
    gap: 32px;
    margin-top: 28px;
}

.autopath-side-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
}

.autopath-slot-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

@media (max-width: 820px) {
    .autopath-side-by-side {
        flex-direction: column;
        gap: 24px;
    }
}

.autopath-actions {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    margin-top: 16px;
    margin-bottom: 8px;
}

.confirm-text {
    font-size: 13px;
    color: var(--primary-text-color);
}

.strategy-board-content {
    align-self: stretch;
    width: 100%;
}

.strategy-board-content .autopath-preview-selectors {
    margin-bottom: 20px;
}
</style>
