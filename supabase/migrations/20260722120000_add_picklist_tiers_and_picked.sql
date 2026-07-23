ALTER TABLE public."PickList" ADD COLUMN team_tiers jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public."PickList" ADD COLUMN picked_team_numbers integer[] DEFAULT '{}'::integer[] NOT NULL;
