<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import BarChart from "@/components/charts/BarChart.vue";
import LineChart from "@/components/charts/LineChart.vue";
import ScatterChart from "@/components/charts/ScatterChart.vue";
import StackedBarChart from "@/components/charts/StackedBarChart.vue";
import BoxPlot from "@/components/charts/BoxPlot.vue";
import RadarChart from "@/components/charts/RadarChart.vue";

// Needed so the chart reloads if light/dark mode is changed.
import { getThemeColors } from '@/lib/theme';

</script>

<template>
    <div class="graph-container">
        <!-- Set :key in order to force remount. This needs to happen since box plot rendering is done in mounted() rather 
            than dynamically, and because dark/light mode switching requires data refresh. -->
        <!-- Show the relevant chart based on the data being shown -->
        <BarChart :key="uniqueKey(0)" :data="chartData" :height="height" :is-horizontal="isHorizontal" :x-range="xRange"
            :y-range="yRange" v-if="isBarChartView">
        </BarChart>

        <LineChart :key="uniqueKey(1)" :data="chartData" v-else-if="isLineChartView">
        </LineChart>

        <ScatterChart :key="uniqueKey(2)" :data="chartData" :height="height" v-else-if="isScatterChartView">
        </ScatterChart>

        <BoxPlot :key="uniqueKey(3)" :data="chartData" :height="height" :max-labels="maxLabels"
            :is-horizontal="isHorizontal" :x-range="xRange" :y-range="yRange" v-else-if="isBoxPlotView">
        </BoxPlot>

        <StackedBarChart :key="uniqueKey(4)" :data="chartData" :chart-style="chartStyle" :height="height"
            v-else-if="isStackedBarChartView">
        </StackedBarChart>

        <RadarChart :key="uniqueKey(5)" :data="chartData" :chart-style="chartStyle" :height="height"
            v-else-if="isRadarChartView"></RadarChart>
    </div>
</template>

<script lang="ts">
export default {
    data() {
        return {}
    },
    props: {
        chartType: {
            default: "bar"
        },
        data: {
            default: []
        },
        chartStyle: {
            default: []
        },
        height: {
            default: 500
        },
        isHorizontal: {
            default: false
        },
        xRange: {
            default: {}
        },
        yRange: {
            default: {}
        },
        maxLabels: {
            default: null
        }
    },
    methods: {
        uniqueKey(id) {
            // TODO: make this better. This is a hack to ensure plots reload if data or filters change.
            const key = JSON.stringify(this.chartType)
                + JSON.stringify(this.chartStyle)
                + JSON.stringify(this.data)
                + JSON.stringify(this.xRange)
                + JSON.stringify(this.yRange)
                + JSON.stringify(this.height)
                + JSON.stringify(this.isHorizontal)
                + JSON.stringify(getThemeColors())
                + id;
            return key;
        },
        activeChartTypeKey() {
            return this.chartType;
        }
    },
    computed: {
        // Chart view options
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
        isRadarChartView() {
            return this.activeChartTypeKey() == "radar";
        },

        // Chart parameters
        chartData() {
            return this.data;
        },
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