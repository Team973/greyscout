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
    defaultTeamNumber
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
 * Fetch pit-scouting comments for a team attributed to their author.
 * Returns array of { comment, user_id, display_name, created_at }.
 */
export async function fetchTeamComments(teamNumber: number, eventId: string) {
    // Match scout comments
    const { data: matchData } = await supabase
        .from(matchScoutTable)
        .select('prematch_scout_name, postmatch_comments, created_at')
        .eq('event', eventId)
        .eq('prematch_team_number', teamNumber)
        .not('postmatch_comments', 'is', null)
        .not('postmatch_comments', 'eq', '');

    // Pit scout comments
    const { data: pitData } = await supabase
        .from(pitScoutTable)
        .select('scout_name, comments, created_at')
        .eq('event_id', eventId)
        .eq('team_number', teamNumber)
        .not('comments', 'is', null)
        .not('comments', 'eq', '');

    const matchComments = (matchData ?? []).map((row) => ({
        source: 'Match',
        author: row.prematch_scout_name ?? 'Unknown',
        comment: row.postmatch_comments,
        created_at: row.created_at
    }));

    const pitComments = (pitData ?? []).map((row) => ({
        source: 'Pit',
        author: row.scout_name ?? 'Unknown',
        comment: row.comments,
        created_at: row.created_at
    }));

    return [...matchComments, ...pitComments].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

/**
 * Fetch the current user's personal picklist for an event.
 * Returns the ordered array of team_numbers, or null if none exists.
 */
export async function fetchPersonalPicklist(userId: string, eventId: string) {
    const { data, error } = await supabase
        .from(pickListTable)
        .select('id, team_numbers, updated_at')
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
 * Returns array of { user_id, team_numbers }.
 */
export async function fetchAllPersonalPicklists(eventId: string) {
    const { data, error } = await supabase
        .from(pickListTable)
        .select('user_id, team_numbers')
        .eq('event_id', eventId)
        .eq('type', pickListTypePersonal);

    if (error) {
        console.error('fetchAllPersonalPicklists error:', error);
        return [];
    }
    return data ?? [];
}

/**
 * Fetch the team (shared lead) picklist for an event.
 */
export async function fetchTeamPicklist(eventId: string) {
    const { data, error } = await supabase
        .from(pickListTable)
        .select('id, team_numbers, updated_at')
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
 * Upsert a personal picklist to Supabase.
 * Returns the error object or null on success.
 */
export async function upsertPersonalPicklist(
    userId: string,
    eventId: string,
    teamNumbers: number[]
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
                updated_at: new Date().toISOString()
            });
        return error;
    }
}

/**
 * Upsert the shared team picklist to Supabase.
 * Returns the error object or null on success.
 */
export async function upsertTeamPicklist(eventId: string, teamNumbers: number[]) {
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
                updated_at: new Date().toISOString()
            })
            .eq('id', data.id);
        return error;
    } else {
        const { error } = await supabase
            .from(pickListTable)
            .insert({
                user_id: defaultTeamNumber + "_" + eventId + "_picklist",
                event_id: eventId,
                type: pickListTypeTeam,
                team_numbers: teamNumbers,
                updated_at: new Date().toISOString()
            });
        return error;
    }
}

/**
 * Compute a democratic ranking from all personal picklists.
 * Each team's score = sum of (total_teams - rank) across all lists.
 * Higher score = higher aggregate ranking.
 */
export function computeDemocraticRanking(
    allLists: { user_id: string; team_numbers: number[] }[]
): number[] {
    const scores: Record<number, number> = {};

    allLists.forEach(({ team_numbers }) => {
        const total = team_numbers.length;
        team_numbers.forEach((teamNum, idx) => {
            const score = total - idx; // higher rank = higher score
            scores[teamNum] = (scores[teamNum] ?? 0) + score;
        });
    });

    return Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .map(([teamNum]) => Number(teamNum));
}

export interface TeamRankStats {
    count: number;
    highest: number; // best (lowest-numbered) 1-indexed rank a scout gave this team
    lowest: number;  // worst (highest-numbered) 1-indexed rank a scout gave this team
    mean: number;
    median: number;
}

/**
 * Compute per-team rank statistics (highest/lowest/mean/median 1-indexed
 * position) from all personal picklists. Teams a scout didn't include in
 * their list contribute no data point for that scout.
 */
export function computeTeamRankStats(
    allLists: { user_id: string; team_numbers: number[] }[]
): Record<number, TeamRankStats> {
    const ranksByTeam: Record<number, number[]> = {};

    allLists.forEach(({ team_numbers }) => {
        team_numbers.forEach((teamNum, idx) => {
            const rank = idx + 1;
            (ranksByTeam[teamNum] ??= []).push(rank);
        });
    });

    const stats: Record<number, TeamRankStats> = {};

    Object.entries(ranksByTeam).forEach(([teamNumStr, ranks]) => {
        const teamNum = Number(teamNumStr);
        const sorted = [...ranks].sort((a, b) => a - b);
        const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];

        stats[teamNum] = {
            count: sorted.length,
            highest: sorted[0],
            lowest: sorted[sorted.length - 1],
            mean,
            median
        };
    });

    return stats;
}
