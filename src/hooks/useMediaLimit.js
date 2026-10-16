import { useEffect, useState } from "react";
import { fetchMediaUsage } from "../lib/mediaUpload";
import { getEffectiveLimits, nextTier, PLAN_TIERS } from "../lib/planTiers";
import { CURRENT_FAMILY_ID, CURRENT_FAMILY_PLAN_TIER, CURRENT_FAMILY_PLAN_LIMIT_OVERRIDES } from "../data/session";

// Shared by every photo/recording/video upload surface — one RPC call per
// mount (family_media_usage, see its migration) rather than six separate
// implementations of the same fetch-and-compare. `kind` is "photos" |
// "recordings" | "videos". Returns used:null while loading, so callers can
// tell "still fetching" apart from "zero used" and avoid flashing a
// false-positive block.
export function useMediaLimit(kind) {
  const [used, setUsed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMediaUsage(CURRENT_FAMILY_ID).then((usage) => {
      if (!cancelled) setUsed(usage ? usage[kind] ?? 0 : null);
    });
    return () => { cancelled = true; };
  }, [kind]);

  const limit = getEffectiveLimits({ plan_tier: CURRENT_FAMILY_PLAN_TIER, plan_limit_overrides: CURRENT_FAMILY_PLAN_LIMIT_OVERRIDES })[kind];
  const atLimit = limit !== null && used !== null && used >= limit;
  const upgradeTier = nextTier(CURRENT_FAMILY_PLAN_TIER);

  return {
    used, limit, atLimit,
    loading: used === null,
    upgradeTierLabel: upgradeTier ? PLAN_TIERS[upgradeTier].label : null,
    // Ready-made line for a form-hint — null while limit is unlimited or
    // usage hasn't resolved yet, so callers can just do {usageLabel && ...}.
    usageLabel: limit !== null && used !== null ? `${used}/${limit} ${kind} used` : null,
  };
}
