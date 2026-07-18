// @ts-nocheck

import { defineStore } from 'pinia';
import {
    fetchTeamsForPicklist,
    fetchPersonalPicklist,
    fetchTeamPicklist,
    fetchAllPersonalPicklists,
    upsertPersonalPicklist,
    upsertTeamPicklist,
    computeDemocraticRanking,
    fetchTeamMatchStats,
    fetchTeamComments
} from '@/lib/picklist-query';

export type PicklistTab = 'personal' | 'democratic' | 'team';

export interface TeamEntry {
    team_number: number;
    name: string;
    photo_url: string | null;
}

export const usePicklistStore = defineStore('picklist', {
    state() {
        return {
            // Current tab
            activeTab: 'personal' as PicklistTab,

            // Teams loaded for the event
            allTeams: [] as TeamEntry[],
            teamsLoaded: false,

            // Personal list — ordered team numbers
            personalList: [] as number[],
            personalListId: null as string | null,
            personalListLoaded: false,

            // Team (lead) list — ordered team numbers
            teamList: [] as number[],
            teamListLoaded: false,

            // Democratic list — computed from all personal lists
            democraticList: [] as number[],
            democraticListLoaded: false,

            // Per-team expanded data cache
            teamDataCache: {} as Record<number, { stats: unknown[]; comments: unknown[] }>,

            // Save status
            isSaving: false,
            lastSaveError: null as string | null,
            lastSaveSuccess: false
        };
    },
    getters: {
        /**
         * Returns the active list's team entries in ranked order.
         * Falls back to all teams (unranked) when the list is empty.
         */
        activeOrderedTeams(): TeamEntry[] {
            let orderedNums: number[];

            if (this.activeTab === 'personal') {
                orderedNums = this.personalList;
            } else if (this.activeTab === 'democratic') {
                orderedNums = this.democraticList;
            } else {
                orderedNums = this.teamList;
            }

            if (orderedNums.length === 0) {
                return [...this.allTeams];
            }

            const teamMap: Record<number, TeamEntry> = {};
            this.allTeams.forEach((t) => {
                teamMap[t.team_number] = t;
            });

            const ordered: TeamEntry[] = [];
            const added = new Set<number>();

            orderedNums.forEach((num) => {
                const n = Number(num);
                if (teamMap[n] && !added.has(n)) {
                    ordered.push(teamMap[n]);
                    added.add(n);
                }
            });

            // Append any teams not yet in the list
            this.allTeams.forEach((t) => {
                if (!added.has(t.team_number)) ordered.push(t);
            });

            return ordered;
        },

        isActiveListEditable(): boolean {
            // Personal tab: everyone can edit their own
            // Team tab: only leads can edit
            return this.activeTab === 'personal' || this.activeTab === 'team';
        }
    },
    actions: {
        setTab(tab: PicklistTab) {
            this.activeTab = tab;
        },

        async loadAll(eventId: string, userId: string | null, isLead: boolean) {
            await this.loadTeams(eventId);
            await this.loadPersonalList(userId, eventId);
            await this.loadDemocraticList(eventId);
            if (isLead) {
                await this.loadTeamList(eventId);
            }
        },

        async loadTeams(eventId: string) {
            this.teamsLoaded = false;
            this.allTeams = await fetchTeamsForPicklist(eventId);
            this.teamsLoaded = true;
        },

        async loadPersonalList(userId: string | null, eventId: string) {
            this.personalListLoaded = false;
            if (!userId) {
                this.personalList = this.allTeams.map((t) => t.team_number);
                this.personalListLoaded = true;
                return;
            }

            const result = await fetchPersonalPicklist(userId, eventId);
            if (result?.team_numbers?.length) {
                this.personalList = result.team_numbers;
                this.personalListId = result.id;
            } else {
                // Default: use the sorted team list order
                this.personalList = this.allTeams.map((t) => t.team_number);
            }
            this.personalListLoaded = true;
        },

        async loadTeamList(eventId: string) {
            this.teamListLoaded = false;
            const result = await fetchTeamPicklist(eventId);
            if (result?.team_numbers?.length) {
                this.teamList = result.team_numbers;
            } else {
                this.teamList = this.allTeams.map((t) => t.team_number);
            }
            this.teamListLoaded = true;
        },

        async loadDemocraticList(eventId: string) {
            this.democraticListLoaded = false;
            const allLists = await fetchAllPersonalPicklists(eventId);
            this.democraticList = computeDemocraticRanking(allLists);
            this.democraticListLoaded = true;
        },

        setPersonalOrder(orderedNumbers: (number|string)[]) {
            this.personalList = Array.from(new Set(orderedNumbers.map(Number)));
        },

        setTeamOrder(orderedNumbers: (number|string)[]) {
            this.teamList = Array.from(new Set(orderedNumbers.map(Number)));
        },

        async savePersonalList(userId: string, eventId: string) {
            this.isSaving = true;
            this.lastSaveError = null;
            const error = await upsertPersonalPicklist(userId, eventId, this.personalList);
            this.isSaving = false;
            if (error) {
                this.lastSaveError = error.message ?? 'Unknown error';
                return false;
            }
            this.lastSaveSuccess = true;
            setTimeout(() => { this.lastSaveSuccess = false; }, 3000);
            return true;
        },

        async saveTeamList(eventId: string) {
            this.isSaving = true;
            this.lastSaveError = null;
            const error = await upsertTeamPicklist(eventId, this.teamList);
            this.isSaving = false;
            if (error) {
                this.lastSaveError = error.message ?? 'Unknown error';
                return false;
            }
            this.lastSaveSuccess = true;
            setTimeout(() => { this.lastSaveSuccess = false; }, 3000);
            return true;
        },

        async getTeamData(teamNumber: number, eventId: string) {
            if (this.teamDataCache[teamNumber]) {
                return this.teamDataCache[teamNumber];
            }
            const [stats, comments] = await Promise.all([
                fetchTeamMatchStats(teamNumber, eventId),
                fetchTeamComments(teamNumber, eventId)
            ]);
            this.teamDataCache[teamNumber] = { stats, comments };
            return this.teamDataCache[teamNumber];
        }
    }
});
