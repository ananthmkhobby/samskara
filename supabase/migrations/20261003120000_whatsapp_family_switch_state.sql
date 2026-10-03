-- whatsapp_conversations.state's CHECK constraint didn't know about the new
-- WAITING_FOR_FAMILY_SWITCH state added alongside the FAMILY command — every
-- write trying to set it was silently rejected (the webhook doesn't check
-- this particular upsert's error, matching its existing pattern for the
-- other upserts in that file), so the state was never actually persisted:
-- the reply looked right but the next message never landed in the right
-- state. Caught by an end-to-end test through the real webhook handler
-- before this shipped, not assumed.
alter table whatsapp_conversations drop constraint whatsapp_conversations_state_check;
alter table whatsapp_conversations add constraint whatsapp_conversations_state_check
  check (state in (
    'IDLE', 'WAITING_FOR_PERSON', 'WAITING_FOR_PERSON_CONFIRMATION',
    'WAITING_FOR_STORY', 'WAITING_FOR_CONFIRMATION', 'COMPLETED',
    'WAITING_FOR_FAMILY_SWITCH'
  ));
