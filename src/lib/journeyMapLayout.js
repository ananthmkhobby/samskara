function hash1(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rand01(seed) { return (hash1(seed) % 100000) / 100000; }
function jitter(id, range) { return (rand01(id) - 0.5) * range; }

const W = 900, H = 560, PAD = 60;

function project(lat, lng, bounds) {
  const x = PAD + (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng) * (W - PAD * 2);
  const y = PAD + (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat) * (H - PAD * 2);
  return { x, y };
}

function smoothSegment(pts) {
  let d = "";
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], cur = pts[i];
    const midX = ((prev.x + cur.x) / 2).toFixed(1), midY = ((prev.y + cur.y) / 2).toFixed(1);
    d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${midX} ${midY}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

const COAST_REF = [
  { lat: 20.4, lng: 72.95 }, { lat: 19.08, lng: 72.33 }, { lat: 16.99, lng: 72.81 },
  { lat: 15.49, lng: 73.38 }, { lat: 14.80, lng: 73.73 }, { lat: 13.1, lng: 74.35 },
  { lat: 12.5, lng: 74.69 }, { lat: 10.8, lng: 75.10 }
];

export function computeJourneyMap(people) {
  const points = [];
  people.forEach((p) => { if (p.geo) points.push(p.geo); if (p.geoOrigin) points.push(p.geoOrigin); });
  const lats = points.map((pt) => pt.lat), lngs = points.map((pt) => pt.lng);
  const bounds = {
    minLat: Math.min(...lats) - 1.1, maxLat: Math.max(...lats) + 1.1,
    minLng: Math.min(...lngs) - 1.4, maxLng: Math.max(...lngs) + 1.4
  };

  const coastPts = COAST_REF.map((c) => project(c.lat, c.lng, bounds));
  const coastSeg = smoothSegment(coastPts);
  const coastTop = coastPts[0], coastBottom = coastPts[coastPts.length - 1];
  const coastLine = `M ${coastTop.x.toFixed(1)} ${coastTop.y.toFixed(1)}${coastSeg}`;
  const seaFill = `M 0 ${(coastTop.y - 80).toFixed(1)} L ${coastTop.x.toFixed(1)} ${coastTop.y.toFixed(1)}${coastSeg} L 0 ${(coastBottom.y + 80).toFixed(1)} Z`;
  const waves = [];
  for (let i = 0; i < 7; i++) waves.push({ x: 18 + ((i * 37) % 70), y: 60 + i * 68 });

  const routes = [];
  const byPlace = {};
  const originPlaces = {};
  people.forEach((p) => {
    if (!p.geo) return;
    const key = p.geo.place;
    (byPlace[key] = byPlace[key] || { place: p.geo, people: [] }).people.push(p);
  });
  people.forEach((p) => { if (p.geoOrigin && !byPlace[p.geoOrigin.place]) originPlaces[p.geoOrigin.place] = p.geoOrigin; });
  people.forEach((p) => {
    if (p.geoOrigin) {
      const a = project(p.geoOrigin.lat, p.geoOrigin.lng, bounds);
      const b = project(p.geo.lat, p.geo.lng, bounds);
      const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2 - 26;
      routes.push({ d: `M ${a.x},${a.y} Q ${midX},${midY} ${b.x},${b.y}` });
    }
  });

  const originMarkers = Object.values(originPlaces).map((place) => project(place.lat, place.lng, bounds));

  const pins = [];
  Object.values(byPlace).forEach((group) => {
    const pt = project(group.place.lat, group.place.lng, bounds);
    const n = group.people.length;
    group.people.forEach((p, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2;
      const spread = n > 1 ? 13 : 0;
      const ox = pt.x + Math.cos(angle) * spread * (n > 1 ? 1 : 0);
      const oy = pt.y + Math.sin(angle) * spread * (n > 1 ? 1 : 0);
      pins.push({ id: p.id, name: p.name, gen: p.gen, x: ox, y: oy });
    });
  });

  const labelCandidates = [];
  Object.values(byPlace).forEach((group) => {
    const pt = project(group.place.lat, group.place.lng, bounds);
    labelCandidates.push({ name: group.place.place, pt, bold: true });
  });
  Object.values(originPlaces).forEach((place) => {
    const pt = project(place.lat, place.lng, bounds);
    labelCandidates.push({ name: place.place, pt, bold: false });
  });
  const labelClusters = [];
  labelCandidates.forEach((lc) => {
    let cluster = labelClusters.find((c) => Math.hypot(c.cx - lc.pt.x, c.cy - lc.pt.y) < 58);
    if (!cluster) { cluster = { cx: lc.pt.x, cy: lc.pt.y, items: [] }; labelClusters.push(cluster); }
    cluster.items.push(lc);
  });
  const labels = [];
  labelClusters.forEach((cluster) => {
    const items = [...cluster.items].sort((a, b) => (b.bold ? 1 : 0) - (a.bold ? 1 : 0));
    const baseY = cluster.cy - 30 - items.length * 13;
    items.forEach((item, i) => {
      labels.push({ x: cluster.cx, y: baseY + i * 13, name: item.name, bold: item.bold });
    });
  });

  return { W, H, coastLine, seaFill, waves, routes, originMarkers, pins, labels };
}

export { jitter };
