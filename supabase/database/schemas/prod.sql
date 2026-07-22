


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





CREATE OR REPLACE FUNCTION "public"."enforce_user_profile_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_role text;
  role_rank jsonb := '{"observer":0,"member":1,"lead":2,"admin":3}'::jsonb;
  actor_rank int;
  old_rank int;
  new_rank int;
BEGIN
  -- No auth context (service_role / server-side jobs) bypasses the checks below.
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "role" INTO actor_role FROM "public"."User" WHERE "user_id" = actor_id;
  actor_rank := (role_rank ->> actor_role)::int;

  IF NEW."role" IS DISTINCT FROM OLD."role" THEN
    old_rank := (role_rank ->> OLD."role")::int;
    new_rank := (role_rank ->> NEW."role")::int;

    IF actor_rank IS NULL THEN
      RAISE EXCEPTION 'Only recognized roles may change roles';
    END IF;

    IF new_rank > old_rank THEN
      -- Promotion: the actor must outrank the target's current role, and cannot grant
      -- a role higher than their own.
      IF NOT (actor_rank > old_rank AND new_rank <= actor_rank) THEN
        RAISE EXCEPTION 'Not authorized to promote this user to %', NEW."role";
      END IF;
    ELSIF new_rank < old_rank THEN
      -- Relegation (demotion) is admin-only.
      IF actor_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only admins may relegate users';
      END IF;
    END IF;
  END IF;

  IF NEW."name" IS DISTINCT FROM OLD."name" AND actor_id IS DISTINCT FROM NEW."user_id" THEN
    RAISE EXCEPTION 'Users may only update their own name';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_user_profile_update"() OWNER TO "postgres";


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Event" (
    "event_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date"
);


ALTER TABLE "public"."Event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MatchData" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event" "text",
    "scouted_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "prematch_match_number" smallint NOT NULL,
    "prematch_team_number" smallint NOT NULL,
    "prematch_alliance" "text",
    "prematch_noshow" boolean DEFAULT false,
    "postmatch_cards" "text",
    "postmatch_comments" "text",
    "key" "text",
    "source" "text"
);


ALTER TABLE "public"."MatchData" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."MatchData2025" (
    "id" bigint NOT NULL,
    "prematch_team_number" "text",
    "auto_coral" smallint NOT NULL,
    "auto_leave" smallint,
    "teleop_coral" smallint,
    "teleop_net" smallint,
    "teleop_processor" smallint,
    "endgame_climb" smallint,
    "postmatch_defense" smallint,
    "postmatch_died" smallint,
    "prematch_match_number" smallint,
    "event" "text"
);


ALTER TABLE "public"."MatchData2025" OWNER TO "postgres";


COMMENT ON TABLE "public"."MatchData2025" IS 'Archived 2025-season match scouting data (2025cafr). Superseded by the 2026 MatchData schema.';


CREATE TABLE IF NOT EXISTS "public"."MatchDataUploaded2025" (
    "id" bigint NOT NULL,
    "prematch_team_number" "text",
    "auto_coral" smallint NOT NULL,
    "auto_leave" smallint,
    "teleop_coral" smallint,
    "teleop_net" smallint,
    "teleop_processor" smallint,
    "endgame_climb" smallint,
    "postmatch_defense" smallint,
    "postmatch_died" smallint,
    "prematch_match_number" smallint,
    "event" "text",
    "key" "text" NOT NULL,
    "source" "text"
);


ALTER TABLE "public"."MatchDataUploaded2025" OWNER TO "postgres";


COMMENT ON TABLE "public"."MatchDataUploaded2025" IS 'Archived 2025-season match scouting data (2025cafr). Superseded by the consolidated 2026 MatchData table.';


CREATE TABLE IF NOT EXISTS "public"."PitData" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event" "text",
    "scouted_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "pit_team_number" smallint NOT NULL,
    "pit_drivetrain" "text",
    "pit_weight" real NOT NULL,
    "pit_language" "text" NOT NULL,
    "pit_vibe_check" smallint NOT NULL,
    "pit_comments" "text",
    CONSTRAINT "PitData_vibe_check_check" CHECK ((("pit_vibe_check" >= 1) AND ("pit_vibe_check" <= 5)))
);


ALTER TABLE "public"."PitData" OWNER TO "postgres";


ALTER TABLE "public"."MatchData" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."MatchData_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."MatchDataUploaded2025" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."MatchDataUploaded2025_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."MatchData2025" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."MatchData2025_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."PitData" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."PitData_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."PickList" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "team_numbers" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "PickList_type_check" CHECK (("type" = ANY (ARRAY['personal'::"text", 'team'::"text"])))
);


ALTER TABLE "public"."PickList" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."RobotPhoto" (
    "team_number" smallint NOT NULL,
    "photo_url" "text"
);


ALTER TABLE "public"."RobotPhoto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Team" (
    "key" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "team_number" smallint,
    "name" "text"
);


ALTER TABLE "public"."Team" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."User" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'observer'::"text" NOT NULL,
    "name" "text",
    CONSTRAINT "User_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'lead'::"text", 'member'::"text", 'observer'::"text"])))
);


ALTER TABLE "public"."User" OWNER TO "postgres";


CREATE OR REPLACE TRIGGER "enforce_user_profile_update" BEFORE UPDATE ON "public"."User" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_user_profile_update"();


