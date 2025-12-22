<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { dataPointColorTranslucent, getThemeColors } from '@/lib/theme';

import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
import ChartJSPluginDatalabels from 'chartjs-plugin-datalabels'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ChartJSPluginDatalabels)

</script>

<template>
    <div :style="chartStyle">
        <Bar :options="chartOptions" :data="chartData" :key="uniqueKey" />
    </div>
</template>

<script lang="ts">
export default {
    props: {
        series: "",
        labels: Array,
        values: Array,
        isSorted: {
            default: true
        },
        barColor: {
            default: dataPointColorTranslucent
        },
        height: {
            default: 100
        },
        isHorizontal: {
            default: false
        },
        xRange: {
            default: {}
        },
        yRange: {
            default: {}
        }
    },
    computed: {
        uniqueKey() {
            return JSON.stringify(this.labels) + JSON.stringify(this.values) + JSON.stringify(this.series) + JSON.stringify(getThemeColors());
        },
        chartData() {
            // Build the chart based on the processing above.
            const chart = {
                labels: this.labels,
                datasets: [{
                    label: this.series,
                    backgroundColor: this.barColor,
                    data: this.values
                }]
            };
            return chart;
        },
        chartOptions() {
            let indexAxis = 'x';
            if (this.isHorizontal) {
                indexAxis = 'y';
            }

            let options = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    datalabels: {
                        display: false
                    },
                    legend: {
                        labels: {
                            color: getThemeColors().text.legend
                        }
                    }
                },
                indexAxis: indexAxis,
                scales: {
                    x: {
                        min: this.xRange?.min,
                        max: this.xRange?.max,
                        grid: {
                            color: getThemeColors().grid.lines
                        },
                        ticks: {
                            color: getThemeColors().text.axesText
                        }
                    },
                    y: {
                        min: this.yRange?.min,
                        max: this.yRange?.max,
                        grid: {
                            color: getThemeColors().grid.lines
                        },
                        ticks: {
                            color: getThemeColors().text.axesText
                        }
                    },
                }
            };

            return options;
        },
        chartStyle() {
            return {
                "display": "flex",
                "height": this.height + "px",
                "width": "100%",
                "align-items": "safe center",
                "justify-content": "safe center"
            }
        }
    }
}
</script>
