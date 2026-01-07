<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { uploadFile, updatePhoto } from "@/lib/data-submission";
import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from '@/stores/view-mode-store';
import { useAuthStore } from "@/stores/auth-store";
import { matchScoutTable } from "@/lib/constants";

import '@material/web/select/outlined-select';
import '@material/web/select/select-option';
import "@material/web/button/filled-button";

import { supabase } from "@/lib/supabase-client";
import { getTeamAnalysisLayout } from "@/lib/2025/team-analysis-layout";
import { processLayout } from "@/lib/process-layout";
import { queryTeamNumbers } from "@/lib/data-query";
import { minWidthForDesktop } from "@/lib/constants";

</script>

<template>
    <div class="main-content">
        <h1>Data Upload</h1>
        <div v-if="authStore.isWriteAuthorized">
            <div>
                <div class="analysis-row-tile">
                    <input ref="file" type="file" v-on:change="uploadData" hidden>
                    <div class="file-upload-tile">
                        <div v-if="isUserWriteAccess">
                            <md-filled-button v-on:click="chooseFiles" v-if="!dataUploading">Upload
                                Data</md-filled-button>
                            <md-filled-button v-on:click="chooseFiles" disabled v-else>Uploading...</md-filled-button>
                        </div>
                    </div>
                </div>
            </div>
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
        }
    },
    methods: {
        async loadLayout() {
            // Note: do this to avoid stale data on page refresh.
            await this.eventStore.updateEvent();
        },
        chooseFiles() {
            let fileInputElement = this.$refs.file;
            fileInputElement.click();
        },
        async uploadData() {
            await this.authStore.checkUser();
            if (!this.authStore.isUserWriteAccess) {
                // Early exit if the user is not authorized to upload images.
                return;
            }

            let fileInputElement = this.$refs.file;
            if (fileInputElement.files.length > 0 && fileInputElement.files[0]) {
                let selectedFile = fileInputElement.files[0];

                this.dataUploading = true;

                // TODO: upload data to database.

                this.dataUploading = false;
            }
        }
    },
    computed: {
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
        // this.viewMode.$subscribe((mutation, state) => {
        //     const isScreenWidth = mutation?.events?.key == 'screenWidth';
        //     const isOldWidthMobile = mutation?.events?.oldValue <= minWidthForDesktop;
        //     const isNewWidthMobile = mutation?.events?.newValue <= minWidthForDesktop;
        //     const didCrossMobileThreshold = isScreenWidth && (isOldWidthMobile != isNewWidthMobile);

        //     if (mutation?.events.key == 'darkMode' || didCrossMobileThreshold) {
        //         this.refreshTiles();
        //     }
        // })
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
