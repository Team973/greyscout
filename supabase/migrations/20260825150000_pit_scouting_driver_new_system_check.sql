ALTER TABLE public."PitData" ADD COLUMN pit_driver_new boolean DEFAULT false NOT NULL;
ALTER TABLE public."PitData" ADD COLUMN pit_system_check text DEFAULT 'before_every_match'::text NOT NULL;
