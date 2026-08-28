-- Scout assignments are now by alliance station (red/blue, slot 1-3) rather
-- than by a specific team number, since the team occupying a station
-- changes match-to-match while the station itself doesn't. The table is
-- still empty in production, so this is a plain column swap.

DROP INDEX IF EXISTS "scoutassignment_slot_unique";

ALTER TABLE public."ScoutAssignment" DROP COLUMN "team_number";

ALTER TABLE public."ScoutAssignment"
    ADD COLUMN "alliance" text NOT NULL,
    ADD COLUMN "slot_index" smallint NOT NULL,
    ADD CONSTRAINT "ScoutAssignment_alliance_check" CHECK (alliance IN ('red', 'blue')),
    ADD CONSTRAINT "ScoutAssignment_slot_index_check" CHECK (slot_index BETWEEN 1 AND 3);

CREATE UNIQUE INDEX "scoutassignment_slot_unique" ON public."ScoutAssignment" USING btree (event_id, match_number, alliance, slot_index);
