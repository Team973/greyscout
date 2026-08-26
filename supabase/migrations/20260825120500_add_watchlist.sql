CREATE TABLE IF NOT EXISTS public."Watchlist" (
    "event_id" text NOT NULL REFERENCES public."Event"(event_id),
    "team_number" smallint NOT NULL,
    "created_by" uuid DEFAULT auth.uid() REFERENCES public."User"(user_id),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (event_id, team_number)
);

ALTER TABLE public."Watchlist" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for logged in users" ON public."Watchlist" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public."Watchlist" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users only" ON public."Watchlist" FOR DELETE TO authenticated USING (true);
