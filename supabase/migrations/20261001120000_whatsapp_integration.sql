-- WhatsApp -> Samskara memory capture (Sandbox MVP).
--
-- Design: WhatsApp-contributed content becomes ordinary `contributions`
-- rows (same review-queue table every other edit path already uses) rather
-- than a new parallel table — a photo+story exchange becomes two linked
-- rows (type 'photo' + type 'memory') sharing one source_message_id, the
-- same shape a manual ContributeModal submission already produces. Nothing
-- changes for any existing row: `source` defaults to 'app'.
--
-- One family per user is already enforced (family_members.user_id is
-- unique), so a WhatsApp number resolves to exactly one user -> exactly one
-- family — no "which family?" disambiguation table is needed.
alter table contributions
  add column source text not null default 'app' check (source in ('app', 'whatsapp')),
  add column source_message_id text;

-- Maps a WhatsApp phone number (E.164, e.g. +919xxxxxxxxx) to the Samskara
-- account it's been linked to. Never identify someone by WhatsApp display
-- name — only this table, keyed on the verified inbound number, counts.
-- No client policies: only the service-role webhook reads/writes this, and
-- the only way IN is redeem_whatsapp_link() below (security definer).
create table whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  phone_number text not null unique,
  created_at timestamptz not null default now()
);
alter table whatsapp_connections enable row level security;

-- Short-lived, single-use linking codes — same shape as `invites`
-- (code/expires_at/used_by/used_at), except the phone_number here is
-- written server-side by the webhook from the real inbound message, never
-- supplied by the client. That's the whole security property: a browser
-- can redeem a code, but it can never choose which phone number it links.
create table whatsapp_link_tokens (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default encode(gen_random_bytes(6), 'hex'),
  phone_number text not null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_by uuid references auth.users(id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table whatsapp_link_tokens enable row level security;

-- Redemption: the signed-in browser calls this directly (supabase.rpc),
-- exactly like redeem_invite() does for family invites. Security definer so
-- it can insert into whatsapp_connections (which has no client insert
-- policy at all).
create or replace function public.redeem_whatsapp_link(p_code text)
returns table(phone_number text)
language plpgsql security definer set search_path = public as $$
declare
  v_token whatsapp_link_tokens%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;
  if current_family_id() is null then
    raise exception 'Your account isn''t part of a family yet.';
  end if;

  select * into v_token from whatsapp_link_tokens where code = p_code for update;
  if v_token.id is null then
    raise exception 'That link has already been used or doesn''t exist — ask Samskara to send a new one.';
  end if;
  if v_token.used_at is not null then
    raise exception 'That link has already been used.';
  end if;
  if v_token.expires_at < now() then
    raise exception 'That link has expired — send another message on WhatsApp to get a fresh one.';
  end if;

  insert into whatsapp_connections (user_id, phone_number)
  values (auth.uid(), v_token.phone_number)
  on conflict (user_id) do update set phone_number = excluded.phone_number;

  update whatsapp_link_tokens set used_by = auth.uid(), used_at = now() where id = v_token.id;

  return query select v_token.phone_number;
end;
$$;

grant execute on function public.redeem_whatsapp_link(text) to authenticated;

-- Idempotency ledger + the admin "WhatsApp" debug tab's data source. Every
-- inbound Twilio message gets a row here keyed on its unique message SID —
-- a duplicate webhook delivery (Twilio retries on anything but a fast 200)
-- hits the unique constraint and is treated as already-processed rather
-- than creating a second memory.
create table whatsapp_messages (
  id bigint generated always as identity primary key,
  twilio_message_sid text not null unique,
  phone_number text not null,
  user_id uuid references auth.users(id),
  family_id uuid references families(id),
  message_type text not null default 'text' check (message_type in ('text', 'image', 'audio', 'document', 'unknown')),
  text_body text,
  media_content_type text,
  stored_media_path text,
  processing_status text not null default 'received' check (processing_status in ('received', 'processing', 'completed', 'failed', 'duplicate')),
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table whatsapp_messages enable row level security;

-- Powers the admin tab: a moderator sees only their own family's traffic.
-- No client write policy — only the service-role webhook inserts/updates.
create policy "moderator can read own family whatsapp messages" on whatsapp_messages for select
  using (family_id = current_family_id() and is_moderator());

-- One row per phone number — the live state of that number's in-progress
-- conversation. Never read directly by the browser (service role only, no
-- RLS client policy needed), since the webhook is the only thing that ever
-- talks to it.
create table whatsapp_conversations (
  phone_number text primary key,
  user_id uuid not null references auth.users(id),
  family_id uuid not null references families(id),
  state text not null default 'IDLE' check (state in (
    'IDLE', 'WAITING_FOR_PERSON', 'WAITING_FOR_PERSON_CONFIRMATION',
    'WAITING_FOR_STORY', 'WAITING_FOR_CONFIRMATION', 'COMPLETED'
  )),
  pending_person_id text,
  context jsonb not null default '{}'::jsonb,
  last_interaction_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table whatsapp_conversations enable row level security;
