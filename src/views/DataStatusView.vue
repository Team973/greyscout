<script setup lang="ts">
// @ts-nocheck

import { useEventStore } from "@/stores/event-store";
import { useAuthStore } from "@/stores/auth-store";
import { queryEventMatchSchedule, queryEventData, queryTeamNumbers } from "@/lib/data-query";
import { matchNumberColumn, teamNumberColumn } from "@/lib/constants";
</script>

<template>
    <div class="main-content">
        <h1>Data Status</h1>

        <div v-if="!authStore?.isLead" class="data-tile">
            <p>This page is only available to leads and admins.</p>
        </div>

        <div v-else>
            <div class="data-tile" v-if="loaded">
                <p>{{ completionStats.scoutedSlots }} / {{ completionStats.totalSlots }} team-match slots scouted
                    ({{ completionStats.percent }}%) across {{ qualMatches.length }} qualification matches.</p>
                <div class="legend">
                    <span class="legend-item"><span class="status-dot status-scouted"></span> Scouted</span>
                    <span class="legend-item"><span class="status-dot status-noshow"></span> No-show recorded</span>
                    <span class="legend-item"><span class="status-dot status-missing"></span> Not yet scouted</span>
                </div>
                <p class="hint">Only qualification matches are shown — match numbers repeat across playoff levels,
                    so scouting entries can't be matched back to a specific playoff match.</p>
            </div>

            <div class="data-tile" v-if="loaded && qualMatches.length === 0">
                <p>No qualification schedule loaded for this event yet.</p>
            </div>

            <div class="data-tile schedule-tile" v-if="loaded && qualMatches.length > 0">
                <table>
                    <thead>
                        <tr>
                            <th>Match</th>
                            <th class="red-header">Red 1</th>
                            <th class="red-header">Red 2</th>
                            <th class="red-header">Red 3</th>
                            <th class="blue-header">Blue 1</th>
                            <th class="blue-header">Blue 2</th>
                            <th class="blue-header">Blue 3</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="match in qualMatches" :key="match.key">
                            <td>Q{{ match.match_number }}</td>
                            <td v-for="slotKey in slotKeys" :key="slotKey" :class="cellClass(match, slotKey)">
                                <span v-if="match[slotKey]">
                                    <span class="status-dot" :class="statusDotClass(match.match_number, match[slotKey])"></span>
                                    {{ match[slotKey] }}
                                    <span class="team-name" v-if="teamNameByNumber[match[slotKey]]">
                                        - {{ teamNameByNumber[match[slotKey]] }}
                                    </span>
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
const SLOT_KEYS = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'];

export default {
    data() {
        return {
            eventStore: null,
            authStore: null,
            loaded: false,
            schedule: [],
            teamNameByNumber: {},
            // `${match_number}|${team_number}` -> { count, noShow }
            scoutedByKey: {},
            slotKeys: SLOT_KEYS
        }
    },
    computed: {
        qualMatches() {
            return this.schedule.filter(m => m.comp_level === 'qm');
        },
        completionStats() {
            let totalSlots = 0;
            let scoutedSlots = 0;

            this.qualMatches.forEach(match => {
                SLOT_KEYS.forEach(slotKey => {
                    const teamNumber = match[slotKey];
                    if (!teamNumber) return;
                    totalSlots++;
                    if (this.scoutedByKey[`${match.match_number}|${teamNumber}`]) scoutedSlots++;
                });
            });

            const percent = totalSlots > 0 ? Math.round((scoutedSlots / totalSlots) * 100) : 0;
            return { totalSlots, scoutedSlots, percent };
        }
    },
    methods: {
        async loadData() {
            this.loaded = false;

            await this.eventStore.updateEvent();
            const eventId = this.eventStore.eventId;

            const [schedule, matchData, teams] = await Promise.all([
                queryEventMatchSchedule(eventId),
                queryEventData(eventId),
                queryTeamNumbers(eventId)
            ]);

            this.schedule = schedule;

            this.teamNameByNumber = {};
            teams.forEach((team) => {
                this.teamNameByNumber[team.team_number] = team.name;
            });

            this.scoutedByKey = {};
            matchData.forEach((row) => {
                const key = `${row[matchNumberColumn]}|${row[teamNumberColumn]}`;
                if (!this.scoutedByKey[key]) {
                    this.scoutedByKey[key] = { count: 0, noShow: false };
                }
                this.scoutedByKey[key].count += 1;
                this.scoutedByKey[key].noShow = this.scoutedByKey[key].noShow || !!row.prematch_noshow;
            });

            this.loaded = true;
        },
        statusFor(matchNumber, teamNumber) {
            const entry = this.scoutedByKey[`${matchNumber}|${teamNumber}`];
            if (!entry) return 'missing';
            return entry.noShow ? 'noshow' : 'scouted';
        },
        statusDotClass(matchNumber, teamNumber) {
            return `status-${this.statusFor(matchNumber, teamNumber)}`;
        },
        cellClass(match, slotKey) {
            const teamNumber = match[slotKey];
            const alliance = slotKey.startsWith('red') ? 'red-cell' : 'blue-cell';
            if (!teamNumber) return [alliance];
            return [alliance, `cell-${this.statusFor(match.match_number, teamNumber)}`];
        }
    },
    created() {
        this.eventStore = useEventStore();
        this.authStore = useAuthStore();
        this.authStore.checkUser().then(() => {
            if (this.authStore.isLead) this.loadData();
        });
    }
}
</script>

<style scoped>
.legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin: 8px 0;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.hint {
    font-size: 0.85em;
    opacity: 0.75;
}

.status-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}

.status-scouted {
    background-color: #3ab83a;
}

.status-noshow {
    background-color: #e0a020;
}

.status-missing {
    background-color: #e05050;
}

.schedule-tile {
    overflow-x: auto;
    max-width: 100%;
}

.team-name {
    opacity: 0.75;
}

.red-header {
    background-color: rgba(224, 0, 0, 0.15);
}

.blue-header {
    background-color: rgba(0, 0, 224, 0.15);
}
</style>
