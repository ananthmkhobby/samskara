-- Optional, narrowly-scoped field — used only to compute traditional
-- relationship terms (Father/Mother, Brother/Sister, Husband/Wife) for
-- documents like the Vamshavali (Parampara > Vamshavali). Never guessed,
-- never required, never shown anywhere else in the app — the deliberate
-- choice documented at FolioModal.jsx:246 (never guess Father/Mother)
-- still holds everywhere except this one feature, which genuinely can't
-- work without it. Nullable, no default, no backfill: every existing row
-- gets null and nothing that exists today reads this column.
alter table people add column gender text check (gender in ('male', 'female') or gender is null);
comment on column people.gender is 'Optional. Used only to compute traditional relationship terms (Father/Mother, Brother/Sister, Husband/Wife) for documents like the Vamshavali. Never guessed, never required, never shown elsewhere in the app.';
