<script setup lang="ts">
// @ts-nocheck
import SearchableDropdown from "@/components/SearchableDropdown.vue";
import PitScoutingSection from "@/components/PitScoutingSection.vue";

import { useEventStore } from "@/stores/event-store";
import { queryTeamNumbers } from "@/lib/data-query";
</script>

<template>
    <div class="main-content">
        <div v-if="isDataAvailable">
            <SearchableDropdown :choices="teamFilters" v-model="currentTeamNumber" placeholder="Search team…">
            </SearchableDropdown>

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
            currentTeamNumber: null
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

            if (!this.teamFilters.some(t => t.key === this.currentTeamNumber)) {
                this.currentTeamNumber = this.teamFilters[0]?.key ?? null;
            }

            this.teamsLoaded = true;
        }
    },
    computed: {
        isDataAvailable() {
            return this.teamFilters.length > 0;
        },
        teamNumber() {
            return this.currentTeamNumber ?? -1;
        }
    },
    created() {
        this.eventStore = useEventStore();
        this.loadTeamNumbers();
    }
}
</script>
