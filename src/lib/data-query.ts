// TODO: fix types
// @ts-nocheck


import { supabase } from "@/lib/supabase-client";
import { aggregateEventData, getPitScoutData } from "@/lib/2025/data-processing";
import { teamLikertRadar, getTeamOverview, teamReefData } from "@/lib/2025/data-visualization";
import { uploadFile, updatePhoto } from "@/lib/data-submission";
import { projectId, matchScoutTable, pitScoutTable, teamInfoTable, robotPhotoTable, robotPhotoBucket } from "@/lib/constants";

export async function queryTeamNumbers(eventId) {
    const { data, error } = await supabase.from(teamInfoTable).select().eq('event_id', eventId);

    if (error) {
        console.log(error);
        return [];
    }

    return data;
}

export async function queryTeamMatchData(teamNumber, eventId) {
    const { data, error } = await supabase.from(matchScoutTable).select().eq('event', eventId).eq("prematch_team_number", teamNumber);

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

