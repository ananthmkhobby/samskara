// Turns a typed place name into real coordinates via OpenStreetMap's public
// Nominatim search API — no API key needed, same no-key philosophy as the
// OSM map tiles the Journey view already uses.
export async function geocodePlace(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  let res;
  try {
    res = await fetch(url, { headers: { "Accept-Language": "en" } });
  } catch {
    throw new Error("Couldn't reach the map lookup service — check your connection and try again.");
  }
  if (!res.ok) throw new Error("Couldn't look up that place — try again.");
  const data = await res.json();
  if (!data.length) throw new Error(`Couldn't find "${query}" on the map — try a different spelling or a nearby bigger city.`);
  return { place: query, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}
