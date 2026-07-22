ALTER TABLE public."MatchData" DROP COLUMN prematch_scout_name;
ALTER TABLE public."MatchDataUploaded" DROP COLUMN prematch_scout_name;
DROP POLICY "Enable insert for authenticated users only" ON public."MatchDataUploaded";
ALTER TABLE public."MatchData" ADD COLUMN scouted_by uuid DEFAULT auth.uid() NOT NULL;
ALTER TABLE public."MatchData" ADD CONSTRAINT "MatchData_scouted_by_fkey" FOREIGN KEY (scouted_by) REFERENCES public."User"(user_id);
ALTER TABLE public."MatchDataUploaded" ADD COLUMN scouted_by uuid DEFAULT auth.uid() NOT NULL;
ALTER TABLE public."MatchDataUploaded" ADD CONSTRAINT "MatchDataUploaded_scouted_by_fkey" FOREIGN KEY (scouted_by) REFERENCES public."User"(user_id);
CREATE POLICY "Enable insert for authenticated users only" ON public."MatchDataUploaded" FOR INSERT TO authenticated WITH CHECK ((scouted_by = auth.uid()));
