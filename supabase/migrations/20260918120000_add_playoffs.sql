-- Playoffs alliance tracker (issue #64): one row per event holding the 8
-- alliances (arrays of up to 4 team numbers, index 0 = alliance 1) and the
-- winner of each bracket match ({"<match number>": <winning alliance number>}).
CREATE TABLE IF NOT EXISTS public."Playoffs" (
    "event_id" text NOT NULL REFERENCES public."Event"(event_id),
    "alliances" jsonb DEFAULT '[[],[],[],[],[],[],[],[]]'::jsonb NOT NULL,
    "match_winners" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "updated_by" uuid DEFAULT auth.uid() REFERENCES public."User"(user_id),
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY ("event_id")
);

ALTER TABLE public."Playoffs" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public."Playoffs" TO anon;
GRANT ALL ON public."Playoffs" TO authenticated;
GRANT ALL ON public."Playoffs" TO service_role;

-- Everyone logged in can view the bracket; only leads/admins can change it.
CREATE POLICY "Enable read access for logged in users" ON public."Playoffs" FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for leads and admins" ON public."Playoffs" FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public."User" u WHERE u.user_id = auth.uid() AND u.role IN ('lead', 'admin')));
CREATE POLICY "Enable update for leads and admins" ON public."Playoffs" FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public."User" u WHERE u.user_id = auth.uid() AND u.role IN ('lead', 'admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM public."User" u WHERE u.user_id = auth.uid() AND u.role IN ('lead', 'admin')));
