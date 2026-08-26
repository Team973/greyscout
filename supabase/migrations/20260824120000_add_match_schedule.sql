CREATE TABLE public."Match" (key text NOT NULL, event_id text NOT NULL, comp_level text NOT NULL, set_number smallint NOT NULL, match_number smallint NOT NULL, red1 smallint, red2 smallint, red3 smallint, blue1 smallint, blue2 smallint, blue3 smallint);
ALTER TABLE public."Match" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Match" ADD CONSTRAINT "Match_pkey" PRIMARY KEY (key);
ALTER TABLE public."Match" ADD CONSTRAINT "Match_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public."Event"(event_id);
GRANT ALL ON public."Match" TO anon;
GRANT ALL ON public."Match" TO authenticated;
GRANT ALL ON public."Match" TO service_role;
CREATE POLICY "Enable read access for logged in users" ON public."Match" FOR SELECT TO authenticated USING (true);
