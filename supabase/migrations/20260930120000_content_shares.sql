-- Lets a Head/Admin share one of their family's own Parampare entries with
-- another family as a one-time copy — e.g. in-laws, or two branches of the
-- same family that are run as separate archives. Deliberately NOT shared
-- editing or an ongoing link: the receiving family gets an independent copy
-- in their own review queue, same as anything else contributed there.
--
-- Mirrors `invites` on purpose (same code shape, same "moderator generates,
-- security-definer function redeems" split) rather than inventing a new
-- pattern — a share code is really the same idea as an invite code, just
-- carrying a content payload instead of family membership.
create table content_shares (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default encode(gen_random_bytes(5), 'hex'),
  source_family_id uuid not null references families(id) on delete cascade,
  content_type text not null default 'parampara' check (content_type in ('parampara')),
  field text not null,
  title text,
  content text not null,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  redeemed_by_family_id uuid references families(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table content_shares enable row level security;

-- Only a moderator can create a share, and only for their own family — no
-- read policy at all for anyone else's rows (a code is looked up by its
-- own value inside redeem_content_share below, which runs as security
-- definer, so no client-facing SELECT is needed for redemption).
create policy "moderator can read own shares" on content_shares for select
  using (source_family_id = current_family_id() and is_moderator());
create policy "moderator can create share" on content_shares for insert
  with check (source_family_id = current_family_id() and is_moderator() and created_by = auth.uid());

-- Redeeming copies the snapshot into the caller's own family as a fresh
-- contribution, exactly the shape a normal Parampare submission takes.
-- Security definer for the same reason redeem_invite is: it has to insert
-- into contributions on the caller's behalf after validating the code,
-- and family-blind on purpose — the receiving family only ever sees "from
-- another family", never which one, matching how the rest of the app never
-- lets one family see another exists.
create or replace function public.redeem_content_share(p_code text)
returns table(title text)
language plpgsql security definer set search_path = public as $$
declare
  v_share content_shares%rowtype;
  v_family_id uuid;
begin
  v_family_id := current_family_id();
  if v_family_id is null or not is_moderator() then
    raise exception 'Only a Head or Admin can bring in a shared story.';
  end if;

  select * into v_share from content_shares where code = p_code for update;
  if v_share.id is null then
    raise exception 'That code doesn''t match any shared story.';
  end if;
  if v_share.expires_at < now() then
    raise exception 'This share has expired — ask them to generate a new code.';
  end if;
  if v_share.source_family_id = v_family_id then
    raise exception 'This story is already from your own family.';
  end if;

  insert into contributions (family_id, type, field, title, content, contributor, status)
  values (v_family_id, 'parampara', v_share.field, v_share.title, v_share.content, 'Shared from another family', 'Verified');

  update content_shares set redeemed_by_family_id = v_family_id, redeemed_at = now() where id = v_share.id;

  return query select v_share.title;
end;
$$;

grant execute on function public.redeem_content_share(text) to authenticated;
