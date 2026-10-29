-- Found during end-to-end FFO retesting: delete_person() predates
-- relationship_path_claims/ffo_workbench_tasks, and both carry the exact
-- same broken-composite-FK shape 20260814120000_delete_person.sql already
-- documented for four other tables (`(family_id, person_id) references
-- people(family_id, id) on delete set null` -- Postgres's SET NULL nulls
-- every column of the referencing key, including the NOT NULL family_id).
-- Confirmed by test before this fix, not assumed: deleting a person who
-- was ever used as a claim's anchor_person_id failed with
--   null value in column "family_id" of relation "relationship_path_claims"
--   violates not-null constraint
-- and the same would happen for a deleted provisional person still
-- referenced by a workbench task. Re-creates delete_person() with the
-- same two extra explicit null-outs the existing four already get —
-- everything else in the function is unchanged.
create or replace function public.delete_person(p_family_id uuid, p_person_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_spouse text;
  v_child_names text;
begin
  select role::text into v_role
    from family_members
   where user_id = auth.uid() and family_id = p_family_id;
  if v_role is distinct from 'head' then
    raise exception 'Only the Family Head can remove someone from the tree.';
  end if;

  if not exists (select 1 from people where family_id = p_family_id and id = p_person_id) then
    raise exception 'That person is not in this family.';
  end if;

  select string_agg(name, ', ') into v_child_names
    from people where family_id = p_family_id and parents @> array[p_person_id];
  if v_child_names is not null then
    raise exception 'Can''t remove — % recorded as their child. Remove that first, or fix the parent link.', v_child_names;
  end if;

  select spouse into v_spouse from people where family_id = p_family_id and id = p_person_id;
  if v_spouse is not null then
    update people set spouse = null where family_id = p_family_id and id = v_spouse;
  end if;

  update contributions set person_id = null where family_id = p_family_id and person_id = p_person_id;
  update contributions set anchor_person_id = null where family_id = p_family_id and anchor_person_id = p_person_id;
  update family_members set person_id = null where family_id = p_family_id and person_id = p_person_id;
  update book_ownership set person_id = null where family_id = p_family_id and person_id = p_person_id;
  update invites set person_id = null where family_id = p_family_id and person_id = p_person_id;
  -- The two FFO tables with the same broken-composite-FK shape.
  update relationship_path_claims set anchor_person_id = null where family_id = p_family_id and anchor_person_id = p_person_id;
  update ffo_workbench_tasks set provisional_person_id = null where family_id = p_family_id and provisional_person_id = p_person_id;

  delete from people where family_id = p_family_id and id = p_person_id;
end;
$$;

grant execute on function public.delete_person(uuid, text) to authenticated;
