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
import { getTeamAnalysisLayout } from "@/lib/2026/team-analysis-layout";
import { processLayout } from "@/lib/process-layout";
import { queryTeamNumbers } from "@/lib/data-query";
import { fetchTeamComments, fetchTeamPitData } from "@/lib/picklist-query";
import { minWidthForDesktop } from "@/lib/constants";

</script>

<template>
    <div class="main-content">
        <h1>Team Analysis</h1>
        <div v-if="teamLoaded && isDataAvailable">
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

                <div v-if="teamLoaded">
                    <!-- <div v-for="tile in tileModels">
                        <Tile :type="tile.type" :model="tile.model" :title="tile.title">
                        </Tile>
                    </div> -->
                    <draggable v-model="tileModelList" group="graphs" item-key="id" @end="updateLayout" handle=".handle"
                        :key="teamNumber">
                        <template #item="{ element }">
                            <Tile :type="element.type" :model="element.model" :title="element.title" class="draggable-tile"
                                can-drag="true">
                            </Tile>
                        </template>
                    </draggable>
                </div>

                <div class="pit-section">
                    <h1>Pit Scouting</h1>
                    <div v-if="!teamPitDataLoaded">Loading pit scouting data…</div>
                    <div v-else-if="teamPitData.length === 0" class="no-comments">No pit scouting data yet.</div>
                    <ul v-else class="pit-list">
                        <li v-for="(pit, idx) in teamPitData" :key="idx" class="pit-card">
                            <div class="pit-stats-grid">
                                <div class="pit-stat">
                                    <div class="pit-stat-label">Drivetrain</div>
                                    <div class="pit-stat-value">{{ formatDrivetrain(pit.drivetrain) }}</div>
                                </div>
                                <div class="pit-stat">
                                    <div class="pit-stat-label">Weight</div>
                                    <div class="pit-stat-value">{{ pit.weight != null ? pit.weight + ' lbs' : '—' }}</div>
                                </div>
                                <div class="pit-stat">
                                    <div class="pit-stat-label">Language</div>
                                    <div class="pit-stat-value">{{ formatLanguage(pit.language) }}</div>
                                </div>
                                <div class="pit-stat">
                                    <div class="pit-stat-label">Vibe Check</div>
                                    <div class="pit-stat-value">{{ pit.vibe_check != null ? pit.vibe_check + ' / 5' : '—' }}</div>
                                </div>
                            </div>
                            <div class="pit-author">Scouted by {{ pit.author }}</div>
                        </li>
                    </ul>
                </div>

                <div class="comments-section">
                    <h1>Scout Comments</h1>
                    <div v-if="!teamCommentsLoaded">Loading comments…</div>
                    <div v-else-if="teamComments.length === 0" class="no-comments">No comments from scouts yet.</div>
                    <ul v-else class="comments-list">
                        <li v-for="(comment, idx) in teamComments" :key="idx" class="comment-card">
                            <div class="comment-meta">
                                <span class="comment-author">{{ comment.author }}</span>
                                <span class="comment-source-badge">{{ comment.source }}</span>
                                <span class="comment-match" v-if="comment.match_number != null">Match
                                    {{ comment.match_number }}</span>
                            </div>
                            <p class="comment-text">{{ comment.comment }}</p>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div v-else-if="teamLoaded">
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
            teamLoaded: false,
            teamPhotoLoaded: false,
            teamPhotoAvailable: false,
            teamPhotoUrl: "",
            teamPhotoUploading: false,
            teamFilters: [],
            currentTeamIndex: 0,
            currentLayout: [],
            tileModelList: [],
            teamComments: [],
            teamCommentsLoaded: false,
            teamPitData: [],
            teamPitDataLoaded: false
        }
    },
    methods: {
        async loadLayout() {
            // Note: do this to avoid stale data on page refresh.
            await this.eventStore.updateEvent();

            // Load all the team numbers for the event.
            await this.loadTeamNumbers();

            // Load all the charts.
            await this.refreshTiles();

            // Load the robot photo.
            this.getRobotPhoto();

            // Load scout comments.
            this.loadTeamComments();

            // Load pit scouting answers.
            this.loadTeamPitData();
        },
        async loadTeamPitData() {
            const teamNumber = this.getTeamNumber();
            if (teamNumber < 0) {
                this.teamPitData = [];
                this.teamPitDataLoaded = true;
                return;
            }

            this.teamPitDataLoaded = false;
            this.teamPitData = await fetchTeamPitData(teamNumber, this.eventStore.eventId);
            this.teamPitDataLoaded = true;
        },
        formatDrivetrain(key) {
            const labels = { swerve: 'Swerve', tank: 'Tank', mecanum: 'Mecanum', other: 'Other' };
            return labels[key] ?? key ?? '—';
        },
        formatLanguage(key) {
            const labels = { java: 'Java', cpp: 'C++', python: 'Python', other: 'Other' };
            return labels[key] ?? key ?? '—';
        },
        async loadTeamComments() {
            const teamNumber = this.getTeamNumber();
            if (teamNumber < 0) {
                this.teamComments = [];
                this.teamCommentsLoaded = true;
                return;
            }

            this.teamCommentsLoaded = false;
            this.teamComments = await fetchTeamComments(teamNumber, this.eventStore.eventId);
            this.teamCommentsLoaded = true;
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
            this.teamLoaded = false;
            this.currentLayout = getTeamAnalysisLayout(this.getTeamNumber(), this.eventStore.eventId);

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
            this.teamLoaded = true;
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
            this.loadTeamComments();
            this.loadTeamPitData();
        },
        chooseFiles() {
            let fileInputElement = this.$refs.file;
            fileInputElement.click();
        },
        async uploadImage() {
            await this.authStore.checkUser();
            if (!this.authStore.isWriteAuthorized) {
                console.log("Error: user not authorized to upload images!")
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
        },
        teamNumber() {
            if (this.currentTeamIndex >= this.teamFilters.length || this.teamFilters.length == 0) {
                return -1;
            }

            return this.teamFilters[this.currentTeamIndex].key;
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

<style scoped>
.pit-section {
    margin-top: 24px;
}

.pit-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pit-card {
    background: var(--tile-background-color);
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 10px;
    padding: 12px 14px;
}

.pit-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 10px;
}

.pit-stat-label {
    font-size: 11px;
    color: rgba(128, 128, 128, 0.75);
    margin-bottom: 2px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.pit-stat-value {
    font-size: 15px;
    font-weight: 700;
    color: var(--primary-text-color);
}

.pit-author {
    margin-top: 10px;
    font-size: 11px;
    color: rgba(128, 128, 128, 0.6);
}

.comments-section {
    margin-top: 24px;
}

.no-comments {
    font-size: 13px;
    color: rgba(128, 128, 128, 0.7);
    font-style: italic;
}

.comments-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.comment-card {
    background: var(--tile-background-color);
    border: 1px solid rgba(128, 128, 128, 0.2);
    border-radius: 10px;
    padding: 10px 14px;
}

.comment-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
}

.comment-author {
    font-weight: 700;
    font-size: 13px;
    color: var(--primary-text-color);
}

.comment-source-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 20px;
    background: rgba(176, 87, 3, 0.15);
    color: #b05703;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.comment-match {
    font-size: 11px;
    color: rgba(128, 128, 128, 0.6);
    margin-left: auto;
}

.comment-text {
    font-size: 13px;
    color: var(--primary-text-color);
    line-height: 1.55;
    margin: 0;
}
</style>
