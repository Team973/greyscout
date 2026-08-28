<script setup lang="ts">
// @ts-nocheck

import CollapsibleSection from "@/components/CollapsibleSection.vue";

import { useEventStore } from "@/stores/event-store";
import { queryEventMatchSchedule, queryEventData, queryEventPitData, queryTeamNumbers } from "@/lib/data-query";
import { matchNumberColumn, teamNumberColumn } from "@/lib/constants";
</script>

<template>
    <div class="main-content">
        <div class="page-header">
            <h1>Data Status</h1>
            <button type="button" class="refresh-button" @click="loadData" :disabled="!loaded">
                {{ loaded ? 'Refresh' : 'Loading…' }}
            </button>
        </div>

        <div v-if="loaded">
            <CollapsibleSection title="Pit Scouting">
                <p>{{ pitStats.scoutedTeams }} / {{ pitStats.totalTeams }} teams pit scouted
                    ({{ pitStats.percent }}%).</p>
                <div class="legend">
                    <span class="legend-item"><span class="status-dot status-scouted"></span> Pit scouted</span>
                    <span class="legend-item"><span class="status-dot status-missing"></span> Not yet pit scouted</span>
                </div>

                <p v-if="teams.length === 0">No teams loaded for this event yet.</p>

                <div v-else class="pit-status-grid">
                    <div v-for="team in teams" :key="team.team_number" class="pit-status-cell"
                        :class="pitScoutedTeams[team.team_number] ? 'cell-scouted' : 'cell-missing'">
                        <span class="status-dot"
                            :class="pitScoutedTeams[team.team_number] ? 'status-scouted' : 'status-missing'"></span>
                        {{ team.team_number }}
                        <span class="team-name">- {{ team.name }}</span>
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Match Scouting">
                <p>{{ completionStats.scoutedSlots }} / {{ completionStats.totalSlots }} team-match slots scouted
                    ({{ completionStats.percent }}%) across {{ qualMatches.length }} qualification matches.</p>
                <div class="legend">
                    <span class="legend-item"><span class="status-dot status-scouted"></span> Scouted</span>
                    <span class="legend-item"><span class="status-dot status-noshow"></span> No-show recorded</span>
                    <span class="legend-item"><span class="status-dot status-missing"></span> Not yet scouted</span>
                </div>
                <p class="hint">Only qualification matches are shown — match numbers repeat across playoff levels,
                    so scouting entries can't be matched back to a specific playoff match.</p>

                <p v-if="qualMatches.length === 0">No qualification schedule loaded for this event yet.</p>

                <div v-else class="schedule-table-wrap">
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
            </CollapsibleSection>
        </div>
    </div>
</template>

<script lang="ts">
const SLOT_KEYS = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'];

export default {
    components: { CollapsibleSection },
    data() {
        return {
            eventStore: null,
            loaded: false,
            schedule: [],
            teams: [],
            teamNameByNumber: {},
            // `${match_number}|${team_number}` -> { count, noShow }
            scoutedByKey: {},
            // team_number -> true
            pitScoutedTeams: {},
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
        },
        pitStats() {
            const totalTeams = this.teams.length;
            const scoutedTeams = this.teams.filter(team => this.pitScoutedTeams[team.team_number]).length;
            const percent = totalTeams > 0 ? Math.round((scoutedTeams / totalTeams) * 100) : 0;
            return { totalTeams, scoutedTeams, percent };
        }
    },
    methods: {
        async loadData() {
            this.loaded = false;

            await this.eventStore.updateEvent();
            const eventId = this.eventStore.eventId;

            const [schedule, matchData, pitData, teams] = await Promise.all([
                queryEventMatchSchedule(eventId),
                queryEventData(eventId),
                queryEventPitData(eventId),
                queryTeamNumbers(eventId)
            ]);

            this.schedule = schedule;

            this.teams = [...teams].sort((a, b) => a.team_number - b.team_number);

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

            this.pitScoutedTeams = {};
            pitData.forEach((row) => {
                this.pitScoutedTeams[row.pit_team_number] = true;
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
        this.loadData();
    }
}
</script>

<style scoped>
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.refresh-button {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    background-color: var(--accent-color);
    color: var(--primary-text-color);
    cursor: pointer;
    font: inherit;
}

.refresh-button:hover:not(:disabled) {
    background-color: var(--header-hover-color);
}

.refresh-button:disabled {
    opacity: 0.6;
    cursor: default;
}

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

.schedule-table-wrap {
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

.pit-status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
    width: 100%;
}

.pit-status-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 0.9em;
}

.pit-status-cell.cell-scouted {
    background-color: rgba(58, 184, 58, 0.12);
}

.pit-status-cell.cell-missing {
    background-color: rgba(224, 80, 80, 0.12);
}
</style>
