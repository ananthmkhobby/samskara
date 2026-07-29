-- Two independent fixes bundled in one migration:
--
-- 1. Sibling display order in the tree currently has no guaranteed source —
--    `people` is fetched with no ORDER BY, `id` is a human slug (not
--    sequential), and a bulk xlsx import inserts all rows in one statement
--    so `created_at` can't tell them apart either. Adds an explicit
--    `sort_index` column that every insert path now populates directly
--    (see src/data/familyDb.js), backfilled here as a one-time best-effort
--    normalization for whatever's already in the database.
--
-- 2. No link exists between a logged-in user and a specific person in
--    their own tree, so the Tree view has no way to highlight "you are
--    here". Adds a nullable person_id to family_members, plus a
--    security-definer RPC to set it — deliberately NOT a direct RLS
--    update policy: family_members writes are already only ever done
--    through validated RPCs (redeem_invite(), set_active_family()), and a
--    "member can update their own row" RLS policy would also let that
--    member touch their own `role` column, a real escalation path.

alter table people add column sort_index integer;

-- Best-effort normalization: there's no reliable order to preserve today,
-- so this just gives every existing family a stable starting point. Going
-- forward, every insert path sets sort_index explicitly.
update people p set sort_index = ranked.rn
from (
  select family_id, id, row_number() over (partition by family_id order by created_at, id) - 1 as rn
  from people
) ranked
where p.family_id = ranked.family_id and p.id = ranked.id;

alter table family_members add column person_id text;
alter table family_members
  add constraint family_members_person_id_fkey
  foreign key (family_id, person_id) references people(family_id, id) on delete set null;

create or replace function public.set_member_person_link(p_member_id uuid, p_person_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid;
  v_user_id uuid;
begin
  select family_id, user_id into v_family_id, v_user_id from family_members where id = p_member_id;
  if v_family_id is null then
    raise exception 'No such member row.';
  end if;
  if v_family_id != public.current_family_id() then
    raise exception 'That member is not in your active family.';
  end if;
  -- A member can link themselves; a head/admin can link anyone in the
  -- family (helping a less tech-savvy relative pick themselves out).
  if v_user_id != auth.uid() and not public.is_moderator() then
    raise exception 'Only that member, or a Head/Admin, can set this.';
  end if;
  if p_person_id is not null and not exists (select 1 from people where family_id = v_family_id and id = p_person_id) then
    raise exception 'That person is not in this family.';
  end if;
  update family_members set person_id = p_person_id where id = p_member_id;
end;
$$;

grant execute on function public.set_member_person_link(uuid, text) to authenticated;
