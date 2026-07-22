SET check_function_bodies = false;
ALTER TABLE public."User" DROP COLUMN write_authorized;
REVOKE ALL ON FUNCTION public.enforce_user_profile_update() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_user_profile_update() FROM authenticated;
REVOKE ALL ON FUNCTION public.enforce_user_profile_update() FROM service_role;
