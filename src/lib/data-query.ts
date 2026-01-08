// TODO: fix types
// @ts-nocheck


import { supabase } from "@/lib/supabase-client";
import { matchScoutTable, teamInfoTable, teamNumberColumn } from "@/lib/constants";

export async function queryTeamNumbers(eventId) {
    const { data, error } = await supabase.from(teamInfoTable).select().eq('event_id', eventId);

    if (error) {
        console.log(error);
        return [];
    }

    return data;
}

export async function queryTeamMatchData(teamNumber, eventId) {
    const { data, error } = await supabase.from(matchScoutTable).select().eq('event', eventId).eq(teamNumberColumn, teamNumber);

    if (error) {
        console.log(error);
        return [];
    }

    return data;
}

export async function queryEventData(eventId) {
    const { data, error } = await supabase.from(matchScoutTable).select().eq('event', eventId);

    if (error) {
        console.log(error);
        return [];
    }

    return data;
}

