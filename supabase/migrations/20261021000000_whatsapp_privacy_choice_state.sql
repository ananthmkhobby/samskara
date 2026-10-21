-- Widens whatsapp_conversations.state for WAITING_FOR_PRIVACY_CHOICE
-- (_whatsappConversation.js's "private or shared?" step, reached after a
-- photo/document's story or straight after a text/audio memory, right
-- before the final save confirmation). Same bug class as
-- 20261003120000_whatsapp_family_switch_state.sql and
-- 20261006120000_whatsapp_photo_id_state.sql: a write silently rejected by
-- this CHECK constraint, because the constraint didn't know this state
-- existed yet.
--
-- Found live on the test deployment: the privacy-choice write kept failing
-- this constraint, but api/whatsapp-webhook.js's final
-- whatsapp_conversations upsert never checks { error } on that call — the
-- reply text (computed in memory) still went out, so the user kept seeing
-- the same "Private to just you, or shared with the family?" question
-- forever, because the conversation row never actually advanced past
-- WAITING_FOR_STORY. See the matching fix in whatsapp-webhook.js, which now
-- logs (rather than silently drops) a failed conversation-state write.
alter table whatsapp_conversations drop constraint whatsapp_conversations_state_check;
alter table whatsapp_conversations add constraint whatsapp_conversations_state_check
  check (state in (
    'IDLE', 'WAITING_FOR_PERSON', 'WAITING_FOR_PERSON_CONFIRMATION',
    'WAITING_FOR_STORY', 'WAITING_FOR_PRIVACY_CHOICE', 'WAITING_FOR_CONFIRMATION', 'COMPLETED',
    'WAITING_FOR_FAMILY_SWITCH', 'WAITING_FOR_PHOTO_ID', 'WAITING_FOR_PHOTO_ID_CONFIRMATION'
  ));
