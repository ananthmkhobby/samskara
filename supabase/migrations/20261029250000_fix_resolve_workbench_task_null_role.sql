-- CRITICAL fix — same permission-bypass class this codebase already hit
-- and fixed once before (20261002120200_fix_reassign_parents_null_role.sql),
-- reproduced in resolve_workbench_task() without noticing: `v_role not in
-- ('head','admin')` evaluates to SQL NULL, not true, when the caller has
-- NO family_members row at all in that family (v_role is null) — and `if
-- null then` is false in PL/pgSQL, so the exception never fired. Confirmed
-- live, testing exactly the multi-family-admin scenario this was built to
-- isolate: a second family's own Head, with zero membership in the first
-- family, was able to successfully resolve the first family's workbench
-- task — a genuine cross-family isolation break, not a multi-family
-- edge case working as intended. Same fix as before: `is distinct from`/
-- explicit null check instead of a bare `not in`.
create or replace function public.resolve_workbench_task(p_task_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_task ffo_workbench_tasks%rowtype;
  v_role text;
  v_person_id text;
begin
  select * into v_task from ffo_workbench_tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception 'No such task.';
  end if;

  select role::text into v_role from family_members where user_id = auth.uid() and family_id = v_task.family_id;
  if v_role is null or v_role not in ('head', 'admin') then
    raise exception 'Only an Admin or the Family Head can resolve this.';
  end if;

  if p_action = 'link_existing_person' then
    v_person_id := p_payload ->> 'person_id';
    if v_person_id is null or not exists (select 1 from people where family_id = v_task.family_id and id = v_person_id) then
      raise exception 'That person is not in this family.';
    end if;
    update family_members set person_id = v_person_id, placement_status = 'PLACED_CONFIRMED' where id = v_task.family_member_id;

  elsif p_action = 'confirm_provisional' then
    if v_task.provisional_person_id is null then
      raise exception 'This task has no provisional person to confirm.';
    end if;
    update people set provisional_status = null
      where family_id = v_task.family_id and id = v_task.provisional_person_id;
    if v_task.family_member_id is not null then
      update family_members set person_id = v_task.provisional_person_id, placement_status = 'PLACED_CONFIRMED'
        where id = v_task.family_member_id;
    end if;

  elsif p_action = 'invite_missing_person' then
    insert into invites (family_id, created_by, person_id, proposed_person_name)
    values (v_task.family_id, auth.uid(), v_task.provisional_person_id, nullif(trim(p_payload ->> 'proposed_name'), ''));

  elsif p_action = 'close_unresolved' then
    if v_task.path_claim_id is not null then
      update relationship_path_claims set status = 'CLOSED_UNRESOLVED', resolution_note = p_payload ->> 'note', resolved_at = now()
        where id = v_task.path_claim_id;
    end if;

  elsif p_action = 'mark_duplicate' then
    null;

  else
    raise exception 'Unknown action.';
  end if;

  update ffo_workbench_tasks
    set status = case when p_action = 'close_unresolved' then 'CLOSED_UNRESOLVED' else 'RESOLVED' end,
        resolved_by = auth.uid(), resolved_at = now(), updated_at = now(),
        note = coalesce(p_payload ->> 'note', note)
    where id = p_task_id;
end;
$$;
grant execute on function public.resolve_workbench_task(uuid, text, jsonb) to authenticated;
