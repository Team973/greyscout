// @ts-nocheck

import { supabase } from '@/lib/supabase-client';
import {
    teamInfoTable,
    robotPhotoTable,
    matchScoutTable,
    pitScoutTable,
    pickListTable,
    pickListTypePersonal,
    pickListTypeTeam,
    userTable
} from '@/lib/constants';

/**
 * Fetch all teams attending an event, combined with their robot photo URL.
 * Returns an array of { team_number, name, photo_url | null }.
 */
export async function fetchTeamsForPicklist(eventId: string) {
    const { data: teams, error: teamsError } = await supabase
        .from(teamInfoTable)
        .select('team_number, name')
        .eq('event_id', eventId)
        .order('team_number', { ascending: true });

    if (teamsError || !teams) {
        console.error('fetchTeamsForPicklist teams error:', teamsError);
        return [];
    }

    // Fetch all robot photos for this event's teams in one shot.
    const teamNumbers = teams.map((t) => t.team_number);
    const { data: photos } = await supabase
        .from(robotPhotoTable)
        .select('team_number, photo_url')
        .in('team_number', teamNumbers);

    const photoMap: Record<number, string> = {};
    (photos ?? []).forEach((p) => {
        photoMap[p.team_number] = p.photo_url;
    });

    return teams.map((t) => ({
        team_number: t.team_number,
        name: t.name,
        photo_url: photoMap[t.team_number] ?? null
    }));
}

/**
 * Fetch match-scouting stats for a single team at an event.
 * Returns raw match rows — callers can aggregate as needed.
 */
export async function fetchTeamMatchStats(teamNumber: number, eventId: string) {
    const { data, error } = await supabase
        .from(matchScoutTable)
        .select('*')
        .eq('event', eventId)
        .eq('prematch_team_number', teamNumber);

    if (error) {
        console.error('fetchTeamMatchStats error:', error);
        return [];
    }
    return data ?? [];
}

/**
 * Fetch pit-scouting answers (drivetrain, weight, language, vibe check) for a team,
 * attributed to their author. Returns array of
 * { author, drivetrain, weight, language, vibe_check, comments, created_at }, newest first.
 */
export async function fetchTeamPitData(teamNumber: number, eventId: string) {
    const { data, error } = await supabase
        .from(pitScoutTable)
        .select(`pit_drivetrain, pit_weight, pit_language, pit_vibe_check, pit_comments, created_at, ${userTable}(name)`)
        .eq('event', eventId)
        .eq('pit_team_number', teamNumber)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('fetchTeamPitData error:', error);
        return [];
    }

    return (data ?? []).map((row) => ({
        author: row[userTable]?.name ?? 'Unknown',
        drivetrain: row.pit_drivetrain,
        weight: row.pit_weight,
        language: row.pit_language,
        vibe_check: row.pit_vibe_check,
        comments: row.pit_comments,
        created_at: row.created_at
    }));
}

/**
 * Fetch match- and pit-scouting comments for a team, attributed to their author.
 * Returns array of { source, author, comment, match_number, created_at }, newest first.
 */
export async function fetchTeamComments(teamNumber: number, eventId: string) {
    // Match scout comments — scout identity is resolved via the submitting user's
    // account (scouted_by -> User.user_id) rather than a free-text name field.
    const { data: matchData } = await supabase
        .from(matchScoutTable)
        .select(`prematch_match_number, postmatch_comments, created_at, ${userTable}(name)`)
        .eq('event', eventId)
        .eq('prematch_team_number', teamNumber)
        .not('postmatch_comments', 'is', null)
        .not('postmatch_comments', 'eq', '');

    // Pit scout comments — same account-based attribution as match comments.
    const { data: pitData } = await supabase
        .from(pitScoutTable)
        .select(`pit_comments, created_at, ${userTable}(name)`)
        .eq('event', eventId)
        .eq('pit_team_number', teamNumber)
        .not('pit_comments', 'is', null)
        .not('pit_comments', 'eq', '');

    const matchComments = (matchData ?? []).map((row) => ({
        source: 'Match',
        author: row[userTable]?.name ?? 'Unknown',
        comment: row.postmatch_comments,
        match_number: row.prematch_match_number ?? null,
        created_at: row.created_at
    }));

    const pitComments = (pitData ?? []).map((row) => ({
        source: 'Pit',
        author: row[userTable]?.name ?? 'Unknown',
        comment: row.pit_comments,
        match_number: null,
        created_at: row.created_at
    }));

    return [...matchComments, ...pitComments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

/**
 * The tiers a team can be sorted into, best to worst. "DNP" = Do Not Pick.
 */
export const TIERS = ['S', 'A', 'B', 'C', 'D', 'DNP'] as const;
export type Tier = typeof TIERS[number];

/** Display groups for the tier-grouped picklist, including the untriaged bucket. */
export type TierGroup = 'Unranked' | Tier;
// "Unranked" (the untriaged pool) renders last, below the real tiers.
export const TIER_GROUPS: TierGroup[] = [...TIERS, 'Unranked'];

const TIER_INDEX: Record<Tier, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, DNP: 5 };

function isTier(value: unknown): value is Tier {
    return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}

/**
 * Normalize a raw team_tiers jsonb value (string keys) into a
 * Record<team_number, Tier>, dropping any invalid entries.
 */
export function parseTeamTiers(raw: Record<string, unknown> | null | undefined): Record<number, Tier> {
    const tiers: Record<number, Tier> = {};
    Object.entries(raw ?? {}).forEach(([teamNumStr, tier]) => {
        if (isTier(tier)) tiers[Number(teamNumStr)] = tier;
    });
    return tiers;
}

/**
 * Fetch the current user's personal picklist for an event.
 * Returns the ordered array of team_numbers plus tier assignments, or null if none exists.
 */
export async function fetchPersonalPicklist(userId: string, eventId: string) {
    const { data, error } = await supabase
        .from(pickListTable)
        .select('id, team_numbers, team_tiers, updated_at')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .eq('type', pickListTypePersonal)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('fetchPersonalPicklist error:', error);
        return null;
    }
    return data;
}

