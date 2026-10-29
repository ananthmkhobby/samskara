// Auth/tenancy state resolved once, at boot, before the app's first render
// (see initDataLayer in data/people.js and main.jsx) — same "mutable module
// bindings, hydrated pre-render" pattern the rest of the data layer already
// uses, so every component that reads these gets a stable value with zero
// reactivity plumbing needed.
export const DEMO_FAMILY_ID = "00000000-0000-0000-0000-000000000001";

export let CURRENT_USER_ID = null;
export let CURRENT_FAMILY_ID = DEMO_FAMILY_ID;
export let CURRENT_FAMILY_NAME = null;
// A short saying/motto a family sets for themselves — null until a Head/
// Admin adds one. Shown under the family name on Home.
export let CURRENT_FAMILY_TAGLINE = null;
// The family's uploaded emblem, resolved to a real signed URL the same way
// a person's photoPath is — null until one's uploaded.
export let CURRENT_FAMILY_LOGO_URL = null;
export let CURRENT_ROLE = null; // 'head' | 'admin' | 'member' | null (null in demo mode)
export let IS_DEMO = true;
// Per-family monetization entitlements (see families.module_flags) — an
// empty object means every module is enabled; a key is only ever set to
// `false` to disable something, never used as an allow-list. Configured
// once at onboarding via /superadmin, not self-serve.
export let MODULE_FLAGS = {};
// The family's subscription tier and any per-family overrides (see
// families.plan_tier/plan_limit_overrides and src/lib/planTiers.js's
// getEffectiveLimits/getEffectiveModules) — "starter" until a Head/Admin
// upgrades via SuperAdmin or requests a change from the Plans page. Demo
// mode gets Legacy's effective shape via IS_DEMO checks elsewhere, not by
// faking a tier here.
export let CURRENT_FAMILY_PLAN_TIER = "starter";
export let CURRENT_FAMILY_PLAN_LIMIT_OVERRIDES = {};
// Every family the logged-in account belongs to — [{familyId, familyName,
// role}] — length 1 for the common case, more once someone's joined a
// second family (e.g. both their dad's and mom's trees). Powers the
// family switcher; empty in demo mode.
export let MY_FAMILIES = [];
// True when a real account is signed in but has no family_members row yet —
// a distinct, real state (e.g. an invite redemption that failed partway),
// never silently treated as either "demo" or "a member".
export let ACCOUNT_NEEDS_FAMILY = false;
// True for a Samskara team blog-author login (blog_authors, not
// family_members) — these accounts are real sessions with zero family
// memberships by design, which would otherwise look identical to
// ACCOUNT_NEEDS_FAMILY and trigger the "create/join a family" prompt. This
// flag lets that gate (AuthPanel.jsx) tell the two apart and send a blog
// author to the blog instead.
export let IS_BLOG_AUTHOR = false;
// True for a first-time, fully anonymous visitor (no session, and the demo
// wasn't explicitly requested via ?demo=1) — shown the login page instead of
// jumping straight into the public demo family's data.
export let NEEDS_LOGIN = false;
// Shared, family-wide streak — see bumpFamilyFlame in familyDb.js. 0 until
// resolved (or if the bump silently failed), which just hides the widget.
export let FAMILY_FLAME_STREAK = 0;
// Which person in the tree (if any) the logged-in user has linked
// themselves to — null in demo mode, or for a real account that hasn't
// picked one yet via Admin → Roster. Lets the Tree view highlight "you".
export let MY_PERSON_ID = null;
// 'UNANCHORED' | 'ANCHORED_UNRESOLVED' | 'PLACED_CONFIRMED' | null (demo,
// or no real membership row yet) — Fast Family Onboarding Phase 1's
// placement status, read straight off the caller's own family_members
// row. Gates the post-join RelationshipPathBuilder prompt and the Home
// "Finish My Connection" card; see docs/FAST_FAMILY_ONBOARDING.md.
export let MY_PLACEMENT_STATUS = null;
// True when a real account is signed in but hasn't accepted the current
// version of the Privacy Policy and Terms. Covers three cases with one
// check: accounts an Admin created directly (which never touch the signup
// form), accounts that predate consent being collected at all, and everyone
// again after POLICY_VERSION is bumped. Always false in demo mode — there's
// no account to record consent against.
export let NEEDS_CONSENT = false;

// The demo family always shows everything (matches IS_DEMO's existing role
// in `canModerate`) — a module is otherwise enabled unless explicitly
// disabled, never via an allow-list.
export function isModuleEnabled(key) {
  return IS_DEMO || MODULE_FLAGS[key] !== false;
}

export function setSession(next) {
  CURRENT_USER_ID = next.userId ?? null;
  CURRENT_FAMILY_ID = next.familyId ?? DEMO_FAMILY_ID;
  CURRENT_FAMILY_NAME = next.familyName ?? null;
  CURRENT_FAMILY_TAGLINE = next.familyTagline ?? null;
  CURRENT_FAMILY_LOGO_URL = next.familyLogoUrl ?? null;
  CURRENT_ROLE = next.role ?? null;
  IS_DEMO = next.isDemo ?? true;
  MODULE_FLAGS = next.moduleFlags ?? {};
  CURRENT_FAMILY_PLAN_TIER = next.planTier ?? "starter";
  CURRENT_FAMILY_PLAN_LIMIT_OVERRIDES = next.planLimitOverrides ?? {};
  ACCOUNT_NEEDS_FAMILY = next.needsFamily ?? false;
  IS_BLOG_AUTHOR = next.isBlogAuthor ?? false;
  NEEDS_LOGIN = next.needsLogin ?? false;
  MY_FAMILIES = next.myFamilies ?? [];
  FAMILY_FLAME_STREAK = next.flameStreak ?? 0;
  MY_PERSON_ID = next.myPersonId ?? null;
  MY_PLACEMENT_STATUS = next.myPlacementStatus ?? null;
  NEEDS_CONSENT = next.needsConsent ?? false;
}

// Called once the person accepts, so the gate can step aside without a full
// reload — the boot-time value is now stale and this is the one thing that
// changes about the session mid-visit.
export function markConsentGiven() {
  NEEDS_CONSENT = false;
}
