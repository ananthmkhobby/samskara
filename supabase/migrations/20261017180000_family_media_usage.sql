-- Lets the client show a proactive "47/100 photos used" indicator before
-- an upload attempt, instead of only finding out via the reactive error
-- enforce_media_limit() already throws (supabase/migrations/
-- 20261017120000_plan_enforcement.sql). storage.objects isn't queryable
-- from the client the way a public-schema table is (no SELECT grant to
-- anon/authenticated on the storage schema), so this is a small
-- security-definer RPC that does the same classification the trigger
-- already does, scoped to one family.
create or replace function public.family_media_usage(p_family_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  -- Same membership check the storage RLS policies themselves already
  -- enforce for reads/writes — this function bypasses RLS (security
  -- definer), so it has to redo that check itself rather than relying on
  -- the caller's own row visibility.
  if p_family_id <> '00000000-0000-0000-0000-000000000001'::uuid
     and not exists (select 1 from family_members where family_id = p_family_id and user_id = auth.uid()) then
    raise exception 'Not a member of this family' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'photos', count(*) filter (where metadata ->> 'mimetype' like 'image/%'),
    'recordings', count(*) filter (where metadata ->> 'mimetype' like 'audio/%'),
    'videos', count(*) filter (where metadata ->> 'mimetype' like 'video/%')
  ) into v_result
  from storage.objects
  where bucket_id = 'family-media'
    and (storage.foldername(name))[1] = p_family_id::text;

  return v_result;
end;
$$;

grant execute on function public.family_media_usage(uuid) to authenticated, anon;
