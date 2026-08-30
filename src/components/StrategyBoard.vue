<script setup lang="ts">
// @ts-nocheck
import StrategyCanvas from "@/components/StrategyCanvas.vue";
import Dropdown from "@/components/Dropdown.vue";
import { useEventStore } from "@/stores/event-store";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
import { strategyBoardTable } from "@/lib/constants";
import { fetchStrategyBoard } from "@/lib/strategy-query";
import { submitScoutData, updateScoutData } from "@/lib/data-submission";

import "@material/web/button/filled-button";
</script>

<template>
    <div class="strategy-board-content">
        <div class="autopath-preview-heading">
            <h3>Whiteboard</h3>
            <span v-if="saveStatus" class="confirm-text">{{ saveStatus }}</span>
        </div>
        <p v-if="!matchNumber">Enter a match number above to load or start a strategy board.</p>
        <template v-else>
            <div class="autopath-preview-selectors">
                <div class="autopath-preview-selector">
                    <span class="autopath-preview-swatch" :style="{ backgroundColor: slotColor(activeSlot) }"></span>
                    Drawing For:
                    <Dropdown :choices="slotChoices" v-model="activeSlot"></Dropdown>
                </div>
                <md-filled-button v-on:click="clearActiveSlot" class="reset-button">
                    CLEAR {{ activeTeamLabel }}'S STROKES
                </md-filled-button>
            </div>
            <StrategyCanvas :board="board" :active-slot="activeSlot" :slot-color="slotColor"
                @update:board="onBoardUpdate"></StrategyCanvas>
        </template>
    </div>
</template>

<script lang="ts">
export default {
    props: {
        matchNumber: {
            type: [Number, String],
            default: null
        },
        teamNumbers: {
            type: Array,
            required: true
        },
        teamFilters: {
            type: Array,
            required: true
        },
        slotColor: {
            type: Function,
            required: true
        }
    },
    data() {
        return {
            eventStore: null,
            queueStore: null,
            boardId: null,
            board: [],
            activeSlot: 0,
            saveStatus: '',
            saveTimer: null,
            statusTimer: null
        };
    },
    computed: {
        slotChoices() {
            const labels = ['Red 1', 'Red 2', 'Red 3', 'Blue 1', 'Blue 2', 'Blue 3'];
            return [0, 1, 2, 3, 4, 5].map((slot) => ({
                key: slot,
                text: `${labels[slot]} — ${this.teamFilters.find((t) => t.key === this.teamNumbers[slot])?.text ?? 'Unassigned'}`
            }));
        },
        activeTeamLabel() {
            return this.teamFilters.find((t) => t.key === this.teamNumbers[this.activeSlot])?.text ?? 'Team';
        }
    },
    watch: {
        matchNumber() {
            this.loadBoard();
        }
    },
    methods: {
        async loadBoard() {
            if (!this.matchNumber) {
                this.board = [];
                this.boardId = null;
                return;
            }

            const result = await fetchStrategyBoard(this.eventStore.eventId, Number(this.matchNumber));
            this.boardId = result.id;
            this.board = result.board;
        },
        onBoardUpdate(newBoard) {
            this.board = newBoard;
            this.scheduleSave();
        },
        clearActiveSlot() {
            this.board = this.board.filter((entry) => entry.slot !== this.activeSlot);
            this.scheduleSave();
        },
        scheduleSave() {
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.save(), 800);
        },
        async save() {
            if (!this.matchNumber) return;

            const data = { event: this.eventStore.eventId, match_number: Number(this.matchNumber), board: this.board };

            let error;
            if (this.boardId != null) {
                error = await updateScoutData(this.boardId, data, strategyBoardTable);
            } else {
                error = await submitScoutData(data, strategyBoardTable);
                if (!error) {
                    const result = await fetchStrategyBoard(this.eventStore.eventId, Number(this.matchNumber));
                    this.boardId = result.id;
                }
            }

            clearTimeout(this.statusTimer);
            if (error) {
                console.log(error);
                this.queueStore.enqueue(
                    'strategy_board',
                    { table: strategyBoardTable, data, id: this.boardId },
                    error.message ?? String(error)
                );
                this.saveStatus = "Couldn't save — queued for sync.";
            } else {
                this.saveStatus = 'Saved';
            }
            this.statusTimer = setTimeout(() => { this.saveStatus = ''; }, 2000);
        }
    },
    beforeUnmount() {
        clearTimeout(this.saveTimer);
        clearTimeout(this.statusTimer);
    },
    created() {
        this.eventStore = useEventStore();
        this.queueStore = useOfflineQueueStore();
        this.loadBoard();
    }
};
</script>
