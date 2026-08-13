-- Close an unauthenticated cross-tenant write.
--
-- bump_family_flame is security definer (it needs the row lock so two members
-- opening the app at the same moment can't double-increment) and EXECUTE was
-- granted to anon so the public demo family's flame keeps ticking. The
-- original migration reasoned there was "no real security weight either way".
-- That was wrong: because the function bypasses RLS and validated nothing, any
-- anonymous caller who knew a family's UUID could write flame_streak and
-- flame_last_date on that family's row. Verified by calling it with the anon
-- key against a real family and watching the row change.
--
-- No personal data was ever exposed — the streak is a counter — but an
-- unauthenticated write into another tenant's row contradicts the guarantee
-- the rest of the schema makes, so it gets the same treatment as every other
-- RPC here: validate the caller inside the function.
--
-- The demo family stays open on purpose. It is public by design, and its
-- flame is part of what makes the demo look alive.

create or replace function public.bump_family_flame(p_family_id uuid)
returns table(streak int, is_new_day boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last date;
  v_streak int;
begin
  -- The one family anybody may touch: the public demo.
  if p_family_id <> '00000000-0000-0000-0000-000000000001'::uuid then
    if auth.uid() is null then
      raise exception 'Sign in to use this family.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from family_members
       where family_id = p_family_id and user_id = auth.uid()
    ) then
      raise exception 'You do not belong to that family.' using errcode = '42501';
    end if;
  end if;

  select flame_last_date, flame_streak into v_last, v_streak
    from families where id = p_family_id for update;

  -- No such family: say nothing rather than returning a value, which
  -- previously let a caller tell a real family id from a made-up one.
  if not found then
    return;
  end if;

  if v_last is null then
    v_streak := 1;
  elsif v_last = current_date then
    return query select v_streak, false;
    return;
  elsif v_last = current_date - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  update families set flame_streak = v_streak, flame_last_date = current_date where id = p_family_id;
  return query select v_streak, true;
end;
$$;

-- anon keeps EXECUTE deliberately: the demo family needs it, and every other
-- family is now rejected inside the function body.
grant execute on function public.bump_family_flame(uuid) to authenticated, anon;
