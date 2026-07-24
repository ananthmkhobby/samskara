-- Seeds the public demo tenant (fixed id below) with the app's original
-- "Rao family" sample data, now as real rows instead of hardcoded JS
-- constants — so the demo behaves exactly like any other family (fetched
-- from the DB, fully open to edit per the RLS policies above) rather than
-- being a special-cased static fallback.
insert into families (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'The Rao Family (Demo)');

insert into people (family_id, id, name, gen, born, died, spouse, parents, rashi, gotra, is_legacy, trust, geo_origin, geo, summary, places, life_lesson, chapters, timeline) values
('00000000-0000-0000-0000-000000000001', 'narasimha', 'Narasimha Rao', 1, '1902-03-11', '1978-09-02', 'kamala', '{}', 'Simha', 'Bharadwaja', true, 'verified',
  '{"lat":13.63,"lng":74.69,"place":"Kundapura","year":1902,"label":"Born in Kundapura"}',
  '{"lat":12.91,"lng":74.86,"place":"Mangalore"}',
  'Founder of the family household in Mangalore. Left his native village at nineteen with a trunk of clothes and a head for numbers, and built the provisions business that carried three generations.',
  array['Born in Kundapura','Settled in Mangalore, 1934','Built the family house on Car Street, 1955'],
  '{"quote":"A family that shares its table never goes hungry alone.","values":["Hospitality","Seva"]}',
  '[{"title":"Village Beginnings","text":"Narasimha was born in 1902 in a small house near the Kundapura river, the third of five children. His father kept a modest areca farm, and money was tight enough that school was a privilege shared between brothers on alternating years. What Narasimha lacked in formal schooling he made up for with an unusual memory for numbers — by twelve he was keeping the farm''s accounts in his head, correcting his father''s ledger from memory alone.\n\nAt nineteen, with the farm unable to support five grown sons, he packed a single trunk and left for the coast, telling his mother he would either send for the family within five years or return with nothing to show for it."},{"title":"The Move to Mangalore","text":"He arrived in Mangalore in 1922 with eleven rupees and a letter of introduction to a distant cousin who ran a small trading counter near the port. For the first two years he slept in the back room of that shop, doing the accounts by night and learning the trade by day.\n\nIt was here, through a marriage arranged by that same cousin, that he met Kamala. They were married in June 1922 in her family''s village, and she returned with him to Mangalore within the year — by every family account, the more decisive and quicker-witted of the two."},{"title":"Building the Family Business","text":"In 1941, with savings from nearly two decades of careful bookkeeping, Narasimha opened his own provisions store on what is now Car Street. He ran it on a simple principle, repeated so often it became a kind of family motto: never let a regular customer leave without credit if they need it, and never let a stranger leave without a fair price.\n\nThe store grew steadily through the 1940s and 50s, eventually employing two of his own sons and, at its peak, six people outside the family. It stayed in family hands until 1988."},{"title":"Later Years and Legacy","text":"By the 1960s Narasimha had largely handed the day-to-day running of the store to his son Krishnamurthy, though he continued to walk down each morning to check the accounts until his eyesight made the ledgers difficult to read. He and Kamala spent their later years in the Car Street house, which for decades functioned as the unofficial gathering point for the wider family on festival days.\n\nHe passed away in September 1978. The store''s regulars, by family legend, closed their own shops for an hour on the day of his funeral."}]',
  '[{"year":"1902","event":"Born in Kundapura"},{"year":"1921","event":"Leaves for Mangalore"},{"year":"1922","event":"Marries Kamala"},{"year":"1934","event":"Settles permanently in Mangalore"},{"year":"1941","event":"Opens the family provisions store"},{"year":"1955","event":"Builds the Car Street house"},{"year":"1978","event":"Passes away"}]'
),
('00000000-0000-0000-0000-000000000001', 'kamala', 'Kamala Rao', 1, '1908-06-02', '1990-03-19', 'narasimha', '{}', 'Kataka', 'Kaundinya', false, 'elder',
  '{"lat":13.75,"lng":74.70,"place":"Kota","year":1908,"label":"Born near Kota"}',
  '{"lat":12.91,"lng":74.86,"place":"Mangalore"}',
  'Narasimha''s wife and, by every account, the sharper negotiator of the two. Ran the household finances and was known across the neighbourhood for an open kitchen.',
  array['Born near Kota','Married into the Rao household, 1922'],
  '{"quote":"Fear is just a guest who overstays if you let him sit.","values":["Courage"]}',
  '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'krishnamurthy', 'Krishnamurthy Rao', 2, '1928-01-15', '2005-07-30', 'saraswathi', array['narasimha','kamala'], 'Simha', 'Bharadwaja', false, 'verified',
  null, '{"lat":12.91,"lng":74.86,"place":"Mangalore"}',
  'Took over the family store in the 1960s and expanded it to a second location. Insisted every child in the family, girls included, finish school before joining the business.',
  array['Born in Mangalore'],
  '{"quote":"Teach the child to read before you teach him to earn.","values":["Education"]}',
  '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'saraswathi', 'Saraswathi Rao', 2, '1932-09-08', '2010-04-11', 'krishnamurthy', '{}', null, null, false, 'elder',
  null, '{"lat":12.91,"lng":74.86,"place":"Mangalore"}',
  'Ran a tight household on a strict schedule that her grandchildren still joke about. Taught herself tailoring and stitched most of the family''s festival clothes into her seventies.',
  null,
  '{"quote":"Discipline is love with a schedule.","values":["Discipline"]}',
  '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'padmavathi', 'Padmavathi Sharma', 2, '1931-04-27', '2015-08-05', 'venkat', array['narasimha','kamala'], null, null, false, 'approx',
  '{"lat":12.91,"lng":74.86,"place":"Mangalore","year":1931,"label":"Born in Mangalore"}',
  '{"lat":13.34,"lng":74.74,"place":"Udupi"}',
  'Married into the Sharma family in 1953. Known for keeping an unusually simple home by choice, even after the family could afford otherwise.',
  null,
  '{"quote":"Keep the house simple; keep the heart generous.","values":["Simplicity","Hospitality"]}',
  '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'venkat', 'Venkat Sharma', 2, '1927-12-03', '1998-10-22', 'padmavathi', '{}', null, null, false, 'approx',
  null, '{"lat":13.34,"lng":74.74,"place":"Udupi"}',
  'A schoolteacher for thirty-one years in Udupi. Exact postings and dates are remembered approximately by the family.',
  null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'gopalakrishna', 'Gopalakrishna Rao', 2, '1935-02-18', '2020-12-01', null, array['narasimha','kamala'], null, null, false, 'approx',
  null, '{"lat":12.91,"lng":74.86,"place":"Mangalore"}',
  '', null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'ravindra', 'Ravindra Rao', 3, '1955-05-30', null, 'sunanda', array['krishnamurthy','saraswathi'], null, null, false, 'verified',
  null, '{"lat":12.91,"lng":74.86,"place":"Mangalore"}',
  'Expanded the family store into two more locations before selling the business in 2001 to focus on the family''s small trust for education grants.',
  null,
  '{"quote":"Every setback is a lesson wearing a disguise.","values":["Resilience"]}',
  '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'sunanda', 'Sunanda Rao', 3, '1958-11-14', null, 'ravindra', '{}', null, null, false, 'elder',
  null, '{"lat":12.91,"lng":74.86,"place":"Mangalore"}',
  'Trained as a schoolteacher and taught at the same school as her father-in-law''s old friend for eighteen years.',
  null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'lakshmi', 'Lakshmi Kumar', 3, '1958-08-21', null, 'suresh', array['krishnamurthy','saraswathi'], null, null, false, 'verified',
  '{"lat":12.91,"lng":74.86,"place":"Mangalore","year":1958,"label":"Born in Mangalore"}',
  '{"lat":12.97,"lng":77.59,"place":"Bangalore","year":1985,"label":"Moved to Bangalore"}',
  'Moved to Bangalore in 1985 and started the family''s tradition of a shared lamp-lighting call every Friday evening, wherever everyone happens to be.',
  null,
  '{"quote":"Light the lamp before you ask why it''s dark.","values":["Devotion"]}',
  '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'suresh', 'Suresh Kumar', 3, '1955-03-09', null, 'lakshmi', '{}', null, null, false, 'approx',
  '{"lat":12.91,"lng":74.86,"place":"Mangalore","year":1955,"label":"Born in Mangalore"}',
  '{"lat":12.97,"lng":77.59,"place":"Bangalore","year":1985,"label":"Moved to Bangalore with Lakshmi"}',
  'Worked in the state electricity board for over three decades.',
  null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'anand', 'Anand Sharma', 3, '1960-07-19', null, 'meera', array['padmavathi','venkat'], null, null, false, 'verified',
  null, '{"lat":13.34,"lng":74.74,"place":"Udupi"}',
  'Kept his father''s old teaching notebooks and, decades later, donated a set of them to a village school archive near Udupi.',
  null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'meera', 'Meera Sharma', 3, '1963-02-02', null, 'anand', '{}', null, null, false, 'elder',
  null, '{"lat":13.34,"lng":74.74,"place":"Udupi"}',
  'Ran a small tailoring business from home for over twenty years.',
  null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'deepa', 'Deepa Sharma', 3, '1963-10-11', null, null, array['padmavathi','venkat'], null, null, false, 'approx',
  null, '{"lat":13.34,"lng":74.74,"place":"Udupi"}',
  '', null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'arjun', 'Arjun Rao', 4, '1985-09-23', null, null, array['ravindra','sunanda'], null, null, false, 'verified',
  '{"lat":12.91,"lng":74.86,"place":"Mangalore","year":1985,"label":"Born in Mangalore"}',
  '{"lat":12.97,"lng":77.59,"place":"Bangalore","year":2008,"label":"Moved to Bangalore for work"}',
  'Software engineer in Bangalore. Started this archive project after realising he couldn''t remember his great-grandmother Kamala''s voice.',
  null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'kavya', 'Kavya Reddy', 4, '1988-12-05', null, 'rohan', array['ravindra','sunanda'], null, null, false, 'verified',
  '{"lat":12.91,"lng":74.86,"place":"Mangalore","year":1988,"label":"Born in Mangalore"}',
  '{"lat":19.08,"lng":72.88,"place":"Mumbai","year":2013,"label":"Married Rohan, moved to Mumbai"}',
  'Paediatrician. Keeps the most complete written record of family birthdays of anyone alive.',
  null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'rohan', 'Rohan Reddy', 4, '1986-06-17', null, 'kavya', '{}', null, null, false, 'approx',
  null, '{"lat":19.08,"lng":72.88,"place":"Mumbai"}',
  'Joined the family in 2013. Still learning everyone''s names at gatherings.',
  null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'nikhil', 'Nikhil Kumar', 4, '1990-04-08', null, null, array['lakshmi','suresh'], null, null, false, 'verified',
  null, '{"lat":12.97,"lng":77.59,"place":"Bangalore"}',
  'Started the Friday lamp-lighting video call his mother now leads every week.',
  null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'ananya', 'Ananya Sharma', 4, '1992-01-30', null, null, array['anand','meera'], null, null, false, 'approx',
  null, '{"lat":13.34,"lng":74.74,"place":"Udupi"}',
  '', null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'ishaan', 'Ishaan Reddy', 5, '2015-08-14', null, null, array['kavya','rohan'], null, null, false, 'approx',
  null, '{"lat":19.08,"lng":72.88,"place":"Mumbai"}',
  '', null, null, '[]', '[]'
),
('00000000-0000-0000-0000-000000000001', 'meher', 'Meher Reddy', 5, '2018-03-27', null, null, array['kavya','rohan'], null, null, false, 'approx',
  null, '{"lat":19.08,"lng":72.88,"place":"Mumbai"}',
  '', null, null, '[]', '[]'
);

