// @ts-nocheck
import { supabase } from "@/lib/supabase-client";
import { strategyBoardTable } from "@/lib/constants";

// One StrategyBoard row per (event, match_number) — see
// supabase/migrations/20260828120000_add_strategyboard.sql. Returns
// { id: null, board: [] } when no board has been saved for this match yet,
// so callers can treat "not found" the same as "empty board" without a
// special case.
export async function fetchStrategyBoard(eventId, matchNumber) {
    const { data, error } = await supabase
        .from(strategyBoardTable)
        .select("*")
        .eq("event", eventId)
        .eq("match_number", matchNumber)
        .maybeSingle();

    if (error) {
        console.error(error);
        return { id: null, board: [] };
    }

    if (!data) return { id: null, board: [] };

    return { id: data.id, board: data.board ?? [] };
}
