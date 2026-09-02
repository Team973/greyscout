-- Split pre-scouting's single "estimated tier" into three separate tiers
-- (scoring/driving/defense), per follow-up on issue #51.
ALTER TABLE "public"."PreScoutData" DROP COLUMN "prescout_tier";
ALTER TABLE "public"."PreScoutData" ADD COLUMN "prescout_scoring_tier" "text";
ALTER TABLE "public"."PreScoutData" ADD COLUMN "prescout_driving_tier" "text";
ALTER TABLE "public"."PreScoutData" ADD COLUMN "prescout_defense_tier" "text";
