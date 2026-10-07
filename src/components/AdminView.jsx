import { useEffect, useRef, useState } from "react";
import { MIN_GEN, MAX_GEN, byId, yearsLabel } from "../data/helpers";
import { IS_DEMO, CURRENT_FAMILY_ID, CURRENT_FAMILY_NAME, CURRENT_FAMILY_TAGLINE, CURRENT_FAMILY_LOGO_URL, CURRENT_USER_ID, CURRENT_ROLE } from "../data/session";
import {
  createInvite, fetchFamilyMembers, updateMemberRole, setMemberPersonLink,
  updateMemberDisplayName, fetchInvites, revokeInvite, fetchMemberEmail,
  createMemberLogin, resetMemberPassword, updateFamilyName, updateFamilyTagline, updateFamilyLogo,
  redeemContentShare, reassignParents, fetchAskablePhotoMembers, askFamilyPhotoId,
  fetchDuplicateDismissals, insertDuplicateDismissal,
  createGalleryExportCode, fetchGalleryExportCodes, revokeGalleryExportCode,
} from "../data/familyDb";
import { hammingDistance, DUPLICATE_HAMMING_THRESHOLD } from "../lib/imageHash";
import { categoryFor } from "../lib/parampara";
import { libraryCategoryFor } from "../lib/library";
import { spotFor } from "../lib/chitrashale";
import { resizeImage } from "../lib/imageResize";
import { uploadFamilyMedia } from "../lib/mediaUpload";
import { BOOKS, PEOPLE } from "../data/people";
import PersonAvatar from "./PersonAvatar";
import PhotoLightbox from "./PhotoLightbox";
import AddPeopleCard from "./AddPeopleCard";
import WhatsAppAdminTab from "./WhatsAppAdminTab";
import { EXP_LABELS, CloseIcon } from "./Icons";

const TABS = ["Pending", "Verified", "Rejected", "All"];
const ROLE_LABELS = { head: "Family Head", admin: "Admin", member: "Member" };

