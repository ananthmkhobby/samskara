-- Deleting a person has never been possible through the app before now — no
-- UI called for it, so only an RLS policy existed ("head can delete own
-- people"), with nothing behind it. Adding a real path (AddPeopleCard's
-- "remove a mistake right after import" review step) surfaced a genuine,
-- previously-latent schema bug: four tables reference people via a
-- COMPOSITE foreign key `(family_id, person_id) references people(family_id,
-- id) on delete set null`. Postgres's SET NULL action nulls every column of
-- the referencing key — including family_id — and every one of those tables
-- declares its own family_id NOT NULL. Deleting a person who had ANY row in
-- contributions, family_members (a self-link), book_ownership or invites
-- would therefore fail with a NOT NULL violation on a column the delete
-- never meant to touch. Confirmed by test before this fix existed, not
-- assumed: the exact error was
--   null value in column "family_id" of relation "contributions"
--   violates not-null constraint
--
-- book_ownership and invites also have no UPDATE policy at all (by design —
-- ordinary members were never meant to edit either table directly), so a
-- plain client-side UPDATE to clear person_id on those two would silently
-- affect zero rows under RLS and never actually fix anything. Wrapping the
-- whole operation in one security-definer function sidesteps that entirely
-- (it runs with the function owner's privileges, not the caller's) and,
-- as a real bonus, makes the multi-table cleanup atomic — a client-side
-- sequence of separate calls could fail partway through and leave the
-- person half-detached; this can't.
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
  -- Checked against membership of the TARGET family, not current_family_id()
  -- — matches update_family_name's own reasoning: being Head of one family
  -- must never confer rights over another for a multi-family account.
  select role::text into v_role
    from family_members
   where user_id = auth.uid() and family_id = p_family_id;
  if v_role is distinct from 'head' then
    raise exception 'Only the Family Head can remove someone from the tree.';
  end if;

  if not exists (select 1 from people where family_id = p_family_id and id = p_person_id) then
    raise exception 'That person is not in this family.';
  end if;

  -- `parents` is a plain text[], not a real foreign key (see people.parents)
  -- — nothing would stop this delete at the database level, but it would
  -- silently leave a child pointing at a parent who no longer exists.
  -- Refused loudly instead, before it happens.
  select string_agg(name, ', ') into v_child_names
    from people where family_id = p_family_id and parents @> array[p_person_id];
  if v_child_names is not null then
    raise exception 'Can''t remove — % recorded as their child. Remove that first, or fix the parent link.', v_child_names;
  end if;

  -- people.spouse IS a real foreign key (no delete action = blocks by
  -- default), so it has to be cleared on both sides before the row can go.
  select spouse into v_spouse from people where family_id = p_family_id and id = p_person_id;
  if v_spouse is not null then
    update people set spouse = null where family_id = p_family_id and id = v_spouse;
  end if;

  -- The four broken-composite-FK tables described above, cleared explicitly
  -- so there's nothing left for their own (mis-designed) ON DELETE SET NULL
  -- to act on.
  update contributions set person_id = null where family_id = p_family_id and person_id = p_person_id;
  update contributions set anchor_person_id = null where family_id = p_family_id and anchor_person_id = p_person_id;
  update family_members set person_id = null where family_id = p_family_id and person_id = p_person_id;
  update book_ownership set person_id = null where family_id = p_family_id and person_id = p_person_id;
  update invites set person_id = null where family_id = p_family_id and person_id = p_person_id;

  delete from people where family_id = p_family_id and id = p_person_id;
end;
$$;

grant execute on function public.delete_person(uuid, text) to authenticated;
