import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { resolveMediaUrl } from "../lib/mediaUpload";
import { callApi } from "../lib/apiFetch";
import { CURRENT_USER_ID } from "../data/session";
import AuthPanel from "./AuthPanel";

// Destination for a WhatsApp-shared /s/g/{token} link (see api/share.js
// and docs/SHARE_PREVIEW_SERVICE.md). Reads type/token straight off the
// real path, same independence as BlogView.jsx — this is not a normal
// app view, it has to work identically whether the visitor is signed in,
// signed out, or a member of a completely different family.
//
// The server (api/share.js's GET handler) only ever hands a crawler the
// APPROVED preview metadata — it has no way to know who's visiting. This
// component does the real work: resolve the token to a content id
// (action: "resolve", public), then query the actual photo under the
// visitor's own session and Postgres RLS — the same enforcement every
// other read in this app already goes through. No bespoke authorization
// code needed here; a non-member's query simply comes back empty.
const PATH_PARTS = window.location.pathname.split("/").filter(Boolean); // ["s", "g", "<token>"]
const SHARE_TYPE = PATH_PARTS[1] || null;
const SHARE_TOKEN = PATH_PARTS[2] || null;

export default function SharedPhotoLanding({ onGoHome }) {
  // "resolving" | "denied" | "unavailable" | "signin" | "ready"
  const [state, setState] = useState("resolving");
  const [photo, setPhoto] = useState(null); // { mediaUrl, contributor, date, personName }
  const [error, setError] = useState("");

  useEffect(() => {
    if (SHARE_TYPE !== "g" || !SHARE_TOKEN) {
      setState("unavailable");
      return;
    }
    callApi("/api/share", { action: "log-event", token: SHARE_TOKEN, eventType: "share_opened" }).catch(() => {});

    let cancelled = false;
    (async () => {
      try {
        const { active, contentId } = await callApi("/api/share", { action: "resolve", token: SHARE_TOKEN });
        if (cancelled) return;
        if (!active) { setState("unavailable"); return; }

        if (!CURRENT_USER_ID) { setState("signin"); return; }
        if (!supabase) { setState("unavailable"); return; }

        const { data: contribution } = await supabase
          .from("contributions")
          .select("id, content, contributor, date, person_id")
          .eq("id", contentId)
          .eq("type", "photo")
          .maybeSingle();

        if (cancelled) return;
        if (!contribution) {
          callApi("/api/share", { action: "log-event", token: SHARE_TOKEN, eventType: "access_denied" }).catch(() => {});
          setState("denied");
          return;
        }

        let personName = null;
        if (contribution.person_id) {
          const { data: person } = await supabase.from("people").select("name").eq("id", contribution.person_id).maybeSingle();
          personName = person?.name || null;
        }
        const mediaUrl = await resolveMediaUrl(contribution.content);

        callApi("/api/share", { action: "log-event", token: SHARE_TOKEN, eventType: "access_granted" }).catch(() => {});
        if (!cancelled) {
          setPhoto({ mediaUrl, contributor: contribution.contributor, date: contribution.date, personName });
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) { setError(err.message); setState("unavailable"); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "resolving") {
    return (
      <div className="login-page login-page-scroll">
        <div className="login-help-wrap"><p className="form-hint">Opening what was shared with you…</p></div>
      </div>
    );
  }

  if (state === "signin") {
    return (
      <div className="login-page login-page-scroll">
        <div className="login-help-wrap">
          <section className="wrap">
            <div className="section-head">
              <span className="eyebrow">🪔 Shared with you</span>
              <h2>Sign in to see this</h2>
              <p>Someone shared a family photo with you on Samskara — sign in (or create an account) to view it, if you're part of this family.</p>
            </div>
            <AuthPanel onShowPrivacy={onGoHome} onShowTerms={onGoHome} />
          </section>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="login-page login-page-scroll">
        <div className="login-help-wrap">
          <section className="wrap">
            <div className="section-head">
              <h2>This isn't available to you</h2>
              <p>This photo was shared with a specific family on Samskara, and your account isn't a member of it.</p>
            </div>
            <button type="button" className="btn ghost" onClick={onGoHome}>Go to Samskara →</button>
          </section>
        </div>
      </div>
    );
  }

  if (state === "unavailable") {
    return (
      <div className="login-page login-page-scroll">
        <div className="login-help-wrap">
          <section className="wrap">
            <div className="section-head">
              <h2>This link isn't available anymore</h2>
              <p>It may have expired or been turned off by whoever shared it.</p>
            </div>
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <button type="button" className="btn ghost" onClick={onGoHome}>Go to Samskara →</button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page login-page-scroll">
      <div className="login-help-wrap">
        <section className="wrap" style={{ maxWidth: 560 }}>
          <div className="section-head">
            <span className="eyebrow">🪔 Shared with you</span>
            <h2>A memory from the family</h2>
          </div>
          {photo.mediaUrl && (
            <img src={photo.mediaUrl} alt="" style={{ width: "100%", borderRadius: 12, border: "1px solid var(--line-strong)", marginBottom: 14 }} />
          )}
          <p className="form-hint" style={{ marginBottom: 14 }}>
            {photo.personName ? `Of ${photo.personName} — ` : ""}added by {photo.contributor || "a family member"}{photo.date ? ` · ${photo.date}` : ""}
          </p>
          <button type="button" className="btn primary" onClick={onGoHome}>Open Samskara →</button>
        </section>
      </div>
    </div>
  );
}
