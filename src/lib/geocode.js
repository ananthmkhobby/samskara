// Turns a typed place name into real coordinates via OpenStreetMap's public
// Nominatim search API — no API key needed, same no-key philosophy as the
// OSM map tiles the Journey view already uses.
//
// Families' migration paths and current cities can be anywhere in the world
// (diaspora branches, multi-country journeys), so this is not restricted to
// any one country. Results are biased toward India first — most queries are
// still Indian place names — and if that comes up empty, retried worldwide;
// addressdetails=1 and limit=3 exist so a caller can show what was actually
// matched (see `candidates` below) and let the person confirm or pick a
// better one — a vague or misspelled neighborhood name can otherwise
// resolve to something far coarser (a whole city) with no visible sign
// that happened, which is what "the pin looks random" cases usually turn
// out to be.
async function searchNominatim(query, { countrycodes } = {}) {
  const params = new URLSearchParams({ format: "json", addressdetails: "1", limit: "3", q: query });
  if (countrycodes) params.set("countrycodes", countrycodes);
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  let res;
  try {
    res = await fetch(url, { headers: { "Accept-Language": "en" } });
  } catch {
    throw new Error("Couldn't reach the map lookup service — check your connection and try again.");
  }
  if (!res.ok) throw new Error("Couldn't look up that place — try again.");
  return res.json();
}

export async function geocodePlace(query) {
  let data = await searchNominatim(query, { countrycodes: "in" });
  if (!data.length) data = await searchNominatim(query);
  if (!data.length) throw new Error(`Couldn't find "${query}" on the map — try a different spelling or a nearby bigger city.`);
  const top = data[0];
  return {
    place: query,
    lat: parseFloat(top.lat),
    lng: parseFloat(top.lon),
    // What Nominatim actually matched, in its own words — shown back to the
    // person so a vague match is visible instead of silently accepted.
    resolvedName: top.display_name,
    candidates: data.map((d) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), resolvedName: d.display_name })),
  };
}
