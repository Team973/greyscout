// @ts-nocheck

import { defineStore } from 'pinia';
import {
    fetchTeamsForPicklist,
    fetchPersonalPicklist,
    fetchTeamPicklist,
    fetchAllPersonalPicklists,
    fetchPickedTeams,
    upsertPersonalPicklist,
    upsertTeamPicklist,
    updatePickedTeams,
    computeTeamTierStats,
    computeDemocraticTierGroups,
    parseTeamTiers,
    fetchTeamMatchStats,
    fetchTeamComments,
    TIERS,
    TIER_GROUPS
} from '@/lib/picklist-query';
import type { Tier, TierGroup, TeamTierStats } from '@/lib/picklist-query';

export type PicklistTab = 'personal' | 'democratic' | 'team';

export interface TeamEntry {
    team_number: number;
    name: string;
    photo_url: string | null;
}

function emptyTierSections(): Record<TierGroup, number[]> {
    const groups = {} as Record<TierGroup, number[]>;
    TIER_GROUPS.forEach((g) => { groups[g] = []; });
    return groups;
}

/**
 * Bucket a saved (order, tier) pair into tier-grouped sections, in saved
 * order within each tier. Any team present in allTeams but missing from
 * teamNumbers (e.g. added to the event after this list was last saved)
 * is appended to "Unranked".
 */
function buildTierSections(
    teamNumbers: number[],
    tiersMap: Record<number, Tier>,
    allTeams: TeamEntry[]
): Record<TierGroup, number[]> {
    const groups = emptyTierSections();
    const seen = new Set<number>();
    const orderSource = teamNumbers.length ? teamNumbers : allTeams.map((t) => t.team_number);

    const place = (num: number) => {
        if (seen.has(num)) return;
        seen.add(num);
        const tier = tiersMap[num];
        groups[tier ?? 'Unranked'].push(num);
    };

    orderSource.forEach((num) => place(Number(num)));
    allTeams.forEach((t) => place(t.team_number));

    return groups;
}

