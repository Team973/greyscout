<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import Chart from "@/components/charts/Chart.vue";
import FilterableChart from "@/components/charts/FilterableChart.vue";
</script>

<template>
    <div class="graph-tile" v-if="isChartTile">
        <h1 v-if="title">{{ title }}</h1>
        <Chart :chart-type="model.options.type" :data="model.data" :chart-style="model.style" :options="model.options">
        </Chart>
    </div>
    <div class="graph-tile" v-if="isFilterableChartTile">
        <h1 v-if="title">{{ title }}</h1>
        <FilterableChart :chart-models="model.models" :choices="model.choices">
        </FilterableChart>
    </div>
</template>

<script lang="ts">
export default {
    props: {
        type: {
            default: "chart"
        },
        model: {
            default: {}
        },
        title: {
            default: null
        }
    },
    computed: {
        isChartTile() {
            return this.type == "chart";
        },
        isFilterableChartTile() {
            return this.type == "filterable-chart";
        }
    }
}
</script>

<style scoped></style>