/**
 * Fetch ALL personal picklists for an event (for the democratic view).
 * Returns array of { user_id, team_numbers, team_tiers }.
 */
export async function fetchAllPersonalPicklists(eventId: string) {
    const { data, error } = await supabase
        .from(pickListTable)
        .select('user_id, team_numbers, team_tiers')
        .eq('event_id', eventId)
        .eq('type', pickListTypePersonal);

    if (error) {
        console.error('fetchAllPersonalPicklists error:', error);
        return [];
    }
    return data ?? [];
}

/**
 * Fetch the team (shared lead) picklist for an event, including the
 * event-wide set of teams that have already been picked (real-world
 * alliance selection), which is only ever stored on this shared row.
 */
export async function fetchTeamPicklist(eventId: string) {
    const { data, error } = await supabase
        .from(pickListTable)
        .select('id, team_numbers, team_tiers, picked_team_numbers, updated_at')
        .eq('event_id', eventId)
        .eq('type', pickListTypeTeam)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('fetchTeamPicklist error:', error);
        return null;
    }
    return data;
}

/**
 * Fetch just the event-wide picked-team set. Visible to every user
 * regardless of role, unlike the rest of the team list which is lead-only.
 */
export async function fetchPickedTeams(eventId: string): Promise<number[]> {
    const { data, error } = await supabase
        .from(pickListTable)
        .select('picked_team_numbers')
        .eq('event_id', eventId)
        .eq('type', pickListTypeTeam)
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('fetchPickedTeams error:', error);
        return [];
    }
    return data?.picked_team_numbers ?? [];
}

/**
 * Upsert a personal picklist to Supabase.
 * Returns the error object or null on success.
 */
export async function upsertPersonalPicklist(
    userId: string,
    eventId: string,
    teamNumbers: number[],
    teamTiers: Record<number, Tier>
) {
    const { data, error: fetchError } = await supabase
        .from(pickListTable)
        .select('id')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .eq('type', pickListTypePersonal)
        .maybeSingle();

    if (fetchError) return fetchError;

    if (data) {
        const { error } = await supabase
            .from(pickListTable)
            .update({
                team_numbers: teamNumbers,
                team_tiers: teamTiers,
                updated_at: new Date().toISOString()
            })
            .eq('id', data.id);
        return error;
    } else {
        const { error } = await supabase
            .from(pickListTable)
            .insert({
                user_id: userId,
                event_id: eventId,
                type: pickListTypePersonal,
                team_numbers: teamNumbers,
                team_tiers: teamTiers,
                updated_at: new Date().toISOString()
            });
        return error;
    }
}

/**
 * Upsert the shared team picklist to Supabase. Leaves picked_team_numbers
 * untouched — that's updated separately via updatePickedTeams.
 * Returns the error object or null on success.
 */
export async function upsertTeamPicklist(
    eventId: string,
    teamNumbers: number[],
    teamTiers: Record<number, Tier>
) {
    const { data, error: fetchError } = await supabase
        .from(pickListTable)
        .select('id')
        .eq('event_id', eventId)
        .eq('type', pickListTypeTeam)
        .maybeSingle();

    if (fetchError) return fetchError;

    if (data) {
        const { error } = await supabase
            .from(pickListTable)
            .update({
                team_numbers: teamNumbers,
                team_tiers: teamTiers,
                updated_at: new Date().toISOString()
            })
            .eq('id', data.id);
        return error;
    } else {
        const { error } = await supabase
            .from(pickListTable)
            .insert({
                event_id: eventId,
                type: pickListTypeTeam,
                team_numbers: teamNumbers,
                team_tiers: teamTiers,
                updated_at: new Date().toISOString()
            });
        return error;
    }
}