insert into marriages (family_id, a, b, date) values
('00000000-0000-0000-0000-000000000001', 'narasimha', 'kamala', '1922-06-14'),
('00000000-0000-0000-0000-000000000001', 'krishnamurthy', 'saraswathi', '1954-02-10'),
('00000000-0000-0000-0000-000000000001', 'padmavathi', 'venkat', '1953-11-25'),
('00000000-0000-0000-0000-000000000001', 'ravindra', 'sunanda', '1982-05-03'),
('00000000-0000-0000-0000-000000000001', 'lakshmi', 'suresh', '1985-12-09'),
('00000000-0000-0000-0000-000000000001', 'anand', 'meera', '1988-01-20'),
('00000000-0000-0000-0000-000000000001', 'kavya', 'rohan', '2013-11-16');

insert into contributions (family_id, person_id, new_person_name, type, contributor, content, status, date) values
('00000000-0000-0000-0000-000000000001', 'narasimha', null, 'audio', 'Ravindra Rao', 'A recording of Narasimha telling the story of his first week in Mangalore, taped on a cassette in 1976.', 'Verified', '2026-04-02'),
('00000000-0000-0000-0000-000000000001', 'krishnamurthy', null, 'document', 'Anand Sharma', 'land-deed-1941-scan.pdf', 'Verified', '2026-05-11'),
('00000000-0000-0000-0000-000000000001', 'lakshmi', null, 'memory', 'Nikhil Kumar', 'Amma never missed a Friday lamp-lighting call even when she was in the hospital in 2019 — she asked the nurse to prop up her phone.', 'Verified', '2026-06-01'),
('00000000-0000-0000-0000-000000000001', 'arjun', null, 'memory', 'Kavya Reddy', 'Arjun taught me to ride a bicycle on the terrace because he refused to let me be scared of the road below.', 'Pending', '2026-07-10'),
('00000000-0000-0000-0000-000000000001', 'ishaan', null, 'photo', 'Rohan Reddy', 'ishaan-first-steps.jpg', 'Pending', '2026-07-14'),
('00000000-0000-0000-0000-000000000001', 'nikhil', null, 'date', 'Lakshmi Kumar', '2026-08-20 — Nikhil''s convocation', 'Pending', '2026-07-15'),
('00000000-0000-0000-0000-000000000001', null, 'Saroja (Narasimha''s youngest sister)', 'memory', 'Meera Sharma', 'Saroja walked twelve kilometres to attend Narasimha''s wedding because there was no room left in the family cart.', 'Pending', '2026-07-16'),
('00000000-0000-0000-0000-000000000001', 'deepa', null, 'video', 'Ananya Sharma', 'Duplicate upload of Deepa''s 60th birthday clip — already added under a different date.', 'Rejected', '2026-06-20'),
('00000000-0000-0000-0000-000000000001', 'ananya', null, 'memory', 'Anand Sharma', 'Ananya organised the whole family''s vaccination records into one spreadsheet during the 2021 outbreak without anyone asking her to.', 'Pending', '2026-07-17'),
('00000000-0000-0000-0000-000000000001', 'venkat', null, 'edit', 'Anand Sharma', 'A schoolteacher for thirty-one years in Udupi, known for walking the last mile to school barefoot so his one pair of shoes would last the monsoon.', 'Pending', '2026-07-18');