ALTER TABLE ONLY "public"."Event"
    ADD CONSTRAINT "Event_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."MatchData"
    ADD CONSTRAINT "MatchData_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."MatchData"
    ADD CONSTRAINT "MatchData_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."MatchDataUploaded2025"
    ADD CONSTRAINT "MatchDataUploaded2025_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."MatchData2025"
    ADD CONSTRAINT "MatchData2025_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PitData"
    ADD CONSTRAINT "PitData_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."PickList"
    ADD CONSTRAINT "PickList_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."RobotPhoto"
    ADD CONSTRAINT "RobotPhoto_pkey" PRIMARY KEY ("team_number");



ALTER TABLE ONLY "public"."RobotPhoto"
    ADD CONSTRAINT "RobotPhoto_team_number_key" UNIQUE ("team_number");



ALTER TABLE ONLY "public"."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("user_id");



CREATE UNIQUE INDEX "picklist_personal_unique" ON "public"."PickList" USING "btree" ("user_id", "event_id", "type") WHERE ("type" = 'personal'::"text");



CREATE UNIQUE INDEX "picklist_team_unique" ON "public"."PickList" USING "btree" ("event_id", "type") WHERE ("type" = 'team'::"text");



ALTER TABLE ONLY "public"."PickList"
    ADD CONSTRAINT "PickList_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."User"
    ADD CONSTRAINT "User_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."MatchData"
    ADD CONSTRAINT "MatchData_scouted_by_fkey" FOREIGN KEY ("scouted_by") REFERENCES "public"."User"("user_id");



ALTER TABLE ONLY "public"."PitData"
    ADD CONSTRAINT "PitData_scouted_by_fkey" FOREIGN KEY ("scouted_by") REFERENCES "public"."User"("user_id");



CREATE POLICY "Enable insert for authenticated users" ON "public"."RobotPhoto" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."MatchData" FOR INSERT TO "authenticated" WITH CHECK (("scouted_by" = "auth"."uid"()));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."PitData" FOR INSERT TO "authenticated" WITH CHECK (("scouted_by" = "auth"."uid"()));



CREATE POLICY "Enable read access for authenticated users" ON "public"."PickList" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for logged in users" ON "public"."Event" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for logged in users" ON "public"."MatchData" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for logged in users" ON "public"."PitData" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for logged in users" ON "public"."MatchData2025" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."MatchDataUploaded2025" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for logged in users" ON "public"."RobotPhoto" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for logged in users" ON "public"."Team" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for logged in users" ON "public"."User" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable insert for own profile" ON "public"."User" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'observer'::"text")));



CREATE POLICY "Enable update for authenticated users" ON "public"."User" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users" ON "public"."RobotPhoto" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."MatchData" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."PitData" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Enable write access for personal lists" ON "public"."PickList" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "Enable write access for picklists" ON "public"."PickList" TO "authenticated" USING (true);


ALTER TABLE "public"."Event" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MatchData" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PitData" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MatchData2025" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."MatchDataUploaded2025" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."PickList" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."RobotPhoto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."Team" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";








































































































































































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;












GRANT ALL ON TABLE "public"."Event" TO "anon";
GRANT ALL ON TABLE "public"."Event" TO "authenticated";
GRANT ALL ON TABLE "public"."Event" TO "service_role";



GRANT ALL ON TABLE "public"."MatchData" TO "anon";
GRANT ALL ON TABLE "public"."MatchData" TO "authenticated";
GRANT ALL ON TABLE "public"."MatchData" TO "service_role";



GRANT ALL ON SEQUENCE "public"."MatchData_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."MatchData_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."MatchData_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."PitData" TO "anon";
GRANT ALL ON TABLE "public"."PitData" TO "authenticated";
GRANT ALL ON TABLE "public"."PitData" TO "service_role";



GRANT ALL ON SEQUENCE "public"."PitData_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."PitData_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."PitData_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."MatchData2025" TO "anon";
GRANT ALL ON TABLE "public"."MatchData2025" TO "authenticated";
GRANT ALL ON TABLE "public"."MatchData2025" TO "service_role";



GRANT ALL ON TABLE "public"."MatchDataUploaded2025" TO "anon";
GRANT ALL ON TABLE "public"."MatchDataUploaded2025" TO "authenticated";
GRANT ALL ON TABLE "public"."MatchDataUploaded2025" TO "service_role";



GRANT ALL ON SEQUENCE "public"."MatchDataUploaded2025_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."MatchDataUploaded2025_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."MatchDataUploaded2025_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."MatchData2025_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."MatchData2025_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."MatchData2025_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."PickList" TO "anon";
GRANT ALL ON TABLE "public"."PickList" TO "authenticated";
GRANT ALL ON TABLE "public"."PickList" TO "service_role";



GRANT ALL ON TABLE "public"."RobotPhoto" TO "anon";
GRANT ALL ON TABLE "public"."RobotPhoto" TO "authenticated";
GRANT ALL ON TABLE "public"."RobotPhoto" TO "service_role";



GRANT ALL ON TABLE "public"."Team" TO "anon";
GRANT ALL ON TABLE "public"."Team" TO "authenticated";
GRANT ALL ON TABLE "public"."Team" TO "service_role";



GRANT ALL ON TABLE "public"."User" TO "anon";
GRANT ALL ON TABLE "public"."User" TO "authenticated";
GRANT ALL ON TABLE "public"."User" TO "service_role";



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