function RosterCard() {
  const [members, setMembers] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [emails, setEmails] = useState({});
  const [resettingId, setResettingId] = useState(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [resetDone, setResetDone] = useState({});
  const isHead = CURRENT_ROLE === "head";
  const isModerator = CURRENT_ROLE === "head" || CURRENT_ROLE === "admin";

  useEffect(() => {
    fetchFamilyMembers(CURRENT_FAMILY_ID).then(setMembers).catch((err) => setError(err.message));
  }, []);

  async function changeRole(member, role) {
    setBusyId(member.id);
    setError("");
    try {
      await updateMemberRole(member.id, role);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role } : m)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function changePersonLink(member, personId) {
    setBusyId(member.id);
    setError("");
    try {
      await setMemberPersonLink(member.id, personId || null);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, personId: personId || null } : m)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function startRename(member) {
    setRenamingId(member.id);
    setNameDraft(member.displayName || "");
  }

  async function showEmail(member) {
    setEmails((prev) => ({ ...prev, [member.id]: "…" }));
    try {
      const email = await fetchMemberEmail(member.id);
      setEmails((prev) => ({ ...prev, [member.id]: email || "(no email on file)" }));
    } catch (err) {
      setEmails((prev) => ({ ...prev, [member.id]: null }));
      setError(err.message);
    }
  }

  async function saveReset(member) {
    if (passwordDraft.length < 6) { setError("Password must be at least 6 characters."); return; }
    setBusyId(member.id);
    setError("");
    try {
      await resetMemberPassword(CURRENT_FAMILY_ID, member.id, passwordDraft);
      setResetDone((prev) => ({ ...prev, [member.id]: passwordDraft }));
      setResettingId(null);
      setPasswordDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function saveRename(member) {
    setBusyId(member.id);
    setError("");
    try {
      await updateMemberDisplayName(member.id, nameDraft);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, displayName: nameDraft.trim() || null } : m)));
      setRenamingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Family roster</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        {isHead ? "As Family Head, you can promote a Member to Admin (or step one back down) here." : "Only the Family Head can change roles — you can see who's who below."}
      </p>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {members === null ? null : members.map((m) => (
        <div className="queue-row" key={m.id} style={{ gridTemplateColumns: "auto 1fr auto", padding: "10px 0" }}>
          <div className="avatar" style={{ width: 34, height: 34, background: "var(--ink-faint)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>
            {(m.displayName || "?")[0].toUpperCase()}
          </div>
          <div className="queue-main">
            {renamingId === m.id ? (
              <div className="tag-row" style={{ alignItems: "center", marginBottom: 4 }}>
                <input
                  type="text" autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Display name" style={{ fontSize: 13, padding: "4px 6px" }}
                />
                <button type="button" className="btn small" disabled={busyId === m.id} onClick={() => saveRename(m)}>
                  {busyId === m.id ? "…" : "Save"}
                </button>
                <button type="button" className="btn small ghost" onClick={() => setRenamingId(null)}>Cancel</button>
              </div>
            ) : (
              <b>
                {m.displayName || "Unnamed member"}
                {isModerator && (
                  <button type="button" className="link-btn" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => startRename(m)}>Rename</button>
                )}
              </b>
            )}
            <div className="queue-meta">{ROLE_LABELS[m.role]} · joined {m.createdAt?.slice(0, 10)}</div>
            {isModerator && (
              emails[m.id] !== undefined ? (
                <div className="queue-meta">{emails[m.id] === null ? "Couldn't load email" : emails[m.id]}</div>
              ) : (
                <button type="button" className="link-btn" style={{ fontSize: 11 }} onClick={() => showEmail(m)}>
                  Show sign-up email
                </button>
              )
            )}
            {isModerator && (
              resetDone[m.id] ? (
                <p className="form-hint" style={{ marginTop: 4 }}>
                  New password: <b>{resetDone[m.id]}</b> — write it down, it won't be shown again.
                </p>
              ) : resettingId === m.id ? (
                <div className="tag-row" style={{ alignItems: "center", marginTop: 4 }}>
                  <input
                    type="text" autoFocus minLength={6} value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)}
                    placeholder="New password (min 6 chars)" style={{ fontSize: 13, padding: "4px 6px" }}
                  />
                  <button type="button" className="btn small" disabled={busyId === m.id} onClick={() => saveReset(m)}>
                    {busyId === m.id ? "…" : "Set"}
                  </button>
                  <button type="button" className="btn small ghost" onClick={() => { setResettingId(null); setPasswordDraft(""); }}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="link-btn" style={{ fontSize: 11 }} onClick={() => setResettingId(m.id)}>
                  Reset password
                </button>
              )
            )}
            {(m.userId === CURRENT_USER_ID || isModerator) && (
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 11, color: "var(--ink-faint)", display: "block", marginBottom: 3 }}>
                  Which one is {m.userId === CURRENT_USER_ID ? "you" : "this"} in the tree?
                </label>
                <select
                  value={m.personId || ""} disabled={busyId === m.id}
                  onChange={(e) => changePersonLink(m, e.target.value)}
                  style={{ fontSize: 13, padding: "4px 6px" }}
                >
                  <option value="">— not linked —</option>
                  {[...PEOPLE].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{yearsLabel(p) ? ` (${yearsLabel(p)})` : ""}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {isHead && m.role !== "head" && (
            <div className="queue-actions">
              {m.role === "member" ? (
                <button type="button" className="btn small" disabled={busyId === m.id} onClick={() => changeRole(m, "admin")}>
                  {busyId === m.id ? "…" : "Make Admin"}
                </button>
              ) : (
                <button type="button" className="btn small ghost" disabled={busyId === m.id} onClick={() => changeRole(m, "member")}>
                  {busyId === m.id ? "…" : "Remove Admin"}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InviteCard({ onCreated }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [personId, setPersonId] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const code = await createInvite(CURRENT_FAMILY_ID, CURRENT_USER_ID, personId || null);
      setLink(`${window.location.origin}/?code=${code}`);
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — link is still visible to copy manually */ }
  }

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Invite a new member</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>Generates a one-time link — anyone who opens it can create an account and join this family as a member.</p>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "var(--ink-faint)", display: "block", marginBottom: 3 }}>
          Who is this invite for? (optional — saves them a step in Roster later)
        </label>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={{ fontSize: 13, padding: "4px 6px" }}>
          <option value="">— not sure yet, they'll pick themselves —</option>
          {[...PEOPLE].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
            <option key={p.id} value={p.id}>{p.name}{yearsLabel(p) ? ` (${yearsLabel(p)})` : ""}</option>
          ))}
        </select>
      </div>
      {link ? (
        <div className="tag-row" style={{ alignItems: "center" }}>
          <input type="text" readOnly value={link} style={{ flex: 1, minWidth: 240 }} onFocus={(e) => e.target.select()} />
          <button type="button" className="btn small" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
          <button type="button" className="btn small ghost" onClick={generate} disabled={busy}>New link</button>
        </div>
      ) : (
        <button type="button" className="btn small primary" onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate invite link"}</button>
      )}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
    </div>
  );
}

// Every invite generated for this family, so a link that was created and
// then navigated away from isn't invisible — and so an unused one can be
// revoked (e.g. sent to the wrong person, or no longer needed).
function InvitesList({ refreshKey }) {
  const [invites, setInvites] = useState(null);
  const [members, setMembers] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchInvites(CURRENT_FAMILY_ID).then(setInvites).catch((err) => setError(err.message));
    fetchFamilyMembers(CURRENT_FAMILY_ID).then(setMembers).catch(() => {});
  }, [refreshKey]);

  function statusFor(inv) {
    if (inv.usedAt) return "used";
    if (new Date(inv.expiresAt) < new Date()) return "expired";
    return "pending";
  }

  async function copy(inv) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?code=${inv.code}`);
      setCopiedId(inv.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard unavailable */ }
  }

  async function revoke(inv) {
    setBusyId(inv.id);
    setError("");
    try {
      await revokeInvite(inv.id);
      setInvites((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (invites !== null && !invites.length) return null;

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Invite links</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>Every link generated so far, and whether it's been used yet.</p>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {invites === null ? null : invites.map((inv) => {
        const status = statusFor(inv);
        const person = inv.personId ? byId(inv.personId) : null;
        const usedByMember = inv.usedBy ? members?.find((m) => m.userId === inv.usedBy) : null;
        return (
          <div className="queue-row" key={inv.id} style={{ gridTemplateColumns: "1fr auto", padding: "10px 0" }}>
            <div className="queue-main">
              <b>{person ? `For ${person.name}` : "Open invite"}</b>
              <div className="queue-meta">
                {status === "used" && `Used by ${usedByMember?.displayName || "a member"} · ${inv.usedAt.slice(0, 10)}`}
                {status === "expired" && `Expired ${inv.expiresAt.slice(0, 10)} · never used`}
                {status === "pending" && `Generated ${inv.createdAt.slice(0, 10)} · expires ${inv.expiresAt.slice(0, 10)}`}
              </div>
            </div>
            <div className="queue-actions">
              {status === "pending" && (
                <>
                  <button type="button" className="btn small" onClick={() => copy(inv)}>{copiedId === inv.id ? "Copied!" : "Copy link"}</button>
                  <button type="button" className="btn small ghost" disabled={busyId === inv.id} onClick={() => revoke(inv)}>
                    {busyId === inv.id ? "…" : "Revoke"}
                  </button>
                </>
              )}
              {status !== "pending" && <span className={`status-pill ${status === "used" ? "Verified" : "Rejected"}`}>{status === "used" ? "Used" : "Expired"}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// A code, not a link — meant to be read off this screen and typed into a
// different product (ScanJunction's photo editor), which has no login of
// its own. Unlike an invite, generating a new one doesn't revoke the old —
// and redeeming one doesn't consume it either (see GalleryExportCodesList).
function GalleryExportCodeCard({ onCreated }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const c = await createGalleryExportCode(CURRENT_FAMILY_ID, CURRENT_USER_ID);
      setCode(c);
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — code is still visible to copy manually */ }
  }

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Gallery export code</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Generate a code and hand it to whoever is using ScanJunction's photo editor — they'll enter it there to import this family's verified photos. The code can be reused until it expires or you revoke it.
      </p>
      {code ? (
        <div className="tag-row" style={{ alignItems: "center" }}>
          <input
            type="text" readOnly value={code} onFocus={(e) => e.target.select()}
            style={{ flex: 1, minWidth: 200, fontFamily: "monospace", fontSize: 16, letterSpacing: 1, textAlign: "center" }}
          />
          <button type="button" className="btn small" onClick={copy}>{copied ? "Copied!" : "Copy code"}</button>
          <button type="button" className="btn small ghost" onClick={generate} disabled={busy}>New code</button>
        </div>
      ) : (
        <button type="button" className="btn small primary" onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate export code"}</button>
      )}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
    </div>
  );
}

function GalleryExportCodesList({ refreshKey }) {
  const [codes, setCodes] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchGalleryExportCodes(CURRENT_FAMILY_ID).then(setCodes).catch((err) => setError(err.message));
  }, [refreshKey]);

  // No "used" terminal state, unlike invites — this code stays usable
  // after being redeemed, so lastUsedAt is shown as metadata on an active
  // row, never a status by itself.
  function statusFor(c) {
    if (c.revokedAt) return "revoked";
    if (new Date(c.expiresAt) < new Date()) return "expired";
    return "active";
  }

  async function copy(c) {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopiedId(c.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard unavailable */ }
  }

  async function revoke(c) {
    setBusyId(c.id);
    setError("");
    try {
      await revokeGalleryExportCode(c.id);
      // Soft-revoke — patch locally rather than filtering out, so revoked
      // history stays visible (the family may want to review it later).
      setCodes((prev) => prev.map((x) => (x.id === c.id ? { ...x, revokedAt: new Date().toISOString() } : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (codes !== null && !codes.length) return null;

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Export codes</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>Every code generated so far, and whether it's still usable.</p>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {codes === null ? null : codes.map((c) => {
        const status = statusFor(c);
        return (
          <div className="queue-row" key={c.id} style={{ gridTemplateColumns: "1fr auto", padding: "10px 0" }}>
            <div className="queue-main">
              <b style={{ fontFamily: "monospace" }}>{c.code}</b>
              <div className="queue-meta">
                {status === "revoked" && `Revoked · generated ${c.createdAt.slice(0, 10)}`}
                {status === "expired" && `Expired ${c.expiresAt.slice(0, 10)}${c.lastUsedAt ? ` · last imported ${c.lastUsedAt.slice(0, 10)}` : ""}`}
                {status === "active" && `Expires ${c.expiresAt.slice(0, 10)}${c.lastUsedAt ? ` · last imported ${c.lastUsedAt.slice(0, 10)}` : " · not used yet"}`}
              </div>
            </div>
            <div className="queue-actions">
              {status === "active" && (
                <>
                  <button type="button" className="btn small" onClick={() => copy(c)}>{copiedId === c.id ? "Copied!" : "Copy code"}</button>
                  <button type="button" className="btn small ghost" disabled={busyId === c.id} onClick={() => revoke(c)}>
                    {busyId === c.id ? "…" : "Revoke"}
                  </button>
                </>
              )}
              {status !== "active" && <span className="status-pill Rejected">{status === "revoked" ? "Revoked" : "Expired"}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Most elders have no email at all — the invite-link flow above needs one
// (Supabase accounts are always email-backed), so this gives Head/Admin a
// second path: pick a username and a password directly, hand them over on
// paper or by voice, done. The email is synthesized from the username
// under the hood (see usernameToEmail in api/_memberAuth.js) — the person
// never needs to know or type an email anywhere.
function CreateLoginCard({ onCreated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [personId, setPersonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await createMemberLogin(CURRENT_FAMILY_ID, { username, password, displayName, personId: personId || null });
      setCreated(result);
      setUsername(""); setPassword(""); setDisplayName(""); setPersonId("");
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Create a login without email</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        For anyone without an email address — pick a username and password for them, then tell them directly. They'll log in with "No email? Log in with username" on the login page.
      </p>
      {created && (
        <p className="form-hint" style={{ marginBottom: 12 }}>
          Created — username <b>{created.username}</b>, password <b>{created.password}</b>. Write these down; the password won't be shown again.
        </p>
      )}
      <form onSubmit={submit}>
        <div className="form-row">
          <label>Username</label>
          <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. amma1950" style={{ fontSize: 13, padding: "4px 6px" }} />
        </div>
        <div className="form-row">
          <label>Password</label>
          <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 characters" style={{ fontSize: 13, padding: "4px 6px" }} />
        </div>
        <div className="form-row">
          <label>Their name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Lakshmi Devi" style={{ fontSize: 13, padding: "4px 6px" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: "var(--ink-faint)", display: "block", marginBottom: 3 }}>
            Which one is this in the tree? (optional)
          </label>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={{ fontSize: 13, padding: "4px 6px" }}>
            <option value="">— not sure yet —</option>
            {[...PEOPLE].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
              <option key={p.id} value={p.id}>{p.name}{yearsLabel(p) ? ` (${yearsLabel(p)})` : ""}</option>
            ))}
          </select>
        </div>
        {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
        <button type="submit" className="btn small primary" disabled={busy}>{busy ? "Creating…" : "Create login"}</button>
      </form>
    </div>
  );
}

// The family's name was fixed at setup and previously unchangeable by
// anyone — a typo meant asking the operator. Head/Admin only, and the RPC
// behind it can touch nothing but the name.
function FamilyNameCard() {
  const [name, setName] = useState(CURRENT_FAMILY_NAME || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const unchanged = name.trim() === (CURRENT_FAMILY_NAME || "").trim();

  async function save(e) {
    e.preventDefault();
    if (busy || unchanged || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await updateFamilyName(CURRENT_FAMILY_ID, name);
      setSaved(true);
      // The name is read once at boot into a module binding every view
      // reads synchronously, so a reload is the honest way to make it
      // consistent everywhere rather than patching it in one place.
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <h4 style={{ fontSize: 15, marginBottom: 4 }}>Family name</h4>
      <p className="form-hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Shown at the top of every page and on the family's home screen.
      </p>
      <form onSubmit={save} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setSaved(false); }}
          style={{ flex: "1 1 220px", minWidth: 0 }}
        />
        <button type="submit" className="btn small primary" disabled={busy || unchanged || !name.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {saved && <p className="form-hint">Saved — refreshing…</p>}
    </div>
  );
}

// Same "reload to stay consistent" reasoning as FamilyNameCard — both
// tagline and logo are read once at boot into plain module bindings.
function FamilyTaglineLogoCard() {
  const [tagline, setTagline] = useState(CURRENT_FAMILY_TAGLINE || "");
  const [logoBusy, setLogoBusy] = useState(false);
  const [taglineBusy, setTaglineBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const unchanged = tagline.trim() === (CURRENT_FAMILY_TAGLINE || "").trim();
  const fileRef = useRef(null);

  async function saveTagline(e) {
    e.preventDefault();
    if (taglineBusy || unchanged) return;
    setTaglineBusy(true);
    setError("");
    try {
      await updateFamilyTagline(CURRENT_FAMILY_ID, tagline);
      setSaved(true);
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setError(err.message);
      setTaglineBusy(false);
    }
  }

  async function handleLogoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoBusy(true);
    setError("");
    try {
      const { blob } = await resizeImage(file, 480);
      const path = await uploadFamilyMedia(CURRENT_FAMILY_ID, "family", blob, "jpg");
      await updateFamilyLogo(CURRENT_FAMILY_ID, path);
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeLogo() {
    setLogoBusy(true);
    setError("");
    try {
      await updateFamilyLogo(CURRENT_FAMILY_ID, "");
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setLogoBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <h4 style={{ fontSize: 15, marginBottom: 4 }}>Family tagline &amp; logo</h4>
      <p className="form-hint" style={{ marginTop: 0, marginBottom: 10 }}>
        Shown under the family name on Home. Both optional.
      </p>
      <form onSubmit={saveTagline} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input
          type="text" placeholder="e.g. hosa chiguru haLe beru koodiralu mara sobagu" value={tagline} maxLength={200}
          onChange={(e) => { setTagline(e.target.value); setSaved(false); }}
          style={{ flex: "1 1 260px", minWidth: 0 }}
        />
        <button type="submit" className="btn small primary" disabled={taglineBusy || unchanged}>
          {taglineBusy ? "Saving…" : "Save"}
        </button>
      </form>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {CURRENT_FAMILY_LOGO_URL && (
          <img src={CURRENT_FAMILY_LOGO_URL} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "contain", padding: 4, border: "1px solid var(--line-strong)", background: "var(--parchment-paper)" }} />
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoFile} disabled={logoBusy} />
        {CURRENT_FAMILY_LOGO_URL && (
          <button type="button" className="link-btn" onClick={removeLogo} disabled={logoBusy} style={{ color: "var(--maroon-ink)", fontSize: 13 }}>
            Remove
          </button>
        )}
      </div>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {saved && <p className="form-hint">Saved — refreshing…</p>}
    </div>
  );
}

// Brings in one Parampare entry another family's Head/Admin shared as a
// code — a one-time copy, not an ongoing link to their archive (which stays
// exactly as invisible to us as ours is to them; nothing here reveals which
// family a code came from).
function ImportSharedStoryCard() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importedTitle, setImportedTitle] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setImportedTitle("");
    try {
      const title = await redeemContentShare(code.trim());
      setImportedTitle(title || "that story");
      setCode("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18, padding: 16 }}>
      <h4 style={{ marginTop: 0 }}>Import a shared story</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Got a code from another family — in-laws, a cousin's branch — sharing one of their Parampare entries? Enter it
        here to add a copy to your own family's Parampare.
      </p>
      <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text" required placeholder="e.g. a14543cc61" value={code}
          onChange={(e) => { setCode(e.target.value); setImportedTitle(""); }}
          style={{ flex: "1 1 200px", minWidth: 0 }}
        />
        <button type="submit" className="btn small primary" disabled={busy || !code.trim()}>{busy ? "Adding…" : "Add to our Parampare"}</button>
      </form>
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {importedTitle && <p className="form-hint">Added "{importedTitle}" — it's live on your Parampare page now.</p>}
    </div>
  );
}

// Corrects who someone's `parents` are on record — the only write path onto
// that field used to be "+ Add parent" (appends, and hides itself once
// someone already has one), so a person wired to the wrong branch of the
// tree (e.g. attached to their own parent's parents instead of their actual
// parent) had no fix short of a direct database edit. Goes through the
// reassign_parents() RPC, which validates (no self-parent, no cycle, max 2
// parents) and cascades `gen` down through the person's own descendants —
// a page reload afterward is the same resync-from-server pattern
// AddPeopleCard's bulk import already uses, since the cascade can touch
// people far from this form's own state.
function EditRelationshipsCard() {
  const [personId, setPersonId] = useState("");
  const [parent1, setParent1] = useState("");
  const [parent2, setParent2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sorted = [...PEOPLE].sort((a, b) => a.name.localeCompare(b.name));
  const person = personId ? byId(personId) : null;

  function selectPerson(id) {
    setPersonId(id);
    setError("");
    const p = id ? byId(id) : null;
    setParent1(p?.parents?.[0] || "");
    setParent2(p?.parents?.[1] || "");
  }

  async function submit(e) {
    e.preventDefault();
    if (!personId) return;
    const ids = [parent1, parent2].filter(Boolean);
    if (new Set(ids).size !== ids.length) { setError("Parent 1 and Parent 2 can't be the same person."); return; }
    setBusy(true);
    setError("");
    try {
      await reassignParents(CURRENT_FAMILY_ID, personId, ids);
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 18 }}>
      <h4 style={{ marginTop: 0 }}>Fix a relationship</h4>
      <p className="form-hint" style={{ marginTop: 0 }}>
        Corrects who someone's parents are on record — for when a person was wired to the wrong branch of the
        tree. Updates their generation, and cascades down to their own children if they have any.
      </p>
      <form onSubmit={submit}>
        <div className="form-row">
          <label>Person to fix</label>
          <select value={personId} onChange={(e) => selectPerson(e.target.value)}>
            <option value="">— choose someone —</option>
            {sorted.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {person && (
          <>
            <p className="form-hint" style={{ marginTop: -4, marginBottom: 12 }}>
              Currently recorded as child of: {person.parents?.length ? person.parents.map((id) => byId(id)?.name || id).join(" & ") : "no one on record"}.
            </p>
            <div className="form-row">
              <label>Parent 1</label>
              <select value={parent1} onChange={(e) => setParent1(e.target.value)}>
                <option value="">— none —</option>
                {sorted.filter((p) => p.id !== personId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Parent 2 (optional)</label>
              <select value={parent2} onChange={(e) => setParent2(e.target.value)}>
                <option value="">— none —</option>
                {sorted.filter((p) => p.id !== personId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
            <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </>
        )}
      </form>
    </div>
  );
}

// A photo with no one linked yet — from WhatsApp (SKIPped during the
// conversation) or the app (a memory added without picking a person).
// "Ask the family" sends it to a chosen member over WhatsApp; their reply
// comes back through the normal webhook (WAITING_FOR_PHOTO_ID state) and
// either applies immediately (if they're a Head/Admin) or lands in the
// review queue as a proposal, same split as every other WhatsApp reply.
function UnidentifiedPhotosTab({ contributions, onOpenLightbox }) {
  const unidentified = contributions.filter((c) => c.type === "photo" && !c.personId && c.mediaUrl);
  const [members, setMembers] = useState(null);
  const [membersError, setMembersError] = useState("");
  const [askingId, setAskingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [sentIds, setSentIds] = useState(() => new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAskablePhotoMembers(CURRENT_FAMILY_ID).then(setMembers).catch((err) => setMembersError(err.message));
  }, []);

  async function send(contributionId, targetUserId) {
    setSendingId(contributionId);
    setError("");
    try {
      await askFamilyPhotoId(CURRENT_FAMILY_ID, contributionId, targetUserId);
      setSentIds((prev) => new Set(prev).add(contributionId));
      setAskingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingId(null);
    }
  }

  if (!unidentified.length) return <div className="card"><div className="empty-state">No unidentified photos right now.</div></div>;

  return (
    <div className="card">
      {membersError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{membersError}</p>}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {unidentified.map((c) => (
        <div className="queue-row" key={c.id}>
          <button type="button" onClick={() => onOpenLightbox(c.mediaUrl)} style={{ border: 0, padding: 0, background: "none", cursor: "zoom-in" }} aria-label="View photo full screen">
            <img src={c.mediaUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, display: "block" }} />
          </button>
          <div className="queue-main">
            <b>Unidentified photo</b>
            <div className="queue-meta">from {c.contributor} · {c.date}</div>
          </div>
          <div className="queue-actions">
            {sentIds.has(c.id) ? (
              <span className="status-pill Verified">Asked</span>
            ) : askingId === c.id ? (
              membersError ? (
                <span className="form-hint">Couldn't load who to ask.</span>
              ) : members === null ? (
                <span className="form-hint">Loading…</span>
              ) : members.length ? (
                <select defaultValue="" onChange={(e) => e.target.value && send(c.id, e.target.value)} disabled={sendingId === c.id}>
                  <option value="" disabled>Choose who to ask…</option>
                  {members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName || "Unnamed member"}</option>)}
                </select>
              ) : (
                <span className="form-hint">No one has connected WhatsApp yet.</span>
              )
            ) : (
              <button type="button" className="btn small" onClick={() => setAskingId(c.id)}>Ask the family</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// A generous, deliberate ceiling — see api/photobook-family.js's
// MAX_FAMILY_BOOK_PEOPLE for the same "legible capped-out message instead
// of a silent slow scan" reasoning. Not expected to trigger at this app's
// current per-family scale; the comparison below is O(n²).
const MAX_PHOTOS_FOR_DUPLICATE_SCAN = 500;

function pairKey(idA, idB) {
  const [lo, hi] = idA < idB ? [idA, idB] : [idB, idA];
  return `${lo}:${hi}`;
}

// Union-find over the candidate photos' perceptual hashes — two photos join
// a cluster when their Hamming distance is within DUPLICATE_HAMMING_
// THRESHOLD and that specific pair hasn't been dismissed. A dismissed pair
// can still end up back in the same cluster via a third, undismissed photo
// bridging them — an accepted simplification for a first version at this
// app's modest per-family photo counts, not worth a more elaborate
// clustering scheme yet.
function buildDuplicateClusters(candidates, dismissedPairKeys) {
  const parent = candidates.map((_, i) => i);
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(x, y) { const rx = find(x), ry = find(y); if (rx !== ry) parent[rx] = ry; }

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];
      if (dismissedPairKeys.has(pairKey(a.id, b.id))) continue;
      if (hammingDistance(a.imageHash, b.imageHash) <= DUPLICATE_HAMMING_THRESHOLD) union(i, j);
    }
  }

  const groups = new Map();
  candidates.forEach((c, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(c);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}

function DuplicatePhotosTab({ contributions, onDeleteContribution, onOpenLightbox }) {
  const [dismissedPairKeys, setDismissedPairKeys] = useState(() => new Set());
  const [dismissalsError, setDismissalsError] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDuplicateDismissals(CURRENT_FAMILY_ID)
      .then((rows) => setDismissedPairKeys(new Set(rows.map((r) => pairKey(r.contribution_id_a, r.contribution_id_b)))))
      .catch((err) => setDismissalsError(err.message));
  }, []);

  const candidates = contributions.filter((c) => c.type === "photo" && c.status === "Verified" && c.imageHash);

  if (candidates.length > MAX_PHOTOS_FOR_DUPLICATE_SCAN) {
    return (
      <div className="card">
        <div className="empty-state">
          This family has {candidates.length} verified photos — duplicate scanning is capped at {MAX_PHOTOS_FOR_DUPLICATE_SCAN} to stay fast. Contact support if you need this run anyway.
        </div>
      </div>
    );
  }

  const clusters = buildDuplicateClusters(candidates, dismissedPairKeys);

  async function dismissCluster(cluster) {
    const key = cluster.map((c) => c.id).join(",");
    setBusyKey(key);
    setError("");
    const pairs = [];
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        const k = pairKey(cluster[i].id, cluster[j].id);
        if (!dismissedPairKeys.has(k)) pairs.push([cluster[i].id, cluster[j].id, k]);
      }
    }
    try {
      for (const [a, b] of pairs) await insertDuplicateDismissal(CURRENT_FAMILY_ID, a, b, CURRENT_USER_ID);
      setDismissedPairKeys((prev) => {
        const next = new Set(prev);
        pairs.forEach(([, , k]) => next.add(k));
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  }

  if (!clusters.length) return <div className="card"><div className="empty-state">No likely duplicates right now.</div></div>;

  return (
    <div className="card">
      {dismissalsError && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{dismissalsError}</p>}
      {error && <p className="form-hint" style={{ color: "var(--maroon-ink)" }}>{error}</p>}
      {clusters.map((cluster) => {
        const key = cluster.map((c) => c.id).join(",");
        return (
          <div className="queue-row" key={key} style={{ alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {cluster.map((c) => (
                <button key={c.id} type="button" onClick={() => onOpenLightbox(c.mediaUrl)} style={{ border: 0, padding: 0, background: "none", cursor: "zoom-in" }} aria-label="View photo full screen">
                  <img src={c.mediaUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, display: "block" }} />
                </button>
              ))}
            </div>
            <div className="queue-main">
              <b>{cluster.length} photos that look the same</b>
              <div className="queue-meta">{cluster.map((c) => `${c.contributor} · ${c.date}`).join(" — ")}</div>
            </div>
            <div className="queue-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {cluster.map((c) => (
                <button key={c.id} type="button" className="btn small ghost" onClick={() => onDeleteContribution(c)}>
                  Delete this one
                </button>
              ))}
              <button type="button" className="btn small" disabled={busyKey === key} onClick={() => dismissCluster(cluster)}>
                {busyKey === key ? "…" : "Not duplicates"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MembersPage() {
  const [invitesRefreshKey, setInvitesRefreshKey] = useState(0);
  const [membersRefreshKey, setMembersRefreshKey] = useState(0);
  const [galleryExportRefreshKey, setGalleryExportRefreshKey] = useState(0);
  return (
    <>
      <FamilyNameCard />
      <FamilyTaglineLogoCard />
      <InviteCard onCreated={() => setInvitesRefreshKey((k) => k + 1)} />
      <InvitesList refreshKey={invitesRefreshKey} />
      <CreateLoginCard onCreated={() => setMembersRefreshKey((k) => k + 1)} />
      <RosterCard key={membersRefreshKey} />
      <GalleryExportCodeCard onCreated={() => setGalleryExportRefreshKey((k) => k + 1)} />
      <GalleryExportCodesList refreshKey={galleryExportRefreshKey} />
      <EditRelationshipsCard />
      <ImportSharedStoryCard />
      {/* Placed last — this is an occasional bulk action, not something a
          Head/Admin needs on every visit to the Members page. */}
      <AddPeopleCard />
    </>
  );
}

export default function AdminView({ contributions, onApprove, onReject, onDeleteContribution, canModerate }) {
  const showMembersTab = !IS_DEMO && canModerate;
  const showPhotosTab = !IS_DEMO && canModerate;
  const showDuplicatesTab = !IS_DEMO && canModerate;
  const showWhatsAppTab = !IS_DEMO && canModerate;
  const adminTabs = [...(showMembersTab ? ["Members"] : []), "Review queue", ...(showPhotosTab ? ["Photos"] : []), ...(showDuplicatesTab ? ["Duplicates"] : []), ...(showWhatsAppTab ? ["WhatsApp"] : [])];
  const [adminTab, setAdminTab] = useState(showMembersTab ? "Members" : "Review queue");
  const [tab, setTab] = useState("Pending");
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const pendingCount = contributions.filter((c) => c.status === "Pending").length;
  const rows = contributions.filter((c) => tab === "All" || c.status === tab).slice().reverse();

  function snippetFor(c) {
    if (c.type === "newBook") {
      try {
        const { story } = JSON.parse(c.content);
        return story ? `📚 ${story.slice(0, 90)}${story.length > 90 ? "…" : ""}` : `📚 New book — ${libraryCategoryFor(c.field).label}`;
      } catch { return "📚 New book"; }
    }
    if (c.type === "library_entry") {
      const book = BOOKS.find((b) => b.id === c.bookId);
      const kindLabel = { wisdom: "Lesson", memory: "Memory", discussion: "Discussion" }[c.field] || c.field;
      return `${kindLabel} on "${book?.title || "a book"}": "${c.content.slice(0, 70)}${c.content.length > 70 ? "…" : ""}"`;
    }
    if (c.type === "parampara") {
      if (c.field === "lineage") return "🕉️ Proposed family lineage details";
      try {
        const { description } = JSON.parse(c.content);
        return `${categoryFor(c.field).icon} ${description.slice(0, 90)}${description.length > 90 ? "…" : ""}`;
      } catch { return "New Parampare entry"; }
    }
    if (c.type === "chitrashalaObject") {
      const spot = spotFor(c.field);
      return `🪔 "${c.title}"${spot ? ` — ${spot.label.toLowerCase()}` : ""}`;
    }
    if (c.type === "chitrashalaReflection") return `🪔 "${c.content.slice(0, 90)}${c.content.length > 90 ? "…" : ""}"`;
    if (c.type === "interview") return `🎙️ AI-drafted chapter "${c.title}": "${c.text.slice(0, 80)}${c.text.length > 80 ? "…" : ""}"`;
    if (c.type === "newPerson") {
      const anchor = c.anchorPersonId ? byId(c.anchorPersonId) : null;
      const anchorName = anchor ? anchor.name : "someone in the tree";
      return c.relation === "spouse"
        ? `👪 Add ${c.name} as spouse of ${anchorName}`
        : c.relation === "parent"
        ? `👪 Add ${c.name} as a parent of ${anchorName}`
        : `👪 Add ${c.name} as son/daughter of ${anchorName}`;
    }
    if (c.field === "heritage") {
      try {
        const { rashi, gotra, birthGotra } = JSON.parse(c.content);
        return `✎ Proposed heritage details: ${[rashi && `Rashi: ${rashi}`, gotra && `Gotra: ${gotra}`, birthGotra && `Birth gotra: ${birthGotra}`].filter(Boolean).join(", ") || "(cleared)"}`;
      } catch { return "✎ Proposed heritage details"; }
    }
    if (c.type === "edit") return `✎ Proposed ${c.fieldLabel}: "${c.content.slice(0, 90)}${c.content.length > 90 ? "…" : ""}"`;
    if (c.type === "photo") return `📷 Photo — ${c.content}`;
    if (c.type === "document") return `📄 ${c.title || "Document"}${c.mediaUrl ? "" : " — wasn't saved; ask them to upload it again"}`;
    if (c.type === "date") return `📅 ${c.content}`;
    return c.content;
  }

  // Plain-language answer to "where does this actually show up once
  // approved" — the type badge already hints at it, but tersely (e.g.
  // "parampara · Ancestor Wisdom"); this spells it out so a moderator
  // doesn't have to infer it themselves before approving.
  function destinationFor(c) {
    const person = c.personId ? byId(c.personId) : null;
    if (c.type === "newPerson") {
      const anchor = c.anchorPersonId ? byId(c.anchorPersonId) : null;
      return `Adds a new person to the family tree${anchor ? `, connected to ${anchor.name}` : ""}`;
    }
    if (c.type === "edit") {
      return person ? `Updates "${c.fieldLabel}" on ${person.name}'s Folio` : `Updates "${c.fieldLabel}"`;
    }
    if (c.type === "interview") {
      return person ? `Adds a new biography chapter to ${person.name}'s Folio` : "Adds a new biography chapter";
    }
    if (["photo", "audio", "video", "memory", "document"].includes(c.type)) {
      if (person && c.expCategory) return `Shows up on ${person.name}'s Folio, under Their Experience (${EXP_LABELS[c.expCategory] || c.expCategory})`;
      if (person) return `Shows up on ${person.name}'s Folio`;
      return "Recorded as a family memory";
    }
    if (c.type === "date") return "Recorded as a family memory";
    if (c.type === "parampara") {
      return c.field === "lineage" ? "Shows up on the Parampare page, under Veda Lineage" : `Shows up on the Parampare page, under ${categoryFor(c.field).label}`;
    }
    if (c.type === "newBook") return `Adds a new book to the Family Library, under ${libraryCategoryFor(c.field).label}`;
    if (c.type === "library_entry") {
      const book = BOOKS.find((b) => b.id === c.bookId);
      const kindLabel = { wisdom: "Wisdom", memory: "Memories", discussion: "Discussions" }[c.field] || c.field;
      return `Shows up on "${book?.title || "a book"}", under the ${kindLabel} tab`;
    }
    if (c.type === "chitrashalaObject") {
      // spot.label is already a full prepositional phrase ("By the
      // window", "The puja corner") — no extra "at the" needed.
      const spot = spotFor(c.field);
      return person ? `Shows up in ${person.name}'s room — ${spot ? spot.label : "a spot in the room"}` : "Shows up in their room";
    }
    if (c.type === "chitrashalaReflection") {
      return person ? `Shows up as a reflection in ${person.name}'s room` : "Shows up as a reflection";
    }
    return null;
  }

  return (
    <section className="wrap">
      <div className="section-head">
        <h2>{adminTab === "Members" ? "Manage members" : adminTab === "Photos" ? "Unidentified photos" : adminTab === "Duplicates" ? "Possible duplicate photos" : adminTab === "WhatsApp" ? "WhatsApp activity" : "Review queue"}</h2>
        <p>
          {adminTab === "Members"
            ? "Invite people, see who's joined, fix a name, or set which person in the tree someone is — for themselves or, if they never got around to it, for anyone."
            : adminTab === "Photos"
            ? "Photos with no one linked yet — send one to a family member on WhatsApp and ask who it is."
            : adminTab === "Duplicates"
            ? "Photos that look the same, likely saved twice — once from the app, once from WhatsApp, or any other repeat. Scans only Verified Gallery photos."
            : adminTab === "WhatsApp"
            ? "Recent messages Samskara has received on WhatsApp for this family, and what happened with each one — for debugging the integration, not for everyday use."
            : "Everything the family has submitted or proposed to edit, waiting for a second pair of eyes before it changes the archive."}
        </p>
        {adminTab === "Review queue" && !canModerate && <p className="form-hint" style={{ marginTop: 6 }}>You can see what's pending, but only Admins or the Family Head can approve or reject.</p>}
      </div>
      {(showMembersTab || showPhotosTab || showDuplicatesTab || showWhatsAppTab) && (
        <div className="admin-tabs">
          {adminTabs.map((t) => (
            <button key={t} className={`chip${adminTab === t ? " active" : ""}`} onClick={() => setAdminTab(t)}>{t}</button>
          ))}
        </div>
      )}
      {adminTab === "Members" ? <MembersPage /> : adminTab === "Photos" ? <UnidentifiedPhotosTab contributions={contributions} onOpenLightbox={setLightboxSrc} /> : adminTab === "Duplicates" ? <DuplicatePhotosTab contributions={contributions} onDeleteContribution={onDeleteContribution} onOpenLightbox={setLightboxSrc} /> : adminTab === "WhatsApp" ? <WhatsAppAdminTab /> : (
      <>
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t} className={`chip${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}{t === "Pending" ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>
      <div className="card">
        {rows.length ? rows.map((c) => {
          const person = c.personId ? byId(c.personId) : null;
          const target = person ? person.name
            : c.type === "newPerson" ? `New: ${c.name}`
            : c.type === "parampara" ? (c.title || categoryFor(c.field).label)
            : c.type === "newBook" ? `New book: ${c.name}`
            : c.type === "library_entry" ? (BOOKS.find((b) => b.id === c.bookId)?.title || "A book")
            : c.type === "chitrashalaObject" || c.type === "chitrashalaReflection" ? "Someone's room"
            : `New: ${c.newPersonName}`;
          const isRealAudio = c.type === "audio" && !!c.mediaUrl;
          const isRealVideo = c.type === "video" && !!c.mediaUrl;
          const isRealPhoto = c.type === "photo" && !!c.mediaUrl;
          const isRealDocument = c.type === "document" && !!c.mediaUrl;
          const isFromWhatsApp = c.source === "whatsapp";
          // A proposed profile-photo change is an "edit" contribution whose
          // content is JSON, not the plain mediaUrl the other photo cases
          // use — same tap-to-fullscreen treatment once parsed, so a
          // reviewer sees the actual proposed photo instead of raw JSON text.
          let photoEditUrl = null;
          if (c.type === "edit" && c.field === "photo") {
            try { photoEditUrl = JSON.parse(c.content).photoUrl || null; } catch { /* malformed content */ }
          }
          return (
            <div className="queue-row" key={c.id}>
              {person
                ? <PersonAvatar person={person} size={40} minGen={MIN_GEN} maxGen={MAX_GEN} />
                : <div className="avatar" style={{ width: 40, height: 40, background: "var(--ink-faint)" }}>?</div>}
              <div className="queue-main">
                <b>{target}</b>
                <div className="queue-meta">
                  <span className={`type-badge${c.type === "edit" ? " edit" : ""}`}>
                    {c.type === "newPerson" ? "new family member"
                      : c.type === "interview" ? "AI interview"
                      : c.type === "parampara" ? `parampara · ${categoryFor(c.field).label}`
                      : c.type === "newBook" ? `library · ${libraryCategoryFor(c.field).label}`
                      : c.type === "library_entry" ? `library · ${c.field}`
                      : c.type === "chitrashalaObject" ? "chitrashale · object"
                      : c.type === "chitrashalaReflection" ? "chitrashale · reflection"
                      : c.type}
                  </span> · from {c.contributor}{isFromWhatsApp ? " · via WhatsApp" : ""} · {c.date}
                </div>
                {destinationFor(c) && <div className="queue-destination">↳ {destinationFor(c)}</div>}
                {isRealAudio ? <audio src={c.mediaUrl} controls style={{ maxWidth: 260, marginTop: 6 }} />
                  : isRealVideo ? <video src={c.mediaUrl} controls style={{ maxWidth: 260, marginTop: 6, borderRadius: 6 }} />
                    : (isRealPhoto || photoEditUrl) ? (
                      <button
                        type="button" onClick={() => setLightboxSrc(isRealPhoto ? c.mediaUrl : photoEditUrl)}
                        style={{ display: "block", border: 0, background: "none", padding: 0, cursor: "zoom-in", marginTop: 6 }}
                        aria-label="View photo full screen"
                      >
                        <img src={isRealPhoto ? c.mediaUrl : photoEditUrl} alt="" style={{ maxWidth: 260, maxHeight: 180, borderRadius: 6, display: "block" }} />
                      </button>
                    ) : isRealDocument ? (
                      // A document isn't inline-previewable the way a photo
                      // is — a reviewer needs to actually open it in a new
                      // tab to check it before approving, not just see a name.
                      <a href={c.mediaUrl} target="_blank" rel="noreferrer" className="queue-snippet" style={{ display: "inline-block", marginTop: 6 }}>
                        📄 {c.title || "Document"} — open to review →
                      </a>
                    ) : <div className="queue-snippet">{snippetFor(c)}</div>}
              </div>
              <div className="queue-actions">
                {c.status === "Pending" ? (
                  canModerate ? (
                    <>
                      <button className="btn small" onClick={() => onApprove(c)}>Approve</button>
                      <button className="btn small ghost" onClick={() => onReject(c)}>Reject</button>
                    </>
                  ) : <span className="status-pill Pending">Awaiting admin</span>
                ) : <span className={`status-pill ${c.status}`}>{c.status}</span>}
                {/* WhatsApp content specifically — same reasoning as the identical
                    control on a person's Folio: it's the source that mixes casual
                    sends in among formal edits, and the one an admin most needs to
                    clean up here, even after it's already Verified or Rejected. */}
                {canModerate && isFromWhatsApp && (
                  <button
                    type="button" className="icon-only" aria-label="Delete this WhatsApp contribution"
                    onClick={() => onDeleteContribution(c)}
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            </div>
          );
        }) : <div className="empty-state">Nothing in “{tab}” right now.</div>}
      </div>
      </>
      )}
      <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </section>
  );
}
