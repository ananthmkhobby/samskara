-- Parampara: a family-level (not person-level) heritage section —
-- traditions, kula devata journey, veda lineage, family slokas, festival
-- customs across generations, family dharma/principles, ancestor wisdom,
-- lost skills, and living memories worth preserving.
--
-- Deliberately reuses the existing `contributions` table rather than a new
-- one: person_id is already nullable there (family-level entries just
-- leave it null), and it already carries the exact Pending -> Verified/
-- Rejected review-queue pipeline this needs — "contribute, then goes for
-- approval, then reflects in the app" is precisely what that pipeline
-- already does for every other content type in the app. `field` holds the
-- category (tradition/kula_devata/lineage/sloka/festival/dharma/wisdom/
-- lost_skill/memory), `title` the entry title, and `content` a small JSON
-- blob (description/sinceYear/mediaPath, or the lineage chain fields).
alter table contributions drop constraint if exists contributions_type_check;
alter table contributions add constraint contributions_type_check
  check (type in ('memory','audio','video','photo','document','date','edit','newPerson','interview','parampara'));