export const usePicklistStore = defineStore('picklist', {
    state() {
        return {
            // Current tab
            activeTab: 'personal' as PicklistTab,

            // Teams loaded for the event
            allTeams: [] as TeamEntry[],
            teamsLoaded: false,

            // Personal list — tier-grouped team numbers, source of truth for order + tier
            personalTierSections: emptyTierSections(),
            personalListLoaded: false,

            // Team (lead) list — tier-grouped team numbers
            teamTierSections: emptyTierSections(),
            teamListLoaded: false,

            // Democratic list — computed (read-only) tier grouping from all personal lists
            democraticTierSections: emptyTierSections(),
            democraticListLoaded: false,

            // Per-team aggregate tier stats across all personal lists
            teamTierStats: {} as Record<number, TeamTierStats>,

            // Event-wide "has this team already been picked" set, visible to everyone,
            // editable by leads only. Lives on the shared team-type PickList row.
            pickedTeams: [] as number[],
            pickedTeamsLoaded: false,

            // Per-team expanded data cache
            teamDataCache: {} as Record<number, { stats: unknown[]; comments: unknown[] }>,

            // Save status
            isSaving: false,
            lastSaveError: null as string | null,
            lastSaveSuccess: false
        };
    },
    getters: {
        teamMap(): Record<number, TeamEntry> {
            const map: Record<number, TeamEntry> = {};
            this.allTeams.forEach((t) => { map[t.team_number] = t; });
            return map;
        },

        /** The tier-grouped sections for whichever tab is currently active. */
        activeSections(): Record<TierGroup, number[]> {
            if (this.activeTab === 'personal') return this.personalTierSections;
            if (this.activeTab === 'team') return this.teamTierSections;
            return this.democraticTierSections;
        },

        personalFlatOrder(): number[] {
            return TIER_GROUPS.flatMap((g) => this.personalTierSections[g] ?? []);
        },

        personalTiersMap(): Record<number, Tier> {
            const map: Record<number, Tier> = {};
            TIERS.forEach((tier) => {
                (this.personalTierSections[tier] ?? []).forEach((num) => { map[num] = tier; });
            });
            return map;
        },

        teamFlatOrder(): number[] {
            return TIER_GROUPS.flatMap((g) => this.teamTierSections[g] ?? []);
        },

        teamTiersMap(): Record<number, Tier> {
            const map: Record<number, Tier> = {};
            TIERS.forEach((tier) => {
                (this.teamTierSections[tier] ?? []).forEach((num) => { map[num] = tier; });
            });
            return map;
        },

        isTeamPicked(): (teamNumber: number) => boolean {
            return (teamNumber: number) => this.pickedTeams.includes(teamNumber);
        }
    },
    actions: {
        setTab(tab: PicklistTab) {
            this.activeTab = tab;
        },

        async loadAll(eventId: string, userId: string | null, isLead: boolean) {
            await this.loadTeams(eventId);
            await this.loadPersonalList(userId, eventId);
            await this.loadPickedTeams(eventId);
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
                this.personalTierSections = buildTierSections([], {}, this.allTeams);
                this.personalListLoaded = true;
                return;
            }

            const result = await fetchPersonalPicklist(userId, eventId);
            this.personalTierSections = buildTierSections(
                result?.team_numbers ?? [],
                parseTeamTiers(result?.team_tiers),
                this.allTeams
            );
            this.personalListLoaded = true;
        },

        async loadTeamList(eventId: string) {
            this.teamListLoaded = false;
            const result = await fetchTeamPicklist(eventId);
            this.teamTierSections = buildTierSections(
                result?.team_numbers ?? [],
                parseTeamTiers(result?.team_tiers),
                this.allTeams
            );
            this.teamListLoaded = true;
        },

        async loadDemocraticList(eventId: string) {
            this.democraticListLoaded = false;
            const allLists = await fetchAllPersonalPicklists(eventId);
            this.teamTierStats = computeTeamTierStats(allLists);
            this.democraticTierSections = computeDemocraticTierGroups(
                this.allTeams.map((t) => t.team_number),
                this.teamTierStats
            );
            this.democraticListLoaded = true;
        },

        async loadPickedTeams(eventId: string) {
            this.pickedTeamsLoaded = false;
            this.pickedTeams = await fetchPickedTeams(eventId);
            this.pickedTeamsLoaded = true;
        },

        /**
         * Reset the team list's tiers/order to the current democratic
         * grouping, overwriting whatever is currently staged for the team list.
         */
        resetTeamListFromDemocratic() {
            const cloned = emptyTierSections();
            TIER_GROUPS.forEach((g) => { cloned[g] = [...(this.democraticTierSections[g] ?? [])]; });
            this.teamTierSections = cloned;
        },

        async savePersonalList(userId: string, eventId: string) {
            this.isSaving = true;
            this.lastSaveError = null;
            const error = await upsertPersonalPicklist(
                userId, eventId, this.personalFlatOrder, this.personalTiersMap
            );
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
            const error = await upsertTeamPicklist(eventId, this.teamFlatOrder, this.teamTiersMap);
            this.isSaving = false;
            if (error) {
                this.lastSaveError = error.message ?? 'Unknown error';
                return false;
            }
            this.lastSaveSuccess = true;
            setTimeout(() => { this.lastSaveSuccess = false; }, 3000);
            return true;
        },

        /**
         * Toggle the event-wide picked status for a team. Optimistically
         * updates local state, reverting if the save fails.
         */
        async togglePicked(eventId: string, teamNumber: number) {
            const previous = this.pickedTeams;
            const wasPicked = previous.includes(teamNumber);
            const next = wasPicked
                ? previous.filter((n) => n !== teamNumber)
                : [...previous, teamNumber];

            this.pickedTeams = next;
            const error = await updatePickedTeams(eventId, next);
            if (error) {
                this.pickedTeams = previous;
                this.lastSaveError = error.message ?? 'Unknown error';
                return false;
            }
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
