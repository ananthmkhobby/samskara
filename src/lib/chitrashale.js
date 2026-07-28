// Anubhava Chitrashale ("Gallery of Experiences") — a small illustrated room
// belonging to one person, furnished by the family with objects that each
// carry a memory. Reuses the `contributions` table exactly like Parampara
// does (see src/lib/parampara.js) — nothing else needs to FK-reference a
// room object or a reflection by id, so there's no dedicated table:
//   chitrashalaObject: field = fixed spot key, title = object label,
//     relation = contributor's relation ("her daughter"), content = JSON
//     {interactionType, iconKey, photoPath, audioPath, memoryText, moodKey}.
//   chitrashalaReflection: the one-sentence exit-question answer,
//     content = the raw sentence (no JSON needed — it's genuinely one field).

// How a memory is delivered matters as much as its content — this typing is
// the heart of the room. `needsAudio` gates which types the authoring form
// lets a contributor pick: voiceNarrated/pureAmbientAudio only unlock once
// a clip has actually been recorded in that session, so the room can never
// end up with a tap that plays nothing.
export const INTERACTION_TYPES = [
  { key: "textOnly", label: "Text only", needsAudio: false, prompt: "A single written line appears when touched." },
  { key: "voiceNarrated", label: "A relative's voice", needsAudio: true, prompt: "Plays a real recorded voice when touched." },
  { key: "pureAmbientAudio", label: "Just a sound", needsAudio: true, prompt: "Plays a sound, no words, when touched." },
  { key: "silenceThenText", label: "Silence, then words", needsAudio: false, prompt: "Nothing for a few seconds, then one line fades in." },
  { key: "ambientShift", label: "Changes the room", needsAudio: false, prompt: "Shifts the whole room's mood, then reveals a memory." },
];

export function interactionTypeFor(key) {
  return INTERACTION_TYPES.find((t) => t.key === key) || INTERACTION_TYPES[0];
}

// Fixed, not freeform — the room stays visually composed no matter which
// relative adds what, in what order. Position is a % coordinate within the
// room scene, used for absolute placement of each spot's hotspot.
export const ROOM_SPOTS = [
  { key: "window", label: "By the window", x: 18, y: 30 },
  { key: "door", label: "Near the door", x: 82, y: 34 },
  { key: "lowTable", label: "On the low table", x: 50, y: 62 },
  { key: "pujaCorner", label: "The puja corner", x: 20, y: 68 },
  { key: "shelf", label: "On the shelf", x: 80, y: 66 },
  { key: "floor", label: "On the floor", x: 50, y: 86 },
];

export function spotFor(key) {
  return ROOM_SPOTS.find((s) => s.key === key) || null;
}

// Used when a contributor has no real photo of the object — a small custom
// icon set in the same gold/maroon gradient style as the diya/book icons
// already built for Parampara/Library (see ChitrashaleIcons.jsx). "lamp"
// and "book" reuse DiyaIcon/OpenBookIcon directly rather than rebuilding
// them.
export const ICON_KEYS = ["lamp", "tumbler", "flowers", "beads", "slippers", "pot", "book", "rain", "chair"];

// Only relevant to the "ambientShift" interaction type — a small, fixed set
// so the room's mood-shift CSS only ever has to handle known values.
export const MOOD_KEYS = [
  { key: "rain", label: "Rain" },
  { key: "dusk", label: "Evening dusk" },
  { key: "festival", label: "Festival lights" },
];

export function parseChitrashaleContent(content) {
  try {
    return JSON.parse(content) || {};
  } catch {
    return {};
  }
}

// One Verified object per spot, keyed by spot — an occupancy map the room
// and the authoring form's spot picker both read from. `contributions` is
// already fully hydrated client-side at boot, so this is a plain filter,
// same technique as contributionsFor/verifiedMediaFor in data/helpers.js.
export function verifiedObjectsBySpot(contributions, personId) {
  const map = {};
  contributions
    .filter((c) => c.type === "chitrashalaObject" && c.personId === personId && c.status === "Verified")
    .forEach((c) => { map[c.field] = c; });
  return map;
}

export function hasAnyRoomObjects(contributions, personId) {
  return contributions.some((c) => c.type === "chitrashalaObject" && c.personId === personId && c.status === "Verified");
}
