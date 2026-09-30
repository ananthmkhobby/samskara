-- Generalizes the never-actually-used single geo_origin field into an
-- ordered list of stops a person passed through before their current city
-- (geo) — e.g. Mysore -> Bangalore -> Charlotte, US -> Toronto -> Bangalore
-- (current). geo itself is unchanged and stays the one place that's always
-- shown as a full person-pin; geo_stops is everything before it.
--
-- Purely additive: a new column, defaulted so every existing row gets an
-- empty array automatically. No existing person's map pin or behavior
-- changes — someone with no stops renders exactly as they do today.
alter table people add column geo_stops jsonb not null default '[]'::jsonb;

-- geo_origin was checked before adding this: real customer families have
-- never had it set (confirmed by querying production directly) — the only
-- rows that ever used it are the public demo family's sample data. Backfill
-- those losslessly into the new shape rather than lose them, and leave the
-- now-unused geo_origin column in place rather than drop it (nothing reads
-- it once journeyMapData.js is updated, but dropping a column is the one
-- part of this that isn't trivially reversible, and there's no benefit to
-- removing it today).
update people
set geo_stops = jsonb_build_array(
  jsonb_build_object(
    'place', geo_origin->>'place',
    'lat', (geo_origin->>'lat')::numeric,
    'lng', (geo_origin->>'lng')::numeric,
    'resolvedName', coalesce(geo_origin->>'label', geo_origin->>'place'),
    'year', geo_origin->>'year'
  )
)
where geo_origin is not null;
