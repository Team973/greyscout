ALTER TABLE public."PitData" ALTER COLUMN pit_outpost_fuel TYPE boolean USING pit_outpost_fuel::boolean;
ALTER TABLE public."PitData" ALTER COLUMN pit_outpost_fuel SET DEFAULT false;
