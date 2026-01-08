<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { uploadFile, updatePhoto } from "@/lib/data-submission";
import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from '@/stores/view-mode-store';
import { useAuthStore } from "@/stores/auth-store";
import { projectId, robotPhotoTable, robotPhotoBucket } from "@/lib/constants";

import '@material/web/select/outlined-select';
import '@material/web/select/select-option';
import "@material/web/button/filled-button";
import draggable from 'vuedraggable'
import Dropdown from "@/components/Dropdown.vue";
import Tile from "@/components/Tile.vue";

import { supabase } from "@/lib/supabase-client";
import { getTeamAnalysisLayout } from "@/lib/2025/team-analysis-layout";
import { processLayout } from "@/lib/process-layout";
import { queryTeamNumbers } from "@/lib/data-query";
import { minWidthForDesktop } from "@/lib/constants";

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
                        <h1>Robot Photo</h1>
                        <!-- Assuming a 4:3 aspect ratio for now -->
                        <img :src="getRobotPhotoUrl" width="300" height="400" />
                        <div v-if="isUserWriteAccess">
                            <md-filled-button v-on:click="chooseFiles"
                                v-if="!teamPhotoUploading && isUserWriteAccess">Upload a
                                Different
                                Image</md-filled-button>
                            <md-filled-button v-on:click="chooseFiles" disabled v-else>Uploading...</md-filled-button>
                        </div>
                    </div>
                    <div class="file-upload-tile" v-else>
                        <h1>No robot photo available</h1>
                        <div v-if="isUserWriteAccess">
                            <md-filled-button v-on:click="chooseFiles" v-if="!teamPhotoUploading">Upload
                                Image</md-filled-button>
                            <md-filled-button v-on:click="chooseFiles" disabled v-else>Uploading...</md-filled-button>
                        </div>
                    </div>
                </div>

                <div v-if="teamsLoaded">
                    <!-- <div v-for="tile in tileModels">
                        <Tile :type="tile.type" :model="tile.model" :title="tile.title">
                        </Tile>
                    </div> -->
                    <draggable v-model="tileModelList" group="graphs" item-key="id" @end="updateLayout" handle=".handle">
                        <template #item="{ element }">
                            <Tile :type="element.type" :model="element.model" :title="element.title" class="draggable-tile"
                                can-drag="true">
                            </Tile>
                        </template>
                    </draggable>
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
            authStore: null,
            teamsLoaded: false,
            teamPhotoLoaded: false,
            teamPhotoAvailable: false,
            teamPhotoUrl: "",
            teamPhotoUploading: false,
            teamFilters: [],
            currentTeamIndex: 0,
            currentLayout: [],
            tileModelList: []
        }
    },
    methods: {
        async loadLayout() {
            // Note: do this to avoid stale data on page refresh.
            await this.eventStore.updateEvent();

            // Load all the team numbers for the event.
            await this.loadTeamNumbers();

            this.currentLayout = getTeamAnalysisLayout(this.getTeamNumber(), this.eventStore.eventId);

            // Load all the charts.
            await this.refreshTiles();

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
        async refreshTiles() {
            // Only show the top chart items if this is on a phone (for applicable chart types).
            const maxItems = this.viewMode.isMobile ? 6 : null;
            this.currentLayout.forEach(model => {
                if (model.type == 'chart') {
                    model.inputs.chartInputs.options.maxDataPoints = maxItems;
                } else if (model.type == 'filterable-chart') {
                    model.inputs.chartInputs.forEach(chartInput => {
                        chartInput.chartInputs.options.maxDataPoints = maxItems;
                    });
                }
            });

            this.tileModelList = await processLayout(this.currentLayout);
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
        updateLayout() {
            let newLayout = [];
            this.tileModelList.forEach(model => {
                const tile = this.currentLayout[model.id];
                newLayout.push(tile);
            });
            this.currentLayout = newLayout;
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
            this.refreshTiles();
            this.getRobotPhoto();
        },
        chooseFiles() {
            let fileInputElement = this.$refs.file;
            fileInputElement.click();
        },
        async uploadImage() {
            await this.authStore.checkUser();
            if (!this.authStore.isUserWriteAccess) {
                // Early exit if the user is not authorized to upload images.
                return;
            }

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
        tileModels() {
            return this.tileModelList;
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
        isUserWriteAccess() {
            return this.authStore.isWriteAuthorized;
        }
    },
    created() {
        this.viewMode = useViewModeStore();
        this.eventStore = useEventStore();
        this.authStore = useAuthStore();
        this.authStore.checkUser();

        this.loadLayout();

        // Do this to handle color scheme changes in charts when switching light/dark mode.
        this.viewMode.$subscribe((mutation, state) => {
            const isScreenWidth = mutation?.events?.key == 'screenWidth';
            const isOldWidthMobile = mutation?.events?.oldValue <= minWidthForDesktop;
            const isNewWidthMobile = mutation?.events?.newValue <= minWidthForDesktop;
            const didCrossMobileThreshold = isScreenWidth && (isOldWidthMobile != isNewWidthMobile);

            if (mutation?.events.key == 'darkMode' || didCrossMobileThreshold) {
                this.refreshTiles();
            }
        })
    }
}
</script>

<style scoped></style>
