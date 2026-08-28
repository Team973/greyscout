CREATE TABLE IF NOT EXISTS public."ScoutAssignment" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "event_id" text NOT NULL REFERENCES public."Event"(event_id),
    "match_number" smallint NOT NULL,
    "team_number" smallint NOT NULL,
    "scout_user_id" uuid REFERENCES public."User"(user_id),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("id")
);

-- One assignment per match/team slot per event; assigning a new scout to an
-- already-assigned slot updates the row rather than creating a duplicate.
CREATE UNIQUE INDEX "scoutassignment_slot_unique" ON public."ScoutAssignment" USING btree (event_id, match_number, team_number);

ALTER TABLE public."ScoutAssignment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for logged in users" ON public."ScoutAssignment" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public."ScoutAssignment" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON public."ScoutAssignment" FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON public."ScoutAssignment" FOR DELETE TO authenticated USING (true);
