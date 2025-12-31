<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from "@/stores/view-mode-store";

import '@material/web/select/outlined-select';
import '@material/web/select/select-option';
import Tile from "@/components/Tile.vue";

import { getEventAnalysisLayout } from "@/lib/2025/event-analysis-layout";
import { processLayout } from "@/lib/process-layout";
</script>

<template>
    <div class="main-content">
        <h1>Event Analysis</h1>
        <h2>Graph View</h2>

        <div v-if="eventDataLoaded">
            <div v-for="tile in tileModels">
                <Tile :type="tile.type" :model="tile.model" :title="tile.title">
                </Tile>
            </div>
        </div>

        <!-- <h2>Table View</h2>
        <div class="table-container" v-if="eventDataLoaded">
            <VTable :data="tableData">
                <template #head>
                    <tr>
                        <VTh v-for="header in tableHeaders" :sortKey="header.key">
                            {{ header.name }}
                        </VTh>
                    </tr>
                </template>
                <template #body="{ rows }">
                    <tr v-for="row in rows">
                        <td v-for="col in row">{{ col }}</td>
                    </tr>
                </template>
            </VTable>
        </div> -->
    </div>
</template>

<script lang="ts">
export default {
    data() {
        return {
            eventStore: null,
            viewMode: null,
            eventDataLoaded: false,
            tileModelList: []
        }
    },
    methods: {
        async loadLayout() {
            // Note: do this to avoid stale data on page refresh.
            await this.eventStore.updateEvent();

            await this.refreshTiles();

            // Mark the table as loaded.
            this.eventDataLoaded = true;
        },
        async refreshTiles() {
            let layout = getEventAnalysisLayout(this.eventStore.eventId);
            this.tileModelList = await processLayout(layout);
        },
    },
    computed: {
        tileModels() {
            return this.tileModelList;
        },
        maxDataPoints() {
            // Only show the top 6 bar graph items if this is on a phone.
            if (this.viewMode.isMobile) {
                return 6;
            }
            return null;
        }
    },
    created() {
        this.eventStore = useEventStore();
        this.viewMode = useViewModeStore();
        this.loadLayout();

        // Do this to handle color scheme changes in charts when switching light/dark mode.
        this.viewMode.$subscribe((mutation, state) => {
            this.refreshTiles();
        })
    }
}
</script>
  
<style>
.table-container {
    display: flex;
    overflow: scroll;
    justify-content: safe center;
    margin: auto;
}
</style>
  