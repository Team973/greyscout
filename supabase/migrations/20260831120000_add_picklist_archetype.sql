-- Split picklists into independent Scorer/Defender archetypes (issue #27).
-- Existing rows default to 'scorer', so today's lists become the Scorer
-- lists automatically.
ALTER TABLE "public"."PickList" ADD COLUMN "archetype" text NOT NULL DEFAULT 'scorer';
ALTER TABLE "public"."PickList" ADD CONSTRAINT "PickList_archetype_check" CHECK (("archetype" = ANY (ARRAY['scorer'::"text", 'defender'::"text"])));

DROP INDEX "picklist_personal_unique";
DROP INDEX "picklist_team_unique";
CREATE UNIQUE INDEX "picklist_personal_unique" ON "public"."PickList" USING "btree" ("user_id", "event_id", "type", "archetype") WHERE ("type" = 'personal'::"text");
CREATE UNIQUE INDEX "picklist_team_unique" ON "public"."PickList" USING "btree" ("event_id", "type", "archetype") WHERE ("type" = 'team'::"text");
