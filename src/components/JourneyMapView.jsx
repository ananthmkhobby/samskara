import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import { PEOPLE } from "../data/people";
import { applyOverrides } from "../data/helpers";
import { computeMapMarkers, computeRoutes, computeOriginMarkers } from "../lib/journeyMapData";

const GEN_COLOR_STOPS = ["#5C1414", "#8A2222", "#7A5714", "#26381F", "#3D5A34"];
function genColor(gen, minGen, maxGen) {
  if (maxGen === minGen) return GEN_COLOR_STOPS[0];
  const t = (gen - minGen) / (maxGen - minGen);
  return GEN_COLOR_STOPS[Math.round(t * (GEN_COLOR_STOPS.length - 1))];
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points, { padding: [36, 36] });
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
  return <Polyline ref={ref} positions={positions} pathOptions={{ color: "#8A2222", weight: 2.5, opacity: 0.8 }} />;
}

export default function JourneyMapView({ overrides, onSelectPerson }) {
  const [genFilter, setGenFilter] = useState(null);
  const people = useMemo(() => PEOPLE.map((p) => applyOverrides(p, overrides)), [overrides]);
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
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds points={boundsPoints} />
          {routes.map((r) => <AnimatedRoute key={`${r.id}-${genFilter}`} positions={r.positions} />)}
          {origins.map((o, i) => (
            <CircleMarker key={i} center={[o.lat, o.lng]} radius={5} pathOptions={{ color: "#9C8058", weight: 1.5, fillColor: "#F8F0DA", fillOpacity: 1, dashArray: "2,2" }}>
              <Tooltip direction="top" offset={[0, -6]}>{o.place} (origin)</Tooltip>
            </CircleMarker>
          ))}
          {markers.map((m) => (
            <CircleMarker
              key={m.id} center={[m.lat, m.lng]} radius={9}
              pathOptions={{ color: "#fff", weight: 2, fillColor: genColor(m.gen, minGen, maxGen), fillOpacity: 1 }}
              eventHandlers={{ click: () => onSelectPerson(m.id) }}
            >
              <Tooltip direction="top" offset={[0, -10]}>{m.name}</Tooltip>
            </CircleMarker>
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
