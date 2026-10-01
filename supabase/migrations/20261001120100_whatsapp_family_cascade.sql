-- Every other family_id foreign key in the schema cascades on delete
-- (people, contributions, invites, ...) so that deleting a family cleans up
-- everything scoped to it instead of leaving the delete blocked by a
-- dangling reference. The previous migration missed this for the two new
-- WhatsApp tables — fixed here rather than editing an already-applied
-- migration file.
alter table whatsapp_messages drop constraint whatsapp_messages_family_id_fkey;
alter table whatsapp_messages add constraint whatsapp_messages_family_id_fkey
  foreign key (family_id) references families(id) on delete cascade;

alter table whatsapp_conversations drop constraint whatsapp_conversations_family_id_fkey;
alter table whatsapp_conversations add constraint whatsapp_conversations_family_id_fkey
  foreign key (family_id) references families(id) on delete cascade;
