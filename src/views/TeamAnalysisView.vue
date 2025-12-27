<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { aggregateEventData, getPitScoutData } from "@/lib/2025/data-processing";
import { teamLikertRadar, getTeamOverview, teamReefData } from "@/lib/2025/data-visualization";
import { uploadFile, updatePhoto } from "@/lib/data-submission";
import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from '@/stores/view-mode-store';
import { projectId, matchScoutTable, pitScoutTable, teamInfoTable, robotPhotoTable, robotPhotoBucket } from "@/lib/constants";

import '@material/web/select/outlined-select';
import '@material/web/select/select-option';
import "@material/web/button/filled-button";
import FilterableGraph from "@/components/FilterableGraph.vue";
import Dropdown from "@/components/Dropdown.vue";
import Chart from "@/components/charts/Chart.vue";
import StatHighlight from "@/components/StatHighlight.vue";

import { supabase } from "@/lib/supabase-client";
import { getTeamAnalysisLayout } from "@/lib/2025/team-analysis-layout";
import { getChartModel } from "@/lib/chart-model";
import { queryTeamNumbers } from "@/lib/data-query";

</script>

<template>
    <div class="main-content">
        <h1>Team Analysis</h1>
        <div v-if="teamsLoaded && isDataAvailable">
            <!-- Only show this if the team data is loaded. -->
            <Dropdown :choices="teamFilters" v-model="currentTeamIndex" @update:modelValue="setTeam"></Dropdown>

            <div>
                <div class="analysis-row-tile">
                    <input ref="file" type="file" v-on:change="uploadImage" hidden>
                    <div class="image-tile" v-if="isRobotPhotoAvailable">
                        <!-- Assuming a 4:3 aspect ratio for now -->
                        <img :src="getRobotPhotoUrl" width="300" height="400" />
                        <md-filled-button v-on:click="chooseFiles" v-if="!teamPhotoUploading">Upload a Different
                            Image</md-filled-button>
                        <md-filled-button v-on:click="chooseFiles" disabled v-else>Uploading...</md-filled-button>
                    </div>
                    <div class="file-upload-tile" v-else>
                        <md-filled-button v-on:click="chooseFiles" v-if="!teamPhotoUploading">Upload
                            Image</md-filled-button>
                        <md-filled-button v-on:click="chooseFiles" disabled v-else>Uploading...</md-filled-button>
                    </div>
                </div>

                <div v-if="teamsLoaded">
                    <div class="graph-tile" v-for="chartModel in chartModels">
                        <Chart :chart-type="chartModel.options.type" :data="chartModel.data" :chart-style="chartModel.style"
                            :options="chartModel.options">
                        </Chart>
                    </div>
                </div>
            </div>
        </div>
        <div v-else-if="teamsLoaded">
            <h2>No Data Available</h2>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    data() {
        return {
            viewMode: null,
            eventStore: null,
            teamsLoaded: false,
            teamPhotoLoaded: false,
            teamPhotoAvailable: false,
            teamPhotoUrl: "",
            teamPhotoUploading: false,
            teamFilters: [],
            currentTeamIndex: 0,
            chartModelList: []
        }
    },
    methods: {
        async loadLayout() {
            // Note: do this to avoid stale data on page refresh.
            await this.eventStore.updateEvent();

            // Load all the team numbers for the event.
            await this.loadTeamNumbers();

            // Load all the charts.
            await this.loadCharts();

            // Mark the data as ready for the view to display.
            this.teamsLoaded = true;

            // Load the robot photo.
            this.getRobotPhoto();
        },
        async loadTeamNumbers() {
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

            this.teamFilters = [];
            Object.keys(teamMap).forEach(element => {
                this.teamFilters.push(teamMap[element])
            });

            this.getRobotPhoto();
        },
        async loadCharts() {
            let chartModelInputs = getTeamAnalysisLayout(this.getTeamNumber(), this.eventStore.eventId);
            let chartModels = [];
            for (var i = 0; i < chartModelInputs.length; i++) {
                const input = chartModelInputs[i];
                let chartModel = await getChartModel(input.queryInputs, input.chartInputs);
                chartModels.push(chartModel);
            }

            this.chartModelList = chartModels;
        },
        async getRobotPhoto() {
            // This function can only work once teams are loaded due to the dependence on getTeamNumber.
            const teamNumber = this.getTeamNumber();

            // If the team number is negative, this function has been called before the teams are loaded.
            if (teamNumber < 0) {
                this.teamPhotoAvailable = false;
                this.teamPhotoLoaded = true;
                return;
            }

            // get the team photo URL
            const { data, error } = await supabase.from(robotPhotoTable).select("*").eq("team_number", teamNumber);

            if (error) {
                console.log(error);

                // Even if there is an error, mark the photo as loaded to indicate that we tried to load it and failed (via the lack of photo availability).
                this.teamPhotoLoaded = true;
                this.teamPhotoAvailable = false;
                return;
            } else if (data.length == 0) {
                // Even if there is no photo, mark the photo as loaded to indicate that we tried to load it and failed (via the lack of photo availability).
                this.teamPhotoLoaded = true;
                this.teamPhotoAvailable = false;
                return;
            }

            this.teamPhotoUrl = data[0].photo_url;
            this.teamPhotoAvailable = true;

            this.teamPhotoLoaded = true;
        },
        getTeamNumber() {
            if (this.currentTeamIndex >= this.teamFilters.length || this.teamFilters.length == 0) {
                return -1;
            }

            return this.teamFilters[this.currentTeamIndex].key;
        },
        setTeam(idx: int) {
            this.currentTeamIndex = idx;

            // Reload team data.
            this.loadCharts();
            this.getRobotPhoto();
        },
        chooseFiles() {
            let fileInputElement = this.$refs.file;
            fileInputElement.click();
        },
        async uploadImage() {
            let fileInputElement = this.$refs.file;
            if (fileInputElement.files.length > 0 && fileInputElement.files[0]) {
                let selectedFile = fileInputElement.files[0];
                const teamNumber = this.getTeamNumber();

                this.teamPhotoUploading = true;
                const fileResult = await uploadFile(selectedFile, robotPhotoBucket, String(teamNumber) + "_photo");
                this.teamPhotoUploading = false;

                if (fileResult) {
                    const data = {
                        team_number: Number(teamNumber),
                        photo_url: "https://" + projectId + ".supabase.co/storage/v1/object/public/" + robotPhotoBucket + "/" + fileResult
                    };
                    updatePhoto(data, robotPhotoTable);
                    // this.teamPhotoAvailable = true;
                    this.teamPhotoLoaded = false;
                    this.teamPhotoUrl = "";

                    // Refresh the robot photo.
                    this.getRobotPhoto();
                }
            }
        }
    },
    computed: {
        chartModels() {
            return this.chartModelList;
        },
        isDataAvailable() {
            return this.teamFilters.length > 0;
        },
        isRobotPhotoAvailable() {
            return this.teamPhotoAvailable;
        },
        getRobotPhotoUrl() {
            if (this.teamPhotoLoaded) {
                return this.teamPhotoUrl + "?" + + new Date().getTime();
            }
            return "";
        },
        getCurrentTeam() {
            if (this.currentTeamIndex >= this.teamFilters.length || this.teamFilters.length == 0) {
                return {};
            }

            return this.teamFilters[this.currentTeamIndex];
        },
    },
    created() {
        this.viewMode = useViewModeStore();
        this.eventStore = useEventStore();
        this.loadLayout();
    }
}
</script>

<style>
.radar-graph-container {
    /* height: 60vh; */
    min-width: 30vw;
}

.match-progression-container {
    min-height: 60vh;
}

.quarter-page-width {
    min-width: 25vw;
}

.half-page-width {
    min-width: 50vw;
}

.three-quarter-page-width {
    min-width: 75vw;
}
</style>
