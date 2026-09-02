// @ts-nocheck

import { supabase } from '@/lib/supabase-client';
import { preScoutTable, userTable } from '@/lib/constants';

/**
 * Fetch pre-scouting entries for a team, attributed to their author, newest
 * first — mirrors picklist-query.ts's fetchTeamPitData.
 */
export async function fetchTeamPreScoutData(teamNumber: number, eventId: string) {
    const { data, error } = await supabase
        .from(preScoutTable)
        .select(`id, prescout_epa, prescout_archetype, prescout_scoring_tier, prescout_driving_tier, prescout_defense_tier, prescout_comments, created_at, ${userTable}(name)`)
        .eq('event', eventId)
        .eq('prescout_team_number', teamNumber)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('fetchTeamPreScoutData error:', error);
        return [];
    }

    return (data ?? []).map((row) => ({
        id: row.id,
        author: row[userTable]?.name ?? 'Unknown',
        epa: row.prescout_epa,
        archetype: row.prescout_archetype,
        scoringTier: row.prescout_scoring_tier,
        drivingTier: row.prescout_driving_tier,
        defenseTier: row.prescout_defense_tier,
        comments: row.prescout_comments,
        created_at: row.created_at
    }));
}

/**
 * Fetch a single raw PreScoutData row by id (native prescout_* column
 * names), used to pre-fill the pre-scouting form when editing an existing
 * submission — mirrors picklist-query.ts's fetchPitDataById.
 */
export async function fetchPreScoutDataById(id: number) {
    const { data, error } = await supabase
        .from(preScoutTable)
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('fetchPreScoutDataById error:', error);
        return null;
    }

    return data;
}

/**
 * Fetch each team's most-recent pre-scouted EPA for an event, in one query
 * — used by the Stats page. Teams with no EPA on file (or no pre-scouting
 * data at all) are simply absent from the returned map.
 */
export async function fetchLatestEpaByTeam(eventId: string): Promise<Record<number, number>> {
    const { data, error } = await supabase
        .from(preScoutTable)
        .select('prescout_team_number, prescout_epa, created_at')
        .eq('event', eventId)
        .not('prescout_epa', 'is', null);

    if (error) {
        console.error('fetchLatestEpaByTeam error:', error);
        return {};
    }

    const latestByTeam: Record<number, { epa: number; createdAt: string }> = {};
    (data ?? []).forEach((row) => {
        const teamNumber = row.prescout_team_number;
        const existing = latestByTeam[teamNumber];
        if (!existing || row.created_at > existing.createdAt) {
            latestByTeam[teamNumber] = { epa: row.prescout_epa, createdAt: row.created_at };
        }
    });

    const result: Record<number, number> = {};
    Object.entries(latestByTeam).forEach(([teamNumber, entry]) => {
        result[Number(teamNumber)] = entry.epa;
    });
    return result;
}
