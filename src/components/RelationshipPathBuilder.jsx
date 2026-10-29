import { useState } from "react";
import { PEOPLE } from "../data/people";
import { CURRENT_DISPLAY_NAME } from "../data/session";
import { submitRelationshipPathClaim, createProvisionalPerson, setMyDisplayName } from "../data/familyDb";

const RELATIONSHIPS = [
  "parent", "child", "sibling", "spouse", "cousin", "cousin's spouse",
  "aunt/uncle", "in-law", "step/adoptive/guardian", "other", "not sure",
];

// Fast Family Onboarding Phase 1 — shown once, right after redeem_invite()/
// register_new_family() succeeds, only when the family has the
// fastOnboarding flag on and the joiner's placement is UNANCHORED (see
// App.jsx). Bounded to at most two follow-up questions (side, named
// missing person) per docs/FAST_FAMILY_ONBOARDING.md — never invents a
// parent/grandparent; "not sure"/skip is always a valid, complete answer.
export default function RelationshipPathBuilder({ initialProposedName, onDone }) {
  // "name" is first, always — relying on an earlier step (signup, an
  // admin-created login) having already collected a display name turned
  // out not to be safe: the "I already have an account" sign-in path
  // never asks for one, and create-member-login.js doesn't either. This
  // is the one screen every unanchored member is guaranteed to reach, so
  // it confirms/collects the name directly rather than assuming.
  const [step, setStep] = useState(CURRENT_DISPLAY_NAME ? "anchor" : "name");
  const [myName, setMyName] = useState(CURRENT_DISPLAY_NAME || "");
  const [anchorId, setAnchorId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [branchSide, setBranchSide] = useState("");
  const [connectingName, setConnectingName] = useState(initialProposedName || "");
  const [offerProvisional, setOfferProvisional] = useState(false);
  const [provisionalName, setProvisionalName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsSide = relationship === "cousin" || relationship === "cousin's spouse" || relationship === "in-law";
  const anchorPerson = anchorId ? PEOPLE.find((p) => p.id === anchorId) : null;

  async function confirmName() {
    if (!myName.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (myName.trim() !== CURRENT_DISPLAY_NAME) await setMyDisplayName(myName.trim());
      setStep("anchor");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const claimId = await submitRelationshipPathClaim(anchorId || null, relationship, needsSide ? branchSide : null, connectingName || null);
      if (offerProvisional && provisionalName.trim()) {
        await createProvisionalPerson(claimId, provisionalName.trim());
      }
      setStep("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <section className="wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="section-head"><h2>Thanks — we'll connect the dots</h2></div>
        <div className="card" style={{ padding: 24 }}>
          <p>
            You're in the family. A Head or Admin will finish linking you to the right spot in the tree — you can keep using
            Samskara right away in the meantime.
          </p>
          <button type="button" className="btn primary" style={{ marginTop: 10 }} onClick={onDone}>Continue →</button>
        </div>
      </section>
    );
  }

  return (
    <section className="wrap" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="section-head">
        <h2>Who are you in this family?</h2>
        <p>A couple of quick questions — skip anything you're not sure about, nothing here is required.</p>
      </div>

      <div className="card" style={{ padding: 24 }}>
        {step === "name" && (
          <>
            <label>Your name, as the family should see it</label>
            <input
              type="text" value={myName} onChange={(e) => setMyName(e.target.value)}
              placeholder="e.g. Kavya Reddy" style={{ marginBottom: 14 }}
            />
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <button type="button" className="btn primary small" disabled={!myName.trim() || busy} onClick={confirmName}>
              {busy ? "Saving…" : "Continue →"}
            </button>
          </>
        )}

        {step === "anchor" && (
          <>
            <label>Do you recognize anyone already in the tree?</label>
            <select value={anchorId} onChange={(e) => setAnchorId(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="">— not sure / no one I recognize —</option>
              {[...PEOPLE].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {!anchorId && (
              <p className="form-hint" style={{ marginBottom: 10 }}>
                That's fine — you'll stay a full member either way. An Admin will reach out to figure out where you fit.
              </p>
            )}
            <button type="button" className="btn primary small" onClick={() => setStep("relationship")}>Continue →</button>
            <button type="button" className="btn ghost small" style={{ marginLeft: 8 }} onClick={onDone}>Skip for now</button>
          </>
        )}

        {step === "relationship" && (
          <>
            <label>
              {anchorPerson ? `How are you related to ${anchorPerson.name}?` : "How are you related to the family, generally?"}
            </label>
            {!anchorPerson && (
              <p className="form-hint" style={{ marginTop: -8, marginBottom: 10 }}>
                You didn't pick anyone in the last step, so just describe your relationship in general terms — an Admin
                will follow up to work out the specifics.
              </p>
            )}
            <select value={relationship} onChange={(e) => setRelationship(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="">— choose one —</option>
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div>
              <button type="button" className="btn primary small" disabled={!relationship} onClick={() => setStep("followups")}>Continue →</button>
              <button type="button" className="btn ghost small" style={{ marginLeft: 8 }} onClick={() => setStep("anchor")}>Back</button>
            </div>
          </>
        )}

        {step === "followups" && (
          <>
            {needsSide && (
              <div className="form-row">
                <label>Which side? (optional)</label>
                <select value={branchSide} onChange={(e) => setBranchSide(e.target.value)}>
                  <option value="">— not sure —</option>
                  <option value="maternal">Through my mother's side</option>
                  <option value="paternal">Through my father's side</option>
                  <option value="marriage">Through marriage</option>
                </select>
              </div>
            )}
            <div className="form-row">
              <label>Do you know the name of the person who connects you? (optional)</label>
              <input type="text" value={connectingName} onChange={(e) => setConnectingName(e.target.value)} placeholder="e.g. my mother's brother, Ramesh" />
            </div>
            {connectingName.trim() && !offerProvisional && (
              <button type="button" className="btn ghost small" onClick={() => { setOfferProvisional(true); setProvisionalName(connectingName.trim()); }}>
                + Add them as a named person in the tree
              </button>
            )}
            {offerProvisional && (
              <div className="form-row">
                <label>Their name (will be reviewed by an Admin before being fully added)</label>
                <input type="text" value={provisionalName} onChange={(e) => setProvisionalName(e.target.value)} />
              </div>
            )}
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn primary small" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Finish →"}</button>
              <button type="button" className="btn ghost small" style={{ marginLeft: 8 }} onClick={() => setStep("relationship")}>Back</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
