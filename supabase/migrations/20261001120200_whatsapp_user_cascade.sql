-- whatsapp_messages/whatsapp_conversations are purely operational/debug
-- data (an audit trail + in-flight chat state), not meaningful family
-- content worth preserving after someone's account is gone — unlike
-- contributor_user_id on `contributions`, which deliberately doesn't
-- cascade. Found via testing: without this, deleting an auth.users row
-- that has ever messaged WhatsApp fails outright (a dangling, non-cascading
-- reference blocks the delete), which would make "delete my account" block
-- on a debug log forever. Cascade instead.
alter table whatsapp_messages drop constraint whatsapp_messages_user_id_fkey;
alter table whatsapp_messages add constraint whatsapp_messages_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table whatsapp_conversations drop constraint whatsapp_conversations_user_id_fkey;
alter table whatsapp_conversations add constraint whatsapp_conversations_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
