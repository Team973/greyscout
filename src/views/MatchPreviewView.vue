<script setup lang="ts">
// TODO: fix types
// @ts-nocheck

import { getAllianceOverview } from "@/lib/2025/alliance-overview";
import { useEventStore } from "@/stores/event-store";
import { useViewModeStore } from '@/stores/view-mode-store';
import { teamInfoTable } from "@/lib/constants";
import { queryEventData } from "@/lib/data-query";
import { aggregateData } from "@/lib/data-transforms";

import '@material/web/select/outlined-select';
import '@material/web/select/select-option';
import Dropdown from "@/components/Dropdown.vue";
import { supabase } from "@/lib/supabase-client";
import { mean } from "simple-statistics";

</script>

<template>
    <div class="main-content">
        <h1>Match Preview</h1>
        <div v-if="teamsLoaded && isDataAvailable">
            <!-- Only show this if the team data is loaded. -->
            <h2>Red Alliance</h2>
            <div class="data-tile red-alliance">
                Red 1: <Dropdown :choices="teamFilters" v-model="teamIndices[0]" @update:modelValue="setTeam(0, $event)">
                </Dropdown>

                Red 2: <Dropdown :choices="teamFilters" v-model="teamIndices[1]" @update:modelValue="setTeam(1, $event)">
                </Dropdown>

                Red 3: <Dropdown :choices="teamFilters" v-model="teamIndices[2]" @update:modelValue="setTeam(2, $event)">
                </Dropdown>
            </div>

            <div class="data-tile red-alliance">
                <div>
                    <div v-for="data, col in allianceHighlights([0, 1, 2])" class="alliance-data-container">
                        <h3>{{ col }}</h3>
                        <div class="alliance-stat-view">
                            <div v-for="team, idx in getTeamNumbers([0, 1, 2])" class="alliance-col-data">
                                <u>{{ team }}</u>
                                {{ data.value[idx].toFixed(2) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <h2>Blue Alliance</h2>
            <div class="data-tile blue-alliance">
                Blue 1: <Dropdown :choices="teamFilters" v-model="teamIndices[3]" @update:modelValue="setTeam(3, $event)">
                </Dropdown>

                Blue 2: <Dropdown :choices="teamFilters" v-model="teamIndices[4]" @update:modelValue="setTeam(4, $event)">
                </Dropdown>

                Blue 3: <Dropdown :choices="teamFilters" v-model="teamIndices[5]" @update:modelValue="setTeam(5, $event)">
                </Dropdown>
            </div>

            <div class="data-tile blue-alliance">
                <div>
                    <div v-for="data, col in allianceHighlights([3, 4, 5])" class="alliance-data-container">
                        <h3>{{ col }}</h3>
                        <div class="alliance-stat-view">
                            <div v-for="team, idx in getTeamNumbers([3, 4, 5])" class="alliance-col-data">
                                <u>{{ team }}</u>
                                {{ data.value[idx].toFixed(2) }}
                            </div>
                        </div>
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
            teamsData: {},
            teamFilters: [],
            teamIndices: [0, 0, 0, 0, 0, 0]
        }
    },
    methods: {
        async loadTeamsData() {
            // Note: do this to avoid stale data on page refresh.
            await this.eventStore.updateEvent();

            const teamNumberColumn = "prematch_team_number";
            let dbData = await queryEventData(this.eventStore.eventId);
            let aggregatedData = aggregateData(dbData, teamNumberColumn, mean);
            this.teamsData = {};
            aggregatedData.forEach(row => {
                const teamNumber = row[teamNumberColumn];
                this.teamsData[teamNumber] = row;
            });

            const { data, error } = await supabase.from(teamInfoTable).select("*").eq("event_id", this.eventStore.eventId);
            let teamTextMap = {};
            if (error) {
                console.log(error);
            } else {
                for (var team of data) {
                    teamTextMap[team.team_number] = String(team.team_number) + " - " + String(team.name);
                }
            }

            this.teamFilters = [];
            Object.keys(teamTextMap).forEach(element => {
                let teamText = String(element);
                if (Object.keys(teamTextMap).includes(element)) {
                    teamText = teamTextMap[element];
                }
                this.teamFilters.push({ key: element, text: teamText });
            })

            // Mark the data as ready for the view to display.
            this.teamsLoaded = true;
        },
        setTeam(idx: int, data: int) {
            this.teamIndices[idx] = data;
        },
        allianceHighlights(teams) {
            // Get team information.
            let teamNumbers = [];

            for (var i = 0; i < teams.length; i++) {
                const teamIndex = this.teamIndices[teams[i]];
                const teamNumber = this.teamFilters[teamIndex].key;
                teamNumbers.push(teamNumber);
            }

            let overview = getAllianceOverview(teamNumbers, this.teamsData);

            return overview;
        },
        getTeamNumbers(teams) {
            let teamNumbers = [];

            for (var i = 0; i < teams.length; i++) {
                const teamIndex = this.teamIndices[teams[i]];
                const teamNumber = this.teamFilters[teamIndex].key;
                teamNumbers.push(teamNumber);
            }

            teamNumbers.push("Total")

            return teamNumbers;
        }
    },
    computed: {
        isDataAvailable() {
            return this.teamFilters.length > 0;
        }
    },
    created() {
        this.viewMode = useViewModeStore();
        this.eventStore = useEventStore();
        this.loadTeamsData();
    }
}
</script>

<style>
.alliance-stat-view {
    display: flex;
    flex-direction: row;
}

.alliance-data-container {
    display: flex;
    flex-direction: column;
}

.alliance-col-data {
    display: flex;
    flex-direction: column;
    padding: 20px;
}

.red-alliance {
    border: 2px solid red;
}

.blue-alliance {
    border: 2px solid blue;
}
</style>
