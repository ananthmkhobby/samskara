-- Fixes a real permission bypass in reassign_parents (20261002120100):
-- `v_role not in ('head','admin')` evaluates to SQL NULL, not true, when the
-- caller has no family_members row at all (v_role is null) — and `if null
-- then` is treated as false in PL/pgSQL, so the raise never fired and the
-- check silently let a caller with no role through. Confirmed live: a
-- service-role test call (which has no auth.uid()) was let through and
-- updated a real person's `parents`. delete_person avoids this exact trap
-- by using `is distinct from` instead of `not in` — switching to the same
-- safe form here.
create or replace function public.reassign_parents(p_family_id uuid, p_person_id text, p_parent_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_parent_id text;
  v_new_gen int;
  v_frontier text[];
  v_iterations int := 0;
begin
  select role::text into v_role
    from family_members
   where user_id = auth.uid() and family_id = p_family_id;
  if v_role is null or v_role not in ('head', 'admin') then
    raise exception 'Only an Admin or the Family Head can edit relationships.';
  end if;

  if not exists (select 1 from people where family_id = p_family_id and id = p_person_id) then
    raise exception 'That person is not in this family.';
  end if;

  if p_parent_ids is null then
    p_parent_ids := array[]::text[];
  end if;

  if coalesce(array_length(p_parent_ids, 1), 0) > 2 then
    raise exception 'A person can have at most two parents on record.';
  end if;

  foreach v_parent_id in array p_parent_ids loop
    if v_parent_id = p_person_id then
      raise exception 'Someone cannot be their own parent.';
    end if;
    if not exists (select 1 from people where family_id = p_family_id and id = v_parent_id) then
      raise exception 'Chosen parent is not recorded in this family.';
    end if;
  end loop;

  if coalesce(array_length(p_parent_ids, 1), 0) > 0 and exists (
    with recursive anc(id) as (
      select unnest(p_parent_ids)
      union
      select unnest(pp.parents)
      from people pp, anc
      where pp.family_id = p_family_id and pp.id = anc.id
    )
    select 1 from anc where id = p_person_id
  ) then
    raise exception 'That would create a loop in the family tree — the chosen parent is already a descendant of this person.';
  end if;

  update people set parents = p_parent_ids where family_id = p_family_id and id = p_person_id;

  if coalesce(array_length(p_parent_ids, 1), 0) > 0 then
    select max(gen) + 1 into v_new_gen from people where family_id = p_family_id and id = any(p_parent_ids);
    update people set gen = v_new_gen where family_id = p_family_id and id = p_person_id;
  end if;

  v_frontier := array[p_person_id];
  while coalesce(array_length(v_frontier, 1), 0) > 0 and v_iterations < 200 loop
    update people c
       set gen = sub.new_gen
      from (
        select c3.id, (select max(pp.gen) from people pp where pp.family_id = p_family_id and pp.id = any(c3.parents)) + 1 as new_gen
        from people c3
        where c3.family_id = p_family_id and c3.parents && v_frontier
      ) sub
     where c.family_id = p_family_id and c.id = sub.id;

    select coalesce(array_agg(id), array[]::text[]) into v_frontier
      from people where family_id = p_family_id and parents && v_frontier;
    v_iterations := v_iterations + 1;
  end loop;
end;
$$;

grant execute on function public.reassign_parents(uuid, text, text[]) to authenticated;
