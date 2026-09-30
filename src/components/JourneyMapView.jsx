import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { PEOPLE } from "../data/people";
import { computeMapMarkers, computeRoutes, computeOriginMarkers } from "../lib/journeyMapData";
import { GEN_COLOR_STOPS, genColor, initialsOf } from "./PersonAvatar";

// A small circular portrait/initials marker — the same visual language as
// PersonAvatar everywhere else in the app (Tree, Search, Folio) — rather
// than Leaflet's plain dot, so a person on the map still reads as *that*
// person, not just a location. Built as a divIcon (raw HTML) since Leaflet
// markers render outside React's own tree.
function personDivIcon(m, minGen, maxGen) {
  const color = genColor(m.gen, minGen, maxGen);
  const deceased = m.died || m.diedUnknown;
  const inner = m.photoUrl
    ? `<img src="${m.photoUrl}" alt="" />`
    : `<span>${initialsOf(m.name)}</span>`;
  return L.divIcon({
    className: "journey-pin-wrap",
    html: `<div class="journey-pin${deceased ? " is-deceased" : ""}" style="--pin-color:${color}">${inner}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    tooltipAnchor: [0, -17],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    // Leaflet measures the container's pixel size the moment this runs —
    // on first mount that can be a stale/undersized read from before the
    // CSS height (min(66vh, 600px)) has actually settled, which makes
    // fitBounds compute a far lower zoom than the data warrants (the whole
    // map looks zoomed out to cover half of India instead of a tight crop
    // around the actual points). invalidateSize() forces a fresh
    // measurement immediately before the fit.
    map.invalidateSize();
    map.fitBounds(points, { padding: [44, 44] });
  }, [points, map]);
  return null;
}

function AnimatedRoute({ positions }) {
  const ref = useRef(null);
  useEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    const el = layer.getElement ? layer.getElement() : layer._path;
    if (!el || !el.getTotalLength) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const length = el.getTotalLength();
    el.style.transition = "none";
    el.style.strokeDasharray = `${length} ${length}`;
    el.style.strokeDashoffset = reduce ? "0" : `${length}`;
    if (!reduce) {
      el.getBoundingClientRect();
      el.style.transition = "stroke-dashoffset 1.6s ease-out";
      requestAnimationFrame(() => { el.style.strokeDashoffset = "0"; });
    }
  }, [positions]);
  return <Polyline ref={ref} positions={positions} pathOptions={{ color: "#8A4A2A", weight: 3, opacity: 0.75, lineCap: "round" }} />;
}

export default function JourneyMapView({ onSelectPerson }) {
  const [genFilter, setGenFilter] = useState(null);
  // A fresh array reference each render — PEOPLE is mutated in place after
  // edits, so the useMemo calls below (keyed on `people`) need a new
  // reference to notice anything changed.
  const people = [...PEOPLE];
  const gens = useMemo(() => Array.from(new Set(people.map((p) => p.gen))).sort((a, b) => a - b), [people]);
  const minGen = gens[0], maxGen = gens[gens.length - 1];
  const visiblePeople = useMemo(() => (genFilter === null ? people : people.filter((p) => p.gen === genFilter)), [people, genFilter]);
  const markers = useMemo(() => computeMapMarkers(visiblePeople), [visiblePeople]);
  const routes = useMemo(() => computeRoutes(visiblePeople), [visiblePeople]);
  const origins = useMemo(() => computeOriginMarkers(visiblePeople), [visiblePeople]);
  const boundsPoints = useMemo(() => [
    ...markers.map((m) => [m.lat, m.lng]),
    ...origins.map((o) => [o.lat, o.lng])
  ], [markers, origins]);

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>The family's journey</h2>
        <p>Where each generation was born, and where they settled — a real map of the coast the whole story sits on. Filter by generation to watch the family spread; tap a pin to open that person's folio.</p>
      </div>
      <div className="map-gen-filters">
        {gens.map((g) => (
          <button key={g} className={`chip${genFilter === g ? " active" : ""}`} onClick={() => setGenFilter(g)}>Gen {g}</button>
        ))}
        <button className={`chip${genFilter === null ? " active" : ""}`} onClick={() => setGenFilter(null)}>All generations</button>
      </div>
      <div className="map-canvas-wrap">
        <MapContainer center={[14.5, 75.2]} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          {/* Plain OpenStreetMap tiles (CARTO's free anonymous basemaps now
              require an API key — confirmed by fetching one directly, it
              returns a placeholder tile, not map data) — warmed and
              desaturated heavily below so the normally quite busy/colorful
              OSM style reads as a muted, parchment-toned backdrop instead
              of a generic web map dropped into a heritage archive. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={boundsPoints} />
          {routes.map((r) => <AnimatedRoute key={`${r.id}-${genFilter}`} positions={r.positions} />)}
          {origins.map((o, i) => (
            <CircleMarker key={i} center={[o.lat, o.lng]} radius={5} pathOptions={{ color: "#9C7A42", weight: 2, fillColor: "#F8F0DA", fillOpacity: 1, dashArray: "3,3" }}>
              <Tooltip direction="top" offset={[0, -6]} className="journey-tooltip">{o.place} · origin</Tooltip>
            </CircleMarker>
          ))}
          {markers.map((m) => (
            <Marker
              key={m.id} position={[m.lat, m.lng]} icon={personDivIcon(m, minGen, maxGen)}
              eventHandlers={{ click: () => onSelectPerson(m.id) }}
            >
              <Tooltip direction="top" className="journey-tooltip">{m.name}</Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="map-legend">
        <span><i className="map-legend-line" /> Migration route</span>
        <span><i className="map-legend-dot" style={{ background: GEN_COLOR_STOPS[0] }} /> Gen 1</span>
        <span><i className="map-legend-dot" style={{ background: GEN_COLOR_STOPS[1] }} /> Gen 2</span>
        <span><i className="map-legend-dot" style={{ background: GEN_COLOR_STOPS[2] }} /> Gen 3</span>
        <span><i className="map-legend-dot" style={{ background: GEN_COLOR_STOPS[3] }} /> Gen 4</span>
        <span><i className="map-legend-dot" style={{ background: GEN_COLOR_STOPS[4] }} /> Gen 5</span>
      </div>
    </section>
  );
}
