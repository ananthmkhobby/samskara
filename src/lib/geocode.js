// Turns a typed place name into real coordinates via OpenStreetMap's public
// Nominatim search API — no API key needed, same no-key philosophy as the
// OSM map tiles the Journey view already uses.
//
// countrycodes=in biases ambiguous short queries toward India rather than a
// same-named place abroad; addressdetails=1 and limit=3 exist so a caller
// can show what was actually matched (see `candidates` below) and let the
// person confirm or pick a better one — a vague or misspelled neighborhood
// name can otherwise resolve to something far coarser (a whole city) with
// no visible sign that happened, which is what "the pin looks random" cases
// usually turn out to be. Tested directly against Nominatim: an exact,
// specific query like "Kathriguppe, Bangalore" already resolves correctly
// today without any of this — this is about catching the vaguer inputs.
export async function geocodePlace(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=3&countrycodes=in&q=${encodeURIComponent(query)}`;
  let res;
  try {
    res = await fetch(url, { headers: { "Accept-Language": "en" } });
  } catch {
    throw new Error("Couldn't reach the map lookup service — check your connection and try again.");
  }
  if (!res.ok) throw new Error("Couldn't look up that place — try again.");
  const data = await res.json();
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
