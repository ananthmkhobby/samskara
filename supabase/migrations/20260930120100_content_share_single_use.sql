-- Fix: redeem_content_share never actually checked redeemed_at, so despite
-- the UI telling the sharer "works once", the same code could be redeemed
-- an unlimited number of times right up until it expired. Caught by testing
-- the exact same code twice before this shipped, not assumed.
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
  if v_share.redeemed_at is not null then
    raise exception 'This code has already been used.';
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