update contributions set field = 'summary', field_label = 'Summary'
where family_id = '00000000-0000-0000-0000-000000000001' and person_id = 'venkat' and type = 'edit';

-- "Their Experience" grid entries — one row per illustrative card, matching
-- the original hardcoded SAMPLE_PEOPLE .experience arrays.
insert into experience_entries (family_id, person_id, type, caption) values
('00000000-0000-0000-0000-000000000001', 'narasimha', 'voice', 'Recounting his first week in Mangalore, recorded in 1976'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'laugh', 'A short laugh caught on tape mid-story about his first customer'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'song', 'Humming "Vaishnava Jana To" while closing the shop for the night'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'prayer', 'The evening shloka he recited at the shop''s threshold before locking up'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'story', 'How he decided never to refuse credit to a regular customer'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'advice', 'Keep your ledger honest even when no one is checking it.'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'recipe', 'His mother''s rava kesari, made every Sankranti without fail'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'handwriting', 'A page from his 1941 account ledger, in his own hand'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'signature', 'His signature on the store''s original 1941 lease'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'achievement', 'Built a two-generation family business from eleven rupees'),
('00000000-0000-0000-0000-000000000001', 'narasimha', 'lesson', 'Trusted a partner once without a written agreement and lost six months'' profit — never skipped paperwork again'),
('00000000-0000-0000-0000-000000000001', 'kamala', 'voice', 'Describing the day she met Narasimha, recorded in 1988'),
('00000000-0000-0000-0000-000000000001', 'kamala', 'laugh', 'Laughing at her own memory of over-salting her first meal for him'),
('00000000-0000-0000-0000-000000000001', 'kamala', 'advice', 'Fear is just a guest who overstays if you let him sit — don''t offer it a chair.'),
('00000000-0000-0000-0000-000000000001', 'kamala', 'recipe', 'Her filter coffee recipe, still the family standard'),
('00000000-0000-0000-0000-000000000001', 'kamala', 'prayer', 'The morning prayer she taught every daughter-in-law in the house'),
('00000000-0000-0000-0000-000000000001', 'kamala', 'achievement', 'Ran the household finances so carefully the store never once missed a supplier payment'),
('00000000-0000-0000-0000-000000000001', 'kamala', 'lesson', 'Assumed a new bride would ''just know'' the house''s routines — learned to write things down after that'),
('00000000-0000-0000-0000-000000000001', 'krishnamurthy', 'voice', 'Explaining why he insisted every child finish school before joining the business'),
('00000000-0000-0000-0000-000000000001', 'krishnamurthy', 'advice', 'Teach the child to read before you teach him to earn.'),
('00000000-0000-0000-0000-000000000001', 'krishnamurthy', 'achievement', 'Expanded the family store to a second location'),
('00000000-0000-0000-0000-000000000001', 'ravindra', 'advice', 'Every setback is a lesson wearing a disguise.'),
('00000000-0000-0000-0000-000000000001', 'ravindra', 'achievement', 'Grew the family store into three locations before stepping back to fund education grants'),
('00000000-0000-0000-0000-000000000001', 'lakshmi', 'song', 'The Friday evening bhajan she still leads on the family video call'),
('00000000-0000-0000-0000-000000000001', 'lakshmi', 'advice', 'Light the lamp before you ask why it''s dark.'),
('00000000-0000-0000-0000-000000000001', 'lakshmi', 'story', 'Why she started the Friday lamp-lighting call after moving to Bangalore');
