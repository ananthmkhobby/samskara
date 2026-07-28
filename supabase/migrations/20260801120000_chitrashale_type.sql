-- Anubhava Chitrashale ("Gallery of Experiences"): a small illustrated room
-- belonging to one person, furnished by the family with objects that each
-- carry a memory (text, a relative's own recorded voice, ambient sound, a
-- silence-then-text reveal, or a mood shift). Reuses the `contributions`
-- table exactly like Parampara does — nothing else needs to FK-reference a
-- room object or a reflection by id, so no new tables are needed:
--   chitrashalaObject: person_id = room owner, field = fixed spot key,
--     title = object label, relation = contributor's relation ("her
--     daughter"), content = JSON {interactionType, iconKey, photoPath,
--     audioPath, memoryText, moodKey}.
--   chitrashalaReflection: the one-sentence exit-question answer,
--     person_id = target, content = the raw sentence (no JSON needed).
alter table contributions drop constraint if exists contributions_type_check;
alter table contributions add constraint contributions_type_check
  check (type in ('memory','audio','video','photo','document','date','edit','newPerson','interview','parampara','newBook','library_entry','chitrashalaObject','chitrashalaReflection'));
