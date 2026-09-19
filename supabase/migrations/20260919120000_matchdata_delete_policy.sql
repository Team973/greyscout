-- Allow deleting match scouting submissions from the Edit Match Submission view.
-- Matches the existing UPDATE policy: any authenticated user.
CREATE POLICY "Enable delete for authenticated users only" ON "public"."MatchData" FOR DELETE TO "authenticated" USING (true);
