ALTER TABLE public."MatchData" DROP CONSTRAINT "MatchData_defense_impact_check";
ALTER TABLE public."MatchData" ADD CONSTRAINT "MatchData_defense_impact_check"
    CHECK (postmatch_defense_impact IS NULL OR postmatch_defense_impact = ANY (ARRAY['none'::text, 'good'::text, 'minimal'::text, 'ineffective'::text]));
