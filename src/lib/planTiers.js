// The single source of truth for subscription-tier numbers — the Plans
// page, the SuperAdmin plan-management UI, and (once Phase 2's enforcement
// exists) the server-side limit checks all read from this one file, so a
// price or limit change is a one-file edit. Plain data + pure functions
// only, deliberately — no React/browser APIs — so this is importable from
// both src/ components and api/*.js serverless functions via a relative
// path, the same way api/_memberAuth.js etc. are already shared.
//
// Numbers are from the Oct 2026 internal pricing docs (us-internal.pdf /
// india-internal.pdf) — identical limits across markets, only currency
// differs. Phase 2 (hard enforcement) is explicitly not built yet; this
// file exists today purely for display (Plans page) and admin control
// (SuperAdminView).
export const PLAN_TIERS = {
  starter: {
    label: "Starter",
    tagline: "Free forever",
    price: { usd: 0, inr: 0 },
    period: null,
    limits: {
      people: 25, photos: 100, recordings: 3, videos: 1,
      aiCallsPerMonth: 0, pdfExport: false, printedBook: false,
    },
    modules: { treasury: false, journey: false, japa: false, aiFeatures: false, fastOnboarding: false },
  },
  rooted: {
    label: "Rooted",
    tagline: "For a family actively building their archive",
    price: { usd: 49, inr: 1499 },
    period: "year",
    limits: {
      people: null, photos: 5000, recordings: 100, videos: 10,
      aiCallsPerMonth: 20, pdfExport: true, printedBook: false,
    },
    modules: { treasury: true, journey: true, japa: true, aiFeatures: true, fastOnboarding: false },
  },
  legacy: {
    label: "Legacy",
    tagline: "Includes one printed book a year",
    price: { usd: 149, inr: 4999 },
    period: "year",
    limits: {
      people: null, photos: 20000, recordings: null, videos: 50,
      aiCallsPerMonth: 75, pdfExport: true, printedBook: true,
    },
    modules: { treasury: true, journey: true, japa: true, aiFeatures: true, fastOnboarding: false },
  },
};

export const PLAN_ORDER = ["starter", "rooted", "legacy"];

// Human labels for each limit key, shared by the Plans page and the
// SuperAdmin override form so they never drift apart.
export const LIMIT_LABELS = {
  people: "People in tree",
  photos: "Photos",
  recordings: "Voice recordings",
  videos: "Videos",
  aiCallsPerMonth: "AI calls / month",
};

export function formatLimit(value) {
  return value === null || value === undefined ? "Unlimited" : value.toLocaleString();
}

// Per-family overrides win over the tier default for any key explicitly
// set — {} (the column default) means "use every tier default as-is."
export function getEffectiveLimits(family) {
  const base = PLAN_TIERS[family?.plan_tier || "starter"].limits;
  return { ...base, ...(family?.plan_limit_overrides || {}) };
}

// module_flags already means "an explicit false disables it, regardless of
// anything else" (see families.module_flags' own migration comment) — the
// tier just supplies the STARTING defaults for modules not already
// explicitly flagged.
export function getEffectiveModules(family) {
  const tierDefaults = PLAN_TIERS[family?.plan_tier || "starter"].modules;
  const disabledByTier = Object.fromEntries(
    Object.entries(tierDefaults).filter(([, on]) => !on).map(([k]) => [k, false])
  );
  return { ...disabledByTier, ...(family?.module_flags || {}) };
}

// The cheapest tier whose own default unlocks a given module or boolean
// limit (e.g. "treasury", "pdfExport") — used to name a specific upgrade
// target in gated UI ("upgrade to Rooted") instead of a vague "ask an
// admin." Returns null if no tier's default unlocks it (shouldn't happen
// for any key actually used this way today, but a family-specific
// module_flags/plan_limit_overrides block isn't a tier problem at all —
// callers should prefer that explanation when they can tell the two apart).
export function minimumTierForFlag(key, inModules) {
  for (const tier of PLAN_ORDER) {
    const source = inModules ? PLAN_TIERS[tier].modules : PLAN_TIERS[tier].limits;
    if (source[key]) return tier;
  }
  return null;
}

// For a numeric limit (people/photos/recordings/videos/aiCallsPerMonth),
// there's no single tier that's always "enough" — it depends how far over
// the family is. The honest, simple recommendation is just the next tier
// up from whatever they're on now. Returns null if already on the top tier.
export function nextTier(currentTier) {
  const idx = PLAN_ORDER.indexOf(currentTier || "starter");
  return idx >= 0 && idx < PLAN_ORDER.length - 1 ? PLAN_ORDER[idx + 1] : null;
}

// The Postgres plan-limit triggers (enforce_people_limit/enforce_media_limit,
// supabase/migrations/20261017120000_plan_enforcement.sql) always raise a
// message starting with this exact phrase. Callers that wrap that message in
// their own text (e.g. api/_whatsappMedia.js's storeMedia prefixing it with
// "Couldn't save that attachment: ") can use this to pull the real,
// human-readable reason back out and show it instead of a generic failure —
// the same thing the web app already gets for free by just displaying
// err.message as-is.
const PLAN_LIMIT_MARKER = "This family's plan allows up to";

export function extractPlanLimitMessage(rawMessage) {
  const message = String(rawMessage || "");
  const idx = message.indexOf(PLAN_LIMIT_MARKER);
  return idx === -1 ? null : message.slice(idx);
}
