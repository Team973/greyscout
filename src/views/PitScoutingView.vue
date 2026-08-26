<script setup lang="ts">
// @ts-nocheck
import Dropdown from "@/components/Dropdown.vue";
import PitScoutingSection from "@/components/PitScoutingSection.vue";

import { useEventStore } from "@/stores/event-store";
import { queryTeamNumbers } from "@/lib/data-query";
</script>

<template>
    <div class="main-content">
        <div v-if="isDataAvailable">
            <Dropdown :choices="teamFilters" v-model="currentTeamIndex"></Dropdown>

            <PitScoutingSection :team-number="teamNumber"></PitScoutingSection>
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
            eventStore: null,
            teamsLoaded: false,
            teamFilters: [],
            currentTeamIndex: 0
        }
    },
    methods: {
        async loadTeamNumbers() {
            await this.eventStore.updateEvent();
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

            this.teamsLoaded = true;
        }
    },
    computed: {
        isDataAvailable() {
            return this.teamFilters.length > 0;
        },
        teamNumber() {
            if (this.currentTeamIndex >= this.teamFilters.length || this.teamFilters.length == 0) {
                return -1;
            }

            return this.teamFilters[this.currentTeamIndex].key;
        }
    },
    created() {
        this.eventStore = useEventStore();
        this.loadTeamNumbers();
    }
}
</script>
