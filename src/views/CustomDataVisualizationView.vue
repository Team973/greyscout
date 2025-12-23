<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from '@/stores/view-mode-store';

// Needed so the chart reloads if light/dark mode is changed.
import { getThemeColors } from '@/lib/theme';

import "@material/web/button/filled-button";

import Dropdown from "@/components/Dropdown.vue";

import Chart from "@/components/charts/Chart.vue";
import StatHighlight from "@/components/StatHighlight.vue";

import { computeCategoricalDataSeries } from "@/lib/chart-data";
import { queryTeamMatchData, queryTeamNumbers } from "@/lib/data-query";
import { defaultTeamNumber } from "@/lib/constants";


</script>

<template>
    <div class="main-content">
        <h1>Custom Data Visualization Editor</h1>
        <div>
            <Dropdown :choices="chartTypes" v-model="activeChartTypeIndex" @update:modelValue="setChartType"></Dropdown>
        </div>
        <div>
            <Dropdown :choices="queryTypes" v-model="activeQueryTypeIndex" @update:modelValue="setQueryType">
            </Dropdown>
        </div>
        <div>
            <div v-if="isTeamNumbersReady">
                <Dropdown :choices="teamNumbers" v-model="activeTeamNumberIndex" @update:modelValue="setTeamNumber">
                </Dropdown>
            </div>

            <Dropdown :choices="labelColumns" v-model="activeLabelColumnIndex" @update:modelValue="setLabelColumn">
            </Dropdown>
            <Dropdown :choices="dataColumns" v-model="activeDataColumnIndex" @update:modelValue="setDataColumn"></Dropdown>
        </div>
        <!-- <div>
            <md-filled-button v-on:click="loadNewData" class="load-button">LOAD</md-filled-button>
        </div> -->
        <div>
            <Chart :chart-type="activeChartType" :data="activeChartData" :height="maxChartHeight"
                :is-horizontal="isChartHorizontal" :x-scale="chartXScale" :y-scale="chartYScale">
            </Chart>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    data() {
        return {
            chartTypes: [
                { key: "bar", text: "Bar Graph" },
                { key: "line", text: "Line Graph" },
                { key: "scatter", text: "Scatter Plot" },
                { key: "boxplot", text: "Box Plot" },
                { key: "stacked-bar", text: "Stacked Bar Graph" },
                { key: "radar", text: "Radar" }
            ],
            activeChartTypeIndex: 0,
            queryTypes: [
                { key: "team_match_timeseries", text: "Team Match Timeseries" },
                { key: "event_rankings", text: "Event Rankings" },
            ],
            activeQueryTypeIndex: 0,
            teamNumbers: [],
            activeTeamNumberIndex: 0,
            labelColumns: [
                { key: "prematch_match_number", text: "Match Number" }
            ],
            activeLabelColumnIndex: 0,
            dataColumns: [
                { key: "auto_coral", text: "Auto Coral" },
                { key: "teleop_coral", text: "Teleop Coral" },
                { key: "teleop_net", text: "Teleop Net" }
            ],
            activeDataColumnIndex: 0,

            chartOptions: {
                maxDataPoints: null,
                isHorizontal: false,
                isSorted: true,
                xScale: null,
                yScale: null
            },
            maxHeightRatio: 0.7,
            independentAxis: null,
            dependentAxes: [],
            activeData: {},
            stagedData: {},
            chartModel: {
                data: []
            },
            isDataLoaded: false,
            isTeamNumbersReady: false,
            eventStore: null,
            viewMode: null
        }
    },
    methods: {
        setChartType(index: int) {
            this.activeChartTypeIndex = index;
            this.loadNewData();
        },
        setLabelColumn(index: int) {
            this.activeLabelColumnIndex = index;
            this.loadNewData();
        },
        setDataColumn(index: int) {
            this.activeDataColumnIndex = index;
            this.loadNewData();
        },
        setQueryType(index: int) {
            this.activeQueryTypeIndex = index;
            this.loadNewData();
        },
        setTeamNumber(index: int) {
            this.activeTeamNumberIndex = index;
            this.loadNewData();
        },
        async initializePage() {
            this.eventStore.updateEvent();

            const teamNumbersRows = await queryTeamNumbers(this.eventStore.eventId);

            // Put the teams in a dictionary first in order to sort them by team number.
            let teamMap = {};
            teamNumbersRows.forEach(element => {
                teamMap[element['team_number']] = (
                    {
                        "key": element['team_number'],
                        "text": element['team_number'] + " - " + element['name']
                    }
                );
            });


            this.teamNumbers = [];
            Object.keys(teamMap).forEach(element => {
                this.teamNumbers.push(teamMap[element])
            });


            this.isTeamNumbersReady = true;

            this.loadNewData();
        },
        async loadNewData() {
            this.stagedData = await queryTeamMatchData(this.teamNumber, this.eventStore.eventId);

            // Only update activeData if the data came back without errors.
            if (this.stagedData != null) {
                this.activeData = this.stagedData;
                this.isDataLoaded = true;
                this.updateChartModel();
            }
        },
        updateChartModel() {
            if (!this.isDataLoaded) {
                return {};
            }

            if (this.activeChartType == "bar" || this.activeChartType == "line") {
                this.chartModel.data = [];
                this.chartModel.data.push(computeCategoricalDataSeries(this.activeData, this.activeSeries, this.activeLabel, true));
            }
        }

    },
    computed: {
        // Chart Options
        maxChartHeight() {
            return this.maxHeightRatio * this.viewMode.windowHeight;
        },
        maximumDataPoints() {
            return this.chartOptions.maxDataPoints;
        },
        isChartSorted() {
            return this.chartOptions.isSorted;
        },
        isChartHorizontal() {
            return this.chartOptions.isHorizontal;
        },
        chartXScale() {
            return this.chartOptions.xScale;
        },
        chartYScale() {
            return this.chartOptions.yScale;
        },

        // View options
        activeChartType() {
            return this.chartTypes[this.activeChartTypeIndex]?.key;
        },
        isTeamNumberRequired() {
            return this.activeQuery == "team_match_timeseries";
        },

        // Chart Data
        activeLabel() {
            return this.labelColumns[this.activeLabelColumnIndex].key;
        },
        activeSeries() {
            return this.dataColumns[this.activeDataColumnIndex].key;
        },
        activeChartData() {
            if (!this.isDataLoaded) {
                return [];
            }
            return this.chartModel.data;
        },

        // Other data
        teamNumber() {
            if (!this.isTeamNumbersReady) {
                return defaultTeamNumber;
            }
            return this.teamNumbers[this.activeTeamNumberIndex].key;
        }

    },
    created() {
        this.eventStore = useEventStore();
        this.viewMode = useViewModeStore();

        this.initializePage();
    }
}
</script>

<style scoped></style>