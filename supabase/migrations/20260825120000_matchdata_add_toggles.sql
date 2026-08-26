ALTER TABLE public."MatchData" ADD COLUMN postmatch_broke boolean DEFAULT false NOT NULL;
ALTER TABLE public."MatchData" ADD COLUMN postmatch_beached boolean DEFAULT false NOT NULL;
ALTER TABLE public."MatchData" ADD COLUMN postmatch_auto_failed boolean DEFAULT false NOT NULL;
ALTER TABLE public."MatchData" ADD COLUMN postmatch_played_defense boolean DEFAULT false NOT NULL;
ALTER TABLE public."MatchData" ADD COLUMN postmatch_defense_impact text;
ALTER TABLE public."MatchData" ADD CONSTRAINT "MatchData_defense_impact_check"
    CHECK (postmatch_defense_impact IS NULL OR postmatch_defense_impact = ANY (ARRAY['good'::text, 'minimal'::text, 'ineffective'::text]));
