import { useState } from "react";
import { VALUES } from "../data/people";
import { geocodePlace } from "../lib/geocode";
import { CloseIcon } from "./Icons";
import { useModalA11y } from "../hooks/useModalA11y";

export default function EditModal({ request, onCancel, onSubmit, canModerate }) {
  const modalA11y = useModalA11y(onCancel);
  const isHeritage = request.field === "heritage";
  const isLifeLesson = request.field === "lifeLesson";
  const isGeo = request.field === "geo";
  const isGeoStops = request.field === "geoStops";
  const isGeoStopsRemove = isGeoStops && request.removeIndex !== undefined;
  const isDayInLife = request.field === "dayInLife";
  const isBorn = request.field === "born";
  const isDied = request.field === "died";
  const isName = request.field === "name";
  const isTrust = request.field === "trust";
  const [value, setValue] = useState(request.value || "");
  const [trustChoice, setTrustChoice] = useState(request.value || "approx");
  const [diedUnknown, setDiedUnknown] = useState(request.diedUnknown || false);
  const [bornError, setBornError] = useState("");
  const [rashi, setRashi] = useState(request.rashi || "");
  const [gotra, setGotra] = useState(request.gotra || "");
  const [birthGotra, setBirthGotra] = useState(request.birthGotra || "");
  const [dayYear, setDayYear] = useState(request.dayYear || "");
  const [dayItems, setDayItems] = useState(request.dayItems || "");
  const [selectedValues, setSelectedValues] = useState(request.values || []);
  const [contributor, setContributor] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoError, setGeoError] = useState("");
  // Two-step location entry: look up first, confirm what was actually
  // matched second — a vague or misspelled query can resolve to something
  // far coarser than intended (a whole city instead of a neighborhood) with
  // nothing to show it happened, which is the real cause behind a pin that
  // looks "randomly placed". null = still typing; set once a lookup returns.
  const [geoResult, setGeoResult] = useState(null);
  const [geoCandidateIdx, setGeoCandidateIdx] = useState(0);

  function toggleValue(v) {
    setSelectedValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  // Accepts a full YYYY-MM-DD, or just a YYYY when the exact day isn't
  // known — mirrors the same convention used for xlsx import and the quick
  // +Add flow, so the Vault can tell a real date from a year-only one.
  function parseBornInput(raw) {
    const s = raw.trim();
    if (!s) return { born: null, bornYearOnly: false };
    if (/^\d{4}$/.test(s)) return { born: `${s}-01-01`, bornYearOnly: true };
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { born: s, bornYearOnly: false };
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (isBorn) {
      const parsed = parseBornInput(value);
      if (!parsed) { setBornError('Use YYYY-MM-DD, or just YYYY if the exact day isn\'t known.'); return; }
      setBornError("");
      onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content: JSON.stringify(parsed), contributor: contributor.trim() || "Anonymous" });
      return;
    }
    if (isDied) {
      if (diedUnknown) {
        onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content: JSON.stringify({ died: null, diedYearOnly: false, diedUnknown: true }), contributor: contributor.trim() || "Anonymous" });
        return;
      }
      if (!value.trim()) {
        onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content: JSON.stringify({ died: null, diedYearOnly: false, diedUnknown: false }), contributor: contributor.trim() || "Anonymous" });
        return;
      }
      const parsed = parseBornInput(value);
      if (!parsed) { setBornError('Use YYYY-MM-DD, or just YYYY if the exact day isn\'t known.'); return; }
      setBornError("");
      onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content: JSON.stringify({ died: parsed.born, diedYearOnly: parsed.bornYearOnly, diedUnknown: false }), contributor: contributor.trim() || "Anonymous" });
      return;
    }
    if (isName && !value.trim()) {
      setBornError("A name can't be empty.");
      return;
    }
    if (isTrust) {
      onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content: trustChoice, contributor: contributor.trim() || "Anonymous" });
      return;
    }
    if (isGeoStopsRemove) {
      // No lookup needed — removing is just the existing list minus one
      // entry, submitted straight away like every other quick action.
      const nextStops = request.stops.filter((_, i) => i !== request.removeIndex);
      onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content: JSON.stringify(nextStops), contributor: contributor.trim() || "Anonymous" });
      return;
    }
    if (isGeo || isGeoStops) {
      // Second step: a result is already on screen for confirmation — this
      // submit finalizes whichever candidate is currently selected, rather
      // than re-running the lookup.
      if (geoResult) {
        const chosen = geoResult.candidates[geoCandidateIdx] || geoResult;
        const stop = { place: value.trim(), lat: chosen.lat, lng: chosen.lng, resolvedName: chosen.resolvedName };
        // Adding a stop appends to whatever's already on record (append-only
        // — order is "the order they were added in", so add them oldest
        // first); editing the current city replaces the one value outright.
        const content = isGeoStops ? JSON.stringify([...(request.stops || []), stop]) : JSON.stringify(stop);
        onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content, contributor: contributor.trim() || "Anonymous" });
        return;
      }
      // First step: look up, then show what actually got matched instead of
      // silently trusting it — a vague or misspelled query can resolve to
      // something far coarser (a whole city) than what was typed.
      if (!value.trim()) return;
      setBusy(true);
      setGeoError("");
      try {
        const geo = await geocodePlace(value.trim());
        setGeoResult(geo);
        setGeoCandidateIdx(0);
      } catch (err) {
        setGeoError(err.message);
      } finally {
        setBusy(false);
      }
      return;
    }
    const content = isHeritage
      ? JSON.stringify({ rashi: rashi.trim(), gotra: gotra.trim(), birthGotra: birthGotra.trim() })
      : isLifeLesson
        ? JSON.stringify({ quote: value.trim(), values: selectedValues })
        : isDayInLife
          ? JSON.stringify({ year: dayYear.trim(), items: dayItems.split("\n").map((s) => s.trim()).filter(Boolean) })
          : value.trim();
    onSubmit({ field: request.field, fieldLabel: request.fieldLabel, content, contributor: contributor.trim() || "Anonymous" });
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-panel" {...modalA11y}>
        <button className="modal-close on-paper" onClick={onCancel} aria-label="Close"><CloseIcon /></button>
        <div className="modal-body">
          <span className="eyebrow">Propose a change</span>
          <h2 style={{ fontSize: 20, marginTop: 6 }}>Edit: {request.fieldLabel}</h2>
          <p className="form-hint" style={{ marginTop: 6 }}>{canModerate ? "As an Admin/Family Head, this applies immediately — no review needed." : "Your change goes to an admin for verification. It won't appear on the folio until approved."}</p>
          <form onSubmit={submit}>
            {isBorn ? (
              <div className="form-row">
                <label>Date of birth</label>
                <p className="form-hint" style={{ marginTop: 0, marginBottom: 6 }}>
                  Format: <b>YYYY-MM-DD</b> (e.g. 1963-10-11). Only know the year? Just enter that (e.g. 1963) — it'll show as a year, not a made-up day.
                </p>
                <input type="text" placeholder="e.g. 1963-10-11, or just 1963" value={value} onChange={(e) => setValue(e.target.value)} />
                {bornError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{bornError}</p>}
              </div>
            ) : isDied ? (
              <div className="form-row">
                <label>Date of death</label>
                <p className="form-hint" style={{ marginTop: 0, marginBottom: 6 }}>
                  Format: <b>YYYY-MM-DD</b>, or just the year if that's all you know. Leave blank if living.
                </p>
                <input
                  type="text" placeholder="e.g. 1978-09-02, or just 1978" value={value}
                  onChange={(e) => setValue(e.target.value)} disabled={diedUnknown}
                />
                {bornError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{bornError}</p>}
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontWeight: 400 }}>
                  <input
                    type="checkbox" checked={diedUnknown}
                    onChange={(e) => { setDiedUnknown(e.target.checked); if (e.target.checked) setValue(""); }}
                  />
                  They've passed away, but no one knows exactly when
                </label>
              </div>
            ) : isName ? (
              <div className="form-row">
                <label>Full name</label>
                <input type="text" value={value} onChange={(e) => setValue(e.target.value)} />
                {bornError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{bornError}</p>}
                <p className="form-hint">
                  Corrects the spelling shown everywhere in the archive. Their place in the tree,
                  and everything already recorded about them, stays exactly as it is.
                </p>
              </div>
            ) : isTrust ? (
              <div className="form-row">
                <label>How certain is this record?</label>
                <p className="form-hint" style={{ marginTop: 0, marginBottom: 8 }}>
                  "Verified" means a document or firm record backs this up. "Remembered by an elder" means someone who
                  knew them told it directly. Shown as a small badge on their folio — nothing else about their record changes.
                </p>
                <div className="tag-row">
                  {[
                    ["verified", "Verified"],
                    ["elder", "Remembered by an elder"],
                    ["approx", "Approximate"],
                  ].map(([key, label]) => (
                    <button
                      type="button" key={key}
                      className={`chip${trustChoice === key ? " active" : ""}`}
                      onClick={() => setTrustChoice(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : isHeritage ? (
              <>
                <div className="form-row">
                  <label>Rashi (optional)</label>
                  <input type="text" placeholder="e.g. Simha" value={rashi} onChange={(e) => setRashi(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Gotra (optional)</label>
                  <input type="text" placeholder="e.g. Bharadwaja" value={gotra} onChange={(e) => setGotra(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Birth gotra (optional)</label>
                  <p className="form-hint" style={{ marginTop: 0, marginBottom: 6 }}>
                    Only needed if this differs from the gotra above — e.g. a married-in daughter-in-law's gotra by birth, kept alongside her gotra by marriage.
                  </p>
                  <input type="text" placeholder="e.g. Kashyapa" value={birthGotra} onChange={(e) => setBirthGotra(e.target.value)} />
                </div>
              </>
            ) : isLifeLesson ? (
              <>
                <div className="form-row">
                  <label>Proposed life lesson quote</label>
                  <textarea style={{ minHeight: 100 }} value={value} onChange={(e) => setValue(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>Which values does this reflect? (optional)</label>
                  <div className="tag-row">
                    {VALUES.map((v) => (
                      <button type="button" key={v} className={`chip${selectedValues.includes(v) ? " active" : ""}`} onClick={() => toggleValue(v)}>{v}</button>
                    ))}
                  </div>
                </div>
              </>
            ) : isGeoStopsRemove ? (
              <div className="form-row">
                <p className="form-hint" style={{ marginTop: 0 }}>
                  Removes <b>{request.stops[request.removeIndex]?.place}</b> from their migration path. Their current
                  city and every other stop stay exactly as they are.
                </p>
              </div>
            ) : isGeo || isGeoStops ? (
              <div className="form-row">
                {isGeoStops && (
                  <p className="form-hint" style={{ marginTop: 0 }}>
                    {request.stops?.length
                      ? <>Already on their path, oldest first: <b>{request.stops.map((s) => s.place).join(" → ")}</b>. This adds one more stop after those.</>
                      : "Nothing recorded yet — this adds the first stop. Add them in order, oldest first; their current city (set separately, under Location) is always the last stop."}
                  </p>
                )}
                <label>{isGeoStops ? "City they lived in" : "City / place"}</label>
                <input
                  type="text" placeholder="e.g. Kathriguppe, Bangalore" value={value}
                  onChange={(e) => { setValue(e.target.value); setGeoResult(null); setGeoError(""); }}
                  disabled={busy}
                />
                <p className="form-hint">
                  Be as specific as you can — a neighbourhood name places them more precisely on the family's Journey
                  map than just the city on its own.
                </p>
                {geoError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{geoError}</p>}
                {geoResult && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "var(--parchment)", border: "1px solid var(--line)", borderRadius: 8 }}>
                    <p className="form-hint" style={{ marginTop: 0, marginBottom: 8, fontWeight: 700, color: "var(--ink)" }}>
                      {geoResult.candidates.length > 1 ? "Found a few matches — pick the right one:" : "Found this — is it right?"}
                    </p>
                    <div className="tag-row">
                      {geoResult.candidates.map((c, i) => (
                        <button
                          type="button" key={i}
                          className={`chip${geoCandidateIdx === i ? " active" : ""}`}
                          onClick={() => setGeoCandidateIdx(i)}
                          style={{ textAlign: "left" }}
                        >
                          {c.resolvedName}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button" className="link-btn" style={{ marginTop: 8 }}
                      onClick={() => { setGeoResult(null); setGeoError(""); }}
                    >
                      None of these — try a different search
                    </button>
                  </div>
                )}
              </div>
            ) : isDayInLife ? (
              <>
                <div className="form-row">
                  <label>Year (optional)</label>
                  <input type="text" placeholder="e.g. 1938" value={dayYear} onChange={(e) => setDayYear(e.target.value)} />
                </div>
                <div className="form-row">
                  <label>What an ordinary day looked like — one fact per line</label>
                  <textarea
                    style={{ minHeight: 160 }}
                    placeholder={"Woke up at 4:30 AM\nWalked 5 km to the village school\nOwned 2 pairs of clothes\nNever borrowed money"}
                    value={dayItems}
                    onChange={(e) => setDayItems(e.target.value)}
                  />
                  <p className="form-hint">Small, concrete details — what they wore, ate, walked, owned — say more than achievements do.</p>
                </div>
              </>
            ) : (
              <div className="form-row">
                <label>Proposed {request.fieldLabel.toLowerCase()}</label>
                <textarea style={{ minHeight: 140 }} value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            )}
            <div className="form-row">
              <label>Your name</label>
              <input type="text" placeholder="e.g. Kavya Reddy" value={contributor} onChange={(e) => setContributor(e.target.value)} />
            </div>
            <div className="folio-actions">
              <button type="submit" className="btn primary" disabled={busy || ((isGeo || isGeoStops) && !isGeoStopsRemove && !value.trim())}>
                {busy
                  ? "Looking up…"
                  : (isGeo || isGeoStops) && !isGeoStopsRemove && !geoResult
                    ? "Look this up"
                    : canModerate
                      ? (isGeoStopsRemove ? "Remove" : "Apply now")
                      : "Submit for review"}
              </button>
              <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
