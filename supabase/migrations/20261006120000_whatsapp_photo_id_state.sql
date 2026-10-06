-- Widens whatsapp_conversations.state for the new "ask the family to
-- identify this photo" flow — same CHECK-constraint-widening shape as
-- 20261003120000_whatsapp_family_switch_state.sql, which already caught a
-- real bug of exactly this kind (a write silently rejected because the
-- constraint didn't know the new state yet).
alter table whatsapp_conversations drop constraint whatsapp_conversations_state_check;
alter table whatsapp_conversations add constraint whatsapp_conversations_state_check
  check (state in (
    'IDLE', 'WAITING_FOR_PERSON', 'WAITING_FOR_PERSON_CONFIRMATION',
    'WAITING_FOR_STORY', 'WAITING_FOR_CONFIRMATION', 'COMPLETED',
    'WAITING_FOR_FAMILY_SWITCH', 'WAITING_FOR_PHOTO_ID', 'WAITING_FOR_PHOTO_ID_CONFIRMATION'
  ));
