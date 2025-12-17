// TODO: fix types
// @ts-nocheck

import { supabase } from '@/lib/supabase-client';
import { computeEventStatistics, computeTeamStatistics } from '@/lib/compute-statistics';



export async function aggregateEventData(eventTable: String, eventId: String): Promise<{}> {
    // Pull the relevant data from supabase.
    const { data, error } = await supabase.from(eventTable).select().eq('event', eventId);

    // If there is an error, report it and do not load the data.
    if (error) {
        console.log(error);
        return [];
    }

    // Keep track of key team statistics in a dictionary.
    let eventData = {};

    // Parse all the match data into team specific data.
    eventData = parseMatchData(data, eventData);

    // Compute team statistics such as mean and standard deviation.
    eventData = computeTeamStatistics2025(eventData);

    // Compute event-wide statistics such as rankings and overall distributions.
    eventData = computeEventStatistics2025(eventData);

    return eventData;
}

function parseMatchData(rawData, eventData) {
    // Aggregate the data.
    for (let i = 0; i < rawData.length; i++) {
        const teamNumber = String(rawData[i]["prematch.team_number"]);

        // If the team doesn't exist yet, create it.
        const isExistingTeam = Object.keys(eventData).includes(teamNumber);
        if (!isExistingTeam) {
            // Initialize team data.
            eventData[teamNumber] = {
                // Set the team number so a table can be constructed directly from the data.
                teamNumber: teamNumber,
                numMatches: 0,
                totalAutoLeaveCount: 0,
                totalClimbCount: 0,

                matchData: {
                    matchNumber: [],
                    autoCoralCount: [],
                    autoLeaveCount: [],
                    teleopCoralCount: [],
                    teleopNetCount: [],
                    teleopProcessorCount: [],
                    climbCount: [],
                    defenseScore: [],
                    diedStatus: [],
                    totalCoral: []
                }
            }
        }

        // Match data processing.
        const matchNumber = String(rawData[i]["prematch.match_number"]);
        const autoCoralCount = Number(rawData[i]["auto.coral"]);
        const autoLeaveCount = Number(rawData[i]["auto.leave"]);
        const teleopCoralCount = Number(rawData[i]["teleop.coral"]);
        const teleopNetCount = Number(rawData[i]["teleop.net"]);
        const teleopProcessorCount = Number(rawData[i]["teleop.processor"]);
        const climbCount = Number(rawData[i]["endgame.climb"]);
        const defenseScore = Number(rawData[i]["postmatch.defense"]);
        const diedStatus = Number(rawData[i]["postmatch.died"]);

        // Match totals.
        const totalCoral = autoCoralCount + teleopCoralCount;

        // Update totals.
        eventData[teamNumber].numMatches++;
        eventData[teamNumber].totalAutoLeaveCount += autoLeaveCount;
        eventData[teamNumber].totalClimbCount += climbCount;


        // Aggregate all match data.
        const matchData = {
            matchNumber: matchNumber,
            autoCoralCount: autoCoralCount,
            autoLeaveCount: autoLeaveCount,
            teleopCoralCount: teleopCoralCount,
            teleopNetCount: teleopNetCount,
            teleopProcessorCount: teleopProcessorCount,
            climbCount: climbCount,
            defenseScore: defenseScore,
            diedStatus: diedStatus,
            totalCoral: totalCoral
        }

        // Load the match stats into the matches array for this team.
        Object.keys(matchData).forEach((k, idx) => {
            eventData[teamNumber].matchData[k].push(matchData[k]);
        });
    }

    return eventData;
}



function computeTeamStatistics2025(eventData) {
    const excludeKeysFromStats = [
        "matchNumber"
    ];

    const negativeValuesNA = [
        "defenseScore"
    ];


    return computeTeamStatistics(eventData, excludeKeysFromStats, negativeValuesNA);
}

function computeEventStatistics2025(eventData) {
    const excludeKeysFromStats = [
        "matchNumber",
        "teamNumber",
        "matchData"
    ];

    return computeEventStatistics(eventData, excludeKeysFromStats);
}


export async function getPitScoutData(pitScoutTable: String, eventId: String) {
    // Pull the relevant data from supabase.
    const { data, error } = await supabase.from(pitScoutTable).select().eq('event', eventId);

    // If there is an error, report it and do not load the data.
    if (error) {
        console.log(error);
        return [];
    }

    let pitScoutData = {};

    for (let i = 0; i < data.length; i++) {
        const teamNumber = String(data[i]['pit.team_number'])

        pitScoutData[teamNumber] = {
            scout: String(data[i]['pit.scout_name']),
            drivetrain: String(data[i]['pit.drivetrain']),
            coralIntake: String(data[i]['pit.coral_intake']),
            algaeIntake: String(data[i]['pit.algae_intake']),
            climb: String(data[i]['pit.climb'])
        }
    }

    return pitScoutData;
}