-- Same reasoning as the previous migration: whatsapp_link_tokens.used_by is
-- a short-lived audit pointer (a 15-minute one-time code), not content
-- worth blocking account deletion over. Found by testing: deleting an
-- auth.users row that ever redeemed a link token failed with FK error
-- 23503 against whatsapp_link_tokens_used_by_fkey.
alter table whatsapp_link_tokens drop constraint whatsapp_link_tokens_used_by_fkey;
alter table whatsapp_link_tokens add constraint whatsapp_link_tokens_used_by_fkey
  foreign key (used_by) references auth.users(id) on delete cascade;
