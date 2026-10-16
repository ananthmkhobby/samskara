import { useState } from "react";
import { PLAN_TIERS, PLAN_ORDER, LIMIT_LABELS, formatLimit } from "../lib/planTiers";
import { supabase } from "../lib/supabaseClient";
import { CURRENT_FAMILY_ID, CURRENT_USER_ID, CURRENT_ROLE, IS_DEMO, NEEDS_LOGIN } from "../data/session";
import "../styles/plans.css";

// Standalone, public page — reachable identically whether signed in or not
// (see App.jsx's NEEDS_LOGIN bypass + its always-rendered line in the main
// view switch, mirroring BlogView.jsx's own pattern exactly).
function goHome() {
  window.location.href = "/";
}

const CAN_REQUEST_UPGRADE = !NEEDS_LOGIN && !IS_DEMO && (CURRENT_ROLE === "head" || CURRENT_ROLE === "admin");

export default function PlansView() {
  const [currency, setCurrency] = useState("inr");
  const [requesting, setRequesting] = useState(null);
  const [requested, setRequested] = useState({});
  const [error, setError] = useState("");

  async function requestPlan(tier) {
    if (NEEDS_LOGIN) {
      window.location.href = "/";
      return;
    }
    if (!CAN_REQUEST_UPGRADE) {
      setError("Only a family's Head or Admin can request a plan change — ask them to do this from their own login.");
      return;
    }
    setRequesting(tier);
    setError("");
    try {
      const { error: insertError } = await supabase.from("plan_upgrade_requests").insert({
        family_id: CURRENT_FAMILY_ID, requested_tier: tier, requested_by: CURRENT_USER_ID,
      });
      if (insertError) throw new Error(insertError.message);
      setRequested((prev) => ({ ...prev, [tier]: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRequesting(null);
    }
  }

  return (
    <div className="login-page login-page-scroll plans-shell">
      <button className="login-help-link login-back-link" onClick={goHome}>← Samskara</button>
      <div className="login-help-wrap plans-wrap">
      <div className="plans-hero">
        <span className="eyebrow">Samskara</span>
        <h1>Plans</h1>
        <p>Every family starts free. Upgrade any time as your archive grows.</p>
        <div className="plans-currency-toggle">
          <button type="button" className={currency === "inr" ? "active" : ""} onClick={() => setCurrency("inr")}>₹ INR</button>
          <button type="button" className={currency === "usd" ? "active" : ""} onClick={() => setCurrency("usd")}>$ USD</button>
        </div>
      </div>

      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)", textAlign: "center" }}>{error}</p>}

      <div className="plans-grid">
        {PLAN_ORDER.map((tier) => {
          const plan = PLAN_TIERS[tier];
          const price = plan.price[currency];
          const isStarter = tier === "starter";
          return (
            <div key={tier} className={`plan-card${tier === "rooted" ? " plan-card-featured" : ""}`}>
              <span className="eyebrow">{plan.label}</span>
              <p className="plan-card-tagline">{plan.tagline}</p>
              <div className="plan-card-price">
                {price === 0 ? "Free" : `${currency === "inr" ? "₹" : "$"}${price.toLocaleString()}`}
                {price > 0 && <span className="plan-card-period">/{plan.period}</span>}
              </div>
              <ul className="plan-card-features">
                {Object.entries(LIMIT_LABELS).map(([key, label]) => (
                  <li key={key}>{label}: <strong>{formatLimit(plan.limits[key])}</strong></li>
                ))}
                <li>PDF export: <strong>{plan.limits.pdfExport ? "Yes" : "View only"}</strong></li>
                <li>Printed book: <strong>{plan.limits.printedBook ? "1 included/year" : "—"}</strong></li>
                <li>Treasury, Journey, Japa: <strong>{plan.modules.treasury ? "Included" : "Not included"}</strong></li>
              </ul>
              {isStarter ? (
                <button type="button" className="btn primary" onClick={() => { window.location.href = "/"; }}>
                  Create your family
                </button>
              ) : requested[tier] ? (
                <p className="form-hint" style={{ textAlign: "center" }}>Request sent — we'll be in touch.</p>
              ) : (
                <button type="button" className="btn primary" disabled={requesting === tier} onClick={() => requestPlan(tier)}>
                  {requesting === tier ? "Sending…" : "Request this plan"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
