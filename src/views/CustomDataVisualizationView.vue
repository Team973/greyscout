<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from '@/stores/view-mode-store';


import "@material/web/button/filled-button";
import "@material/web/chips/chip-set";
import "@material/web/chips/filter-chip";

import Dropdown from "@/components/Dropdown.vue";
import ResizableList from "@/components/ResizableList.vue";
import Chart from "@/components/charts/Chart.vue";
import StatHighlight from "@/components/StatHighlight.vue";


import { randomColorWheel } from '@/lib/theme';
import { computeDiscreteDataSeries, computeCartesianDataSeries, computeSampledDataSeries } from "@/lib/chart-data";
import { queryTeamMatchData, queryTeamNumbers, queryEventData } from "@/lib/data-query";
import { aggregateData } from "@/lib/data-transforms";
import { defaultTeamNumber } from "@/lib/constants";
import { mean } from "simple-statistics";


</script>

<template>
    <div class="main-content">
        <h1>Custom Data Visualization Editor</h1>
        <div>
            Plot: <Dropdown :choices="chartTypes" v-model="activeChartTypeIndex" @update:modelValue="setChartType">
            </Dropdown>
        </div>
        <div>
            Query: <Dropdown :choices="queryTypes" v-model="activeQueryTypeIndex" @update:modelValue="setQueryType">
            </Dropdown>
        </div>
        <div>
            <div v-if="isTeamNumbersReady">
                Team: <Dropdown :choices="teamNumbers" v-model="activeTeamNumberIndex" @update:modelValue="setTeamNumber">
                </Dropdown>
            </div>

            Independent: <Dropdown :choices="independentColumns" v-model="activeIndependentColumnIndex"
                @update:modelValue="setLabelColumn">
            </Dropdown>
            <div v-if="activeChartType == 'scatter'">
                X: <Dropdown :choices="dataColumns" v-model="activeDataXColumnIndex" @update:modelValue="setDataColumnX">
                </Dropdown>
                Y: <Dropdown :choices="dataColumns" v-model="activeDataYColumnIndex" @update:modelValue="setDataColumnY">
                </Dropdown>
            </div>
            <div v-else-if="activeChartType == 'stacked-bar' || activeChartType == 'radar'">
                Series:
                <ResizableList :item-list="dropdownList" item-type-name="series" @item-added="addDropdownListItem()"
                    @item-removed="removeDropdownListItem(index)">
                    <template v-slot:item-content="{ index }">
                        <Dropdown :choices="dataColumns" v-model="dropdownList[index]['series']"
                            @update:modelValue="setDropdownValue($event, index)">
                        </Dropdown>
                    </template>
                </ResizableList>
            </div>
            <div v-else>
                Y: <Dropdown :choices="dataColumns" v-model="activeDataYColumnIndex" @update:modelValue="setDataColumnY">
                </Dropdown>
            </div>

            <md-chip-set class="horizontal-chip-set">
                <md-filter-chip v-for="chip, idx in filterChips" :label="chip.label" @click="toggleChip(idx)"
                    v-bind:selected="chip.value" v-bind:disabled="chip.isDisabled"
                    class="horizontal-chip-set-chip"></md-filter-chip>
            </md-chip-set>

        </div>

        <div>
            <Chart :chart-type="activeChartType" :data="activeChartData" :chart-style="activeChartStyle"
                :height="maxChartHeight" :is-horizontal="isChartHorizontal" :x-scale="chartXScale" :y-scale="chartYScale">
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
                { key: "team_comparison", text: "Team Comparison" },
            ],
            activeQueryTypeIndex: 0,
            teamNumbers: [],
            activeTeamNumberIndex: 0,
            independentColumns: [
                { key: "prematch_match_number", text: "Match Number" },
                { key: "prematch_team_number", text: "Team Number" }
            ],
            activeIndependentColumnIndex: 0,
            dataColumns: [
                { key: "auto_coral", text: "Auto Coral" },
                { key: "auto_leave", text: "Auto Leave" },
                { key: "teleop_coral", text: "Teleop Coral" },
                { key: "teleop_net", text: "Net" },
                { key: "teleop_processor", text: "Processor" },
                { key: "endgame_climb", text: "Climb" },
                { key: "postmatch_defense", text: "Defense" },
                { key: "postmatch_died", text: "Died" }
            ],
            activeDataYColumnIndex: 0,
            activeDataXColumnIndex: 0,
            dropdownList: [],
            chips: [
                { key: "isSorted", label: "Sorted?", value: false, isDisabled: false },
                { key: "isHorizontal", label: "Horizontal?", value: false, isDisabled: false }
            ],
            chartOptions: {
                isSorted: false,
                isHorizontal: false,
                maxDataPoints: null,
                xScale: null,
                yScale: null
            },
            maxHeightRatio: 0.7,
            independentAxis: null,
            dependentAxes: [],
            activeData: {},
            stagedData: {},
            chartModel: {
                data: [],
                style: []
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
            this.activeIndependentColumnIndex = index;
            this.loadNewData();
        },
        setDataColumnY(index: int) {
            this.activeDataYColumnIndex = index;
            this.loadNewData();
        },
        setDataColumnX(index: int) {
            this.activeDataXColumnIndex = index;
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
        toggleChip(index: int) {
            this.chips[index].value = !this.chips[index].value;
            const key = this.chips[index].key;
            this.chartOptions[key] = this.chips[index].value;
            this.loadNewData();
        },

        // Expanding dropdown list.
        setDropdownValue(index: number, dropdownIndex: number) {
            this.dropdownList[dropdownIndex]['series'] = index;
            this.loadNewData();
        },
        addDropdownListItem() {
            const defaultItem = { 'series': 0 };
            this.dropdownList.push(defaultItem);
            this.loadNewData();
        },
        removeDropdownListItem(index: number) {
            this.dropdownList.splice(index, 1);
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
            if (this.activeQuery == "team_match_timeseries") {
                this.stagedData = await queryTeamMatchData(this.teamNumber, this.eventStore.eventId);
            } else if (this.activeQuery == "event_rankings") {
                this.stagedData = await queryEventData(this.eventStore.eventId);
            }

            // Only update activeData if the data came back without errors.
            if (this.stagedData != null) {
                this.activeData = this.stagedData;
                this.isDataLoaded = true;
                this.updateChartModel();
            }
        },
        updateChartModel() {
            if (!this.isDataLoaded) {
                return [];
            }

            // Perform data aggregation when in certain modes.
            if (this.activeQuery == "event_rankings" && this.activeChartType != "boxplot") {
                this.activeData = aggregateData(this.activeData, this.activeIndependentCol, mean);
            }

            this.chartModel.style = [];
            this.chartModel.data = [];

            if (this.activeChartType == "bar" || this.activeChartType == "line") {
                this.chartModel.data.push(computeDiscreteDataSeries(this.activeData, this.activeIndependentCol, this.activeSeriesY, this.isChartSorted));
            } else if (this.activeChartType == "scatter") {
                this.chartModel.data.push(computeCartesianDataSeries(this.activeData, this.activeSeriesX, this.activeSeriesY, this.activeIndependentCol, true))
            } else if (this.activeChartType == "boxplot") {
                this.chartModel.data = computeSampledDataSeries(this.activeData, this.activeIndependentCol, this.activeSeriesY, this.isChartSorted);
            } else if (this.activeChartType == "stacked-bar") {
                for (var i = 0; i < this.dropdownList.length; i++) {
                    const index = this.dropdownList[i]['series'];
                    const dropdownColumn = this.dataColumns[index];

                    this.chartModel.data.push(computeDiscreteDataSeries(this.activeData, this.activeIndependentCol, dropdownColumn.key));
                    this.chartModel.style.push({
                        "color": randomColorWheel[i % randomColorWheel.length]
                    });
                }
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
        filterChips() {
            return this.chips;
        },

        // Data
        activeIndependentCol() {
            return this.independentColumns[this.activeIndependentColumnIndex].key;
        },
        activeSeriesY() {
            return this.dataColumns[this.activeDataYColumnIndex].key;
        },
        activeSeriesX() {
            return this.dataColumns[this.activeDataXColumnIndex].key;
        },
        activeChartData() {
            if (!this.isDataLoaded) {
                return [];
            }
            return this.chartModel.data;
        },
        activeChartStyle() {
            return this.chartModel.style;
        },
        activeQuery() {
            return this.queryTypes[this.activeQueryTypeIndex].key;
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