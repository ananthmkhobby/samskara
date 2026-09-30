export function computeMapMarkers(people) {
  const byPlace = {};
  people.forEach((p) => {
    if (!p.geo) return;
    (byPlace[p.geo.place] = byPlace[p.geo.place] || []).push(p);
  });
  const markers = [];
  Object.values(byPlace).forEach((group) => {
    const base = group[0].geo;
    const n = group.length;
    group.forEach((p, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2;
      const r = n > 1 ? 0.05 : 0;
      markers.push({
        id: p.id, name: p.name, gen: p.gen, photoUrl: p.photoUrl, died: p.died, diedUnknown: p.diedUnknown,
        lat: base.lat + Math.sin(angle) * r, lng: base.lng + Math.cos(angle) * r,
      });
    });
  });
  return markers;
}

// A person's full path before their current city — geo_stops in the order
// they were added (Mysore -> Bangalore -> Charlotte, US -> Toronto, say),
// falling back to the older single geoOrigin for any row that predates
// geo_stops existing (defensive only: production data was checked before
// this shipped, and every real row already came through the migration's
// own backfill — this just means a future direct DB write can't silently
// go unrendered).
function stopsOf(p) {
  if (p.geoStops && p.geoStops.length) return p.geoStops;
  return p.geoOrigin ? [p.geoOrigin] : [];
}

export function computeRoutes(people) {
  return people.filter((p) => p.geo && stopsOf(p).length).map((p) => {
    const stops = stopsOf(p);
    const path = [...stops, p.geo];
    return {
      id: p.id,
      label: `${p.name}: ${path.map((s) => s.place).join(" → ")}`,
      positions: path.map((s) => [s.lat, s.lng]),
    };
  });
}

export function computeOriginMarkers(people) {
  const seen = new Set();
  const markers = [];
  people.forEach((p) => {
    stopsOf(p).forEach((s) => {
      if (!seen.has(s.place)) {
        seen.add(s.place);
        markers.push({ place: s.place, lat: s.lat, lng: s.lng });
      }
    });
  });
  return markers;
}
