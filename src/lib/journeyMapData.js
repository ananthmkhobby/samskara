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
      markers.push({ id: p.id, name: p.name, gen: p.gen, lat: base.lat + Math.sin(angle) * r, lng: base.lng + Math.cos(angle) * r });
    });
  });
  return markers;
}

export function computeRoutes(people) {
  return people.filter((p) => p.geoOrigin).map((p) => ({
    id: p.id,
    label: `${p.name}: ${p.geoOrigin.place} → ${p.geo.place}`,
    positions: [[p.geoOrigin.lat, p.geoOrigin.lng], [p.geo.lat, p.geo.lng]]
  }));
}

export function computeOriginMarkers(people) {
  const seen = new Set();
  const markers = [];
  people.forEach((p) => {
    if (p.geoOrigin && !seen.has(p.geoOrigin.place)) {
      seen.add(p.geoOrigin.place);
      markers.push({ place: p.geoOrigin.place, lat: p.geoOrigin.lat, lng: p.geoOrigin.lng });
    }
  });
  return markers;
}
