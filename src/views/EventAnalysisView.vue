<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from "@/stores/view-mode-store";

import '@material/web/select/outlined-select';
import '@material/web/select/select-option';
import Chart from "@/components/charts/Chart.vue";

import { getEventAnalysisLayout } from "@/lib/2025/event-analysis-layout";
import { getChartModel } from "@/lib/chart-model";
</script>

<template>
    <div class="main-content">
        <h1>Event Analysis</h1>
        <h2>Graph View</h2>

        <div v-if="eventDataLoaded">
            <div class="graph-tile" v-for="chartModel in chartModels">
                <Chart :chart-type="chartModel.options.type" :data="chartModel.data" :chart-style="chartModel.style"
                    :options="chartModel.options">
                </Chart>
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
            chartModelList: []
        }
    },
    methods: {
        async loadLayout() {
            // Note: do this to avoid stale data on page refresh.
            await this.eventStore.updateEvent();

            await this.loadCharts();

            // Mark the table as loaded.
            this.eventDataLoaded = true;
        },
        async loadCharts() {
            let chartModelInputs = getEventAnalysisLayout(this.eventStore.eventId);
            let chartModels = [];
            for (var i = 0; i < chartModelInputs.length; i++) {
                const input = chartModelInputs[i];
                let chartModel = await getChartModel(input.queryInputs, input.chartInputs);
                chartModels.push(chartModel);
            }

            this.chartModelList = chartModels;
        },
    },
    computed: {
        chartModels() {
            return this.chartModelList;
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
  