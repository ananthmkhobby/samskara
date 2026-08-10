// The version of the Privacy Policy and Terms currently in force.
//
// Bump this whenever either document changes materially. Everyone who
// accepted an older version is then asked once more at their next visit
// (see the consent gate in App.jsx), and their earlier acceptance stays on
// record in user_consents rather than being overwritten — which is the whole
// point of versioning it instead of storing a boolean.
//
// Cosmetic edits (a typo, a reworded sentence that changes nothing about what
// we do with someone's data) should NOT bump this — asking a family to
// re-consent for a comma trains them to click through without reading, which
// is precisely what invalidates consent.
export const POLICY_VERSION = "2026-08-10";

// Shown to the person so the thing they're agreeing to is identifiable, not
// just an opaque version string.
export const POLICY_VERSION_LABEL = "10 August 2026";
