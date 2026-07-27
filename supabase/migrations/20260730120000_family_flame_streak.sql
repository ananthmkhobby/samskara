-- A shared, family-wide "streak" — not per-user. Any member opening the app
-- on a given calendar day keeps the whole family's flame lit; a full day
-- with nobody visiting resets it. No reminder copy anywhere — the number
-- itself is the only signal, same spirit as a Duolingo/Snapchat streak, but
-- collective (nobody wants to be the reason the family's count broke).
alter table families add column flame_streak int not null default 0;
alter table families add column flame_last_date date;

-- security definer + row lock so two family members opening the app at the
-- same moment can't double-increment — the second call simply sees the
-- first's write and takes the "already credited today" branch. Runs for the
-- demo family and the anon key too (no real security weight either way).
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
  select flame_last_date, flame_streak into v_last, v_streak
    from families where id = p_family_id for update;

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

grant execute on function public.bump_family_flame(uuid) to authenticated, anon;