/**
 * Update the event-wide picked-team set on the shared team row. This is
 * intentionally separate from upsertTeamPicklist so toggling a checkbox
 * never clobbers a concurrently-edited tier/order draft, and vice versa.
 * Returns the error object or null on success.
 */
export async function updatePickedTeams(eventId: string, pickedTeamNumbers: number[]) {
    const { data, error: fetchError } = await supabase
        .from(pickListTable)
        .select('id')
        .eq('event_id', eventId)
        .eq('type', pickListTypeTeam)
        .maybeSingle();

    if (fetchError) return fetchError;

    if (data) {
        const { error } = await supabase
            .from(pickListTable)
            .update({
                picked_team_numbers: pickedTeamNumbers,
                updated_at: new Date().toISOString()
            })
            .eq('id', data.id);
        return error;
    } else {
        const { error } = await supabase
            .from(pickListTable)
            .insert({
                event_id: eventId,
                type: pickListTypeTeam,
                picked_team_numbers: pickedTeamNumbers,
                updated_at: new Date().toISOString()
            });
        return error;
    }
}

export interface TeamTierStats {
    tier: Tier; // aggregate (average) tier across scouts who classified this team
    votes: number;
    avgIndex: number; // average of each vote's tier index (0=S..5=DNP) — used to bucket the aggregate tier
    avgRank: number; // average 1-indexed overall rank across voters' full tiered orderings
    tierCounts: Record<Tier, number>;
}

/**
 * Compute per-team aggregate tier statistics from all personal picklists.
 * A scout who left a team unranked contributes no data point for it — same
 * "no vote" convention the old rank stats used, so being untriaged in one
 * scout's list never drags a team's aggregate down.
 *
 * Each list's team_numbers is the tier-grouped flat order (real tiers
 * first, in S..DNP order, "Unranked" trailing), so a tiered team's index
 * in that array is already its 1-indexed overall rank among that scout's
 * *tiered* teams — untriaged teams always sort after it and can't shift it.
 */
export function computeTeamTierStats(
    allLists: { user_id: string; team_numbers: number[]; team_tiers: Record<string, unknown> }[]
): Record<number, TeamTierStats> {
    const tiersByTeam: Record<number, Tier[]> = {};
    const ranksByTeam: Record<number, number[]> = {};

    allLists.forEach(({ team_numbers, team_tiers }) => {
        const tiersMap = parseTeamTiers(team_tiers);
        (team_numbers ?? []).forEach((teamNumRaw, idx) => {
            const teamNum = Number(teamNumRaw);
            const tier = tiersMap[teamNum];
            if (!tier) return; // left unranked by this scout — no data point
            (tiersByTeam[teamNum] ??= []).push(tier);
            (ranksByTeam[teamNum] ??= []).push(idx + 1);
        });
    });

    const stats: Record<number, TeamTierStats> = {};

    Object.entries(tiersByTeam).forEach(([teamNumStr, tiers]) => {
        const teamNum = Number(teamNumStr);
        const tierCounts = { S: 0, A: 0, B: 0, C: 0, D: 0, DNP: 0 };
        let sum = 0;
        tiers.forEach((t) => {
            tierCounts[t]++;
            sum += TIER_INDEX[t];
        });
        const avgIndex = sum / tiers.length;
        const bucket = Math.min(TIERS.length - 1, Math.max(0, Math.round(avgIndex)));
        const ranks = ranksByTeam[teamNum];
        const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;

        stats[teamNum] = { tier: TIERS[bucket], votes: tiers.length, avgIndex, avgRank, tierCounts };
    });

    return stats;
}

/**
 * Group every team into a TierGroup based on computeTeamTierStats output.
 * Teams with no votes land in "Unranked". Within a real tier, teams are
 * ordered best-to-worst by average overall placement (avgRank), then by
 * vote count.
 */
export function computeDemocraticTierGroups(
    allTeamNumbers: number[],
    stats: Record<number, TeamTierStats>
): Record<TierGroup, number[]> {
    const groups: Record<TierGroup, number[]> = {
        Unranked: [], S: [], A: [], B: [], C: [], D: [], DNP: []
    };

    allTeamNumbers.forEach((teamNum) => {
        const s = stats[teamNum];
        groups[s ? s.tier : 'Unranked'].push(teamNum);
    });

    TIERS.forEach((tier) => {
        groups[tier].sort((a, b) => {
            const sa = stats[a];
            const sb = stats[b];
            if (sa.avgRank !== sb.avgRank) return sa.avgRank - sb.avgRank;
            if (sa.votes !== sb.votes) return sb.votes - sa.votes;
            return a - b;
        });
    });

    return groups;
}
