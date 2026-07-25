-- "A Day in Their Life" — an optional structured field capturing what an
-- ordinary day looked like for this person (a year + a short list of
-- routine facts), shown on the Folio and edited through the same
-- propose-edit pipeline as every other field.
alter table people add column if not exists day_in_life jsonb;
