SET check_function_bodies = false;
CREATE FUNCTION public.enforce_user_profile_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
ALTER TABLE public."User" ALTER COLUMN role SET DEFAULT 'observer'::text;
ALTER TABLE public."User" ALTER COLUMN role SET NOT NULL;
ALTER TABLE public."User" ADD CONSTRAINT "User_role_check" CHECK (role = ANY (ARRAY['admin'::text, 'lead'::text, 'member'::text, 'observer'::text]));
ALTER TABLE public."User" ADD COLUMN name text;
CREATE TRIGGER enforce_user_profile_update BEFORE UPDATE ON public."User" FOR EACH ROW EXECUTE FUNCTION public.enforce_user_profile_update();
CREATE POLICY "Enable insert for own profile" ON public."User" FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (role = 'observer'::text)));
CREATE POLICY "Enable update for authenticated users" ON public."User" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
