-- Sample Family Library data for the public demo family — four books
-- across different shelves, each with an ownership journey, some readers,
-- and at least one wisdom/memory/discussion entry, so the feature shows
-- real content out of the box. One book (Mankutimmana Kagga) deliberately
-- has its journey end with a now-deceased owner, demonstrating
-- Grandfather's Shelf.
do $$
declare
  v_gita bigint;
  v_panchatantra bigint;
  v_kagga bigint;
  v_niti bigint;
begin
  insert into family_books (family_id, title, category, story, contributor, status) values
  ('00000000-0000-0000-0000-000000000001', 'Bhagavad Gita', 'spiritual',
   'Kept on the family altar for three generations. Narasimha read a verse aloud every morning before opening the shop — the copy is worn soft at the edges from that alone.',
   'Ravindra Rao', 'Verified')
  returning id into v_gita;

  insert into family_books (family_id, title, category, story, contributor, status) values
  ('00000000-0000-0000-0000-000000000001', 'Panchatantra', 'childrens',
   'Every child in the family has heard these stories before they could read them. Kamala used to act out the fox and the crow at bedtime.',
   'Saraswathi Rao', 'Verified')
  returning id into v_panchatantra;

  insert into family_books (family_id, title, category, story, contributor, status) values
  ('00000000-0000-0000-0000-000000000001', 'Mankutimmana Kagga', 'philosophy',
   'Narasimha''s own copy, annotated in the margins in his handwriting. Nobody has fully deciphered all his notes yet.',
   'Ravindra Rao', 'Verified')
  returning id into v_kagga;

  insert into family_books (family_id, title, category, story, contributor, status) values
  ('00000000-0000-0000-0000-000000000001', 'Chanakya Niti', 'finance',
   'Krishnamurthy kept this behind the shop counter and quoted it to anyone who asked him for a loan.',
   'Anand Sharma', 'Verified')
  returning id into v_niti;

  insert into book_ownership (family_id, book_id, person_id, action, year, sort_order) values
  ('00000000-0000-0000-0000-000000000001', v_gita, 'narasimha', 'owned', 1925, 0),
  ('00000000-0000-0000-0000-000000000001', v_gita, 'krishnamurthy', 'gifted', 1958, 1),
  ('00000000-0000-0000-0000-000000000001', v_gita, 'ravindra', 'read', 1985, 2),
  ('00000000-0000-0000-0000-000000000001', v_gita, 'arjun', 'recommended', 2015, 3),

  ('00000000-0000-0000-0000-000000000001', v_panchatantra, 'kamala', 'owned', 1935, 0),
  ('00000000-0000-0000-0000-000000000001', v_panchatantra, 'saraswathi', 'gifted', 1960, 1),
  ('00000000-0000-0000-0000-000000000001', v_panchatantra, 'ananya', 'read', 2005, 2),
  ('00000000-0000-0000-0000-000000000001', v_panchatantra, 'ishaan', 'recommended', 2022, 3),

  ('00000000-0000-0000-0000-000000000001', v_kagga, 'narasimha', 'owned', 1940, 0),

  ('00000000-0000-0000-0000-000000000001', v_niti, 'krishnamurthy', 'owned', 1950, 0),
  ('00000000-0000-0000-0000-000000000001', v_niti, 'anand', 'gifted', 1990, 1);

  insert into book_readers (family_id, book_id, person_id, status) values
  ('00000000-0000-0000-0000-000000000001', v_panchatantra, 'ishaan', 'reading'),
  ('00000000-0000-0000-0000-000000000001', v_panchatantra, 'ananya', 'read'),
  ('00000000-0000-0000-0000-000000000001', v_niti, 'anand', 'read');

  insert into contributions (family_id, type, field, book_id, content, contributor, status, date) values
  ('00000000-0000-0000-0000-000000000001', 'library_entry', 'wisdom', v_gita, 'Duty comes before comfort — that''s the one line Krishnamurthy could recite from memory even in his last years.', 'Ravindra Rao', 'Verified', '2026-05-15'),
  ('00000000-0000-0000-0000-000000000001', 'library_entry', 'memory', v_gita, 'My father gifted this to me on the day I got my first salary. I still have the note he wrote on the first page.', 'Krishnamurthy Rao', 'Verified', '2026-05-16'),
  ('00000000-0000-0000-0000-000000000001', 'library_entry', 'discussion', v_gita, 'Why did you read a verse every morning before opening the shop?', 'Kavya Reddy', 'Verified', '2026-05-18'),
  ('00000000-0000-0000-0000-000000000001', 'library_entry', 'discussion', v_gita, 'It settled my mind before a full day of customers — some mornings that was the only quiet ten minutes I had.', 'Ravindra Rao', 'Verified', '2026-05-19'),
  ('00000000-0000-0000-0000-000000000001', 'library_entry', 'memory', v_panchatantra, 'We read this during the 2020 lockdown, one story a night, until Ishaan could finish the fox and the crow himself.', 'Rohan Reddy', 'Verified', '2026-06-02'),
  ('00000000-0000-0000-0000-000000000001', 'library_entry', 'discussion', v_kagga, 'Why did you love this book so much, Ajja?', 'Sunanda Rao', 'Verified', '2026-06-10'),
  ('00000000-0000-0000-0000-000000000001', 'library_entry', 'wisdom', v_niti, 'Never lend more than you can afford to lose, and never let a debt go unspoken between family.', 'Anand Sharma', 'Verified', '2026-06-20');
end $$;
