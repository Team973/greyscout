<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from '@/stores/view-mode-store';

// Needed so the chart reloads if light/dark mode is changed.
import { getThemeColors } from '@/lib/theme';


import "@material/web/button/filled-button";

import Dropdown from "@/components/Dropdown.vue";

import BarChart from "@/components/charts/BarChart.vue";
import LineChart from "@/components/charts/LineChart.vue";
import ScatterChart from "@/components/charts/ScatterChart.vue";
import StackedBarChart from "@/components/charts/StackedBarChart.vue";
import BoxPlot from "@/components/charts/BoxPlot.vue";
import RadarChart from "@/components/charts/RadarChart.vue";
import StatHighlight from "@/components/StatHighlight.vue";

import { computeBarChartDataModel } from "@/lib/chart-data";
import { queryTeamMatchData } from "@/lib/data-query";


</script>

<template>
    <div class="main-content">
        <h1>Custom Data Visualization Editor</h1>
        <div>
            <Dropdown :choices="chartTypes" v-model="activeChartTypeIndex" @update:modelValue="setChartType"></Dropdown>
        </div>
        <div>
            <Dropdown :choices="labelColumns" v-model="activeLabelColumnIndex" @update:modelValue="setLabelColumn">
            </Dropdown>
            <Dropdown :choices="dataColumns" v-model="activeDataColumnIndex" @update:modelValue="setDataColumn"></Dropdown>
        </div>
        <!-- <div>
            <md-filled-button v-on:click="loadNewData" class="load-button">LOAD</md-filled-button>
        </div> -->
        <div class="graph-container">
            <!-- Set :key in order to force remount. This needs to happen since box plot rendering is done in mounted() rather 
            than dynamically, and because dark/light mode switching requires data refresh. -->
            <!-- Show the relevant chart based on the data being shown -->
            <BarChart :key="uniqueKey(0)" :labels="chartModel.data.labels" :values="chartModel.data.values"
                :series="chartModel.data.series" :height="maxChartHeight" :is-horizontal="isChartHorizontal"
                :x-scale="chartXScale" :y-scale="chartYScale" v-if="isBarChartView">
            </BarChart>
            <ScatterChart :key="uniqueKey(1)" :data="chartData" :height="maxChartHeight" v-else-if="isScatterChartView">
            </ScatterChart>
            <LineChart :key="uniqueKey(2)" :data="chartData" :height="maxChartHeight" v-else-if="isLineChartView">
            </LineChart>
            <StackedBarChart :key="uniqueKey(3)" :data="chartData" :height="maxChartHeight"
                v-else-if="isStackedBarChartView">
            </StackedBarChart>
            <BoxPlot :key="uniqueKey(4)" :data="chartData" :isSorted="isChartSorted" :height="maxChartHeight"
                :max-labels="maximumDataPoints" :is-horizontal="isChartHorizontal" :x-range="chartXScale"
                :y-range="chartYScale" v-else-if="isBoxPlotView">
            </BoxPlot>
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
                data: {
                    labels: [],
                    values: [],
                    series: "",
                }
            },
            isDataLoaded: false,
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
        uniqueKey(id) {
            // TODO: make this better. This is a hack to ensure plots reload if data or filters change.
            const key = JSON.stringify(this.activeData) + JSON.stringify(this.chartTypes[this.activeChartTypeIndex]) + JSON.stringify(getThemeColors()) + id;
            return key;
        },
        activeChartTypeKey() {
            return this.chartTypes[this.activeChartTypeIndex]?.key;
        },
        async loadNewData() {
            this.eventStore.updateEvent();

            const teamNumber = 973;

            this.stagedData = await queryTeamMatchData(teamNumber, this.eventStore.eventId);

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

            if (this.isBarChartView) {
                this.chartModel.data = computeBarChartDataModel(this.activeData, this.activeSeries, this.activeLabel, true);
                console.log(this.chartModel.data);
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
        // View Options
        isBarChartView() {
            return this.activeChartTypeKey() == "bar";
        },
        isScatterChartView() {
            return this.activeChartTypeKey() == "scatter";
        },
        isLineChartView() {
            return this.activeChartTypeKey() == "line";
        },
        isStackedBarChartView() {
            return this.activeChartTypeKey() == "stacked-bar";
        },
        isBoxPlotView() {
            return this.activeChartTypeKey() == "boxplot";
        },
        isRadarView() {
            return this.activeChartTypeKey() == "radar";
        },

        // Chart Data
        activeLabel() {
            return this.labelColumns[this.activeLabelColumnIndex].key;
        },
        activeSeries() {
            return this.dataColumns[this.activeDataColumnIndex].key;
        },
        chartLabels() {
            if (!this.isDataLoaded) {
                return {};
            }
            return this.chartLabels;
        },
        chartValues() {
            if (!this.isDataLoaded) {
                return {};
            }
            return this.chartValues;
        },
        chartSeries() {
            if (!this.isDataLoaded) {
                return {};
            }
            return this.chartSeries;
        },

    },
    created() {
        this.eventStore = useEventStore();
        this.viewMode = useViewModeStore();
        this.loadNewData()
    }
}
</script>

<style scoped>
.graph-container {
    display: flex;
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
    justify-content: center;
}
</style>