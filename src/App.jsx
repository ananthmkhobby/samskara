import { useEffect, useRef, useState } from "react";
import TopBar from "./components/TopBar";
import BottomBar from "./components/BottomBar";
import CoverPage from "./components/CoverPage";
import TreeView from "./components/TreeView";
import TreasuryView from "./components/TreasuryView";
import VaultView from "./components/VaultView";
import JourneyMapView from "./components/JourneyMapView";
import AdminView from "./components/AdminView";
import FolioModal from "./components/FolioModal";
import ContributeModal from "./components/ContributeModal";
import EditModal from "./components/EditModal";
import BiographyOverlay from "./components/BiographyOverlay";
import FamilyBuilderView from "./components/FamilyBuilderView";
import AddFamilyMemberModal from "./components/AddFamilyMemberModal";
import AIInterviewModal from "./components/AIInterviewModal";
import FolioVoiceWizard from "./components/FolioVoiceWizard";
import WelcomeIntro from "./components/WelcomeIntro";
import { INITIAL_CONTRIBUTIONS, addPerson, makeUniquePersonId } from "./data/people";
import { byId, todayStr, applyOverrides } from "./data/helpers";
import { useLocalStorageState } from "./hooks/useLocalStorageState";

const VIEW_PATHS = { cover: "/", tree: "/tree", treasury: "/treasury", vault: "/vault", map: "/journey", admin: "/admin", builder: "/builder" };
const PATH_TO_VIEW = Object.fromEntries(Object.entries(VIEW_PATHS).map(([k, v]) => [v, k]));
const pathForView = (v) => VIEW_PATHS[v] || "/";
const viewForPath = (p) => PATH_TO_VIEW[p] || "cover";

// Captured once at module load — before React 18 StrictMode's intentional
// mount→unmount→remount cycle, and before the mount effect's
// history.replaceState() rebuilds the URL from just the view name (which
// drops any query string). Reading location.search fresh inside the
// component would see it already stripped by the time the kept render runs.
const FORCE_INTRO = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("intro") === "1";

export default function App() {
  const [view, setView] = useState(() => viewForPath(window.location.pathname));
  // Shown once, only when landing on the cover — not on a deep link to a
  // specific view, and never again once dismissed on this device. `?intro=1`
  // always forces it, for testing on a device where poking localStorage
  // directly is awkward (e.g. mobile with no easy console access).
  const [showIntro, setShowIntro] = useState(() => {
    if (FORCE_INTRO) return true;
    try {
      return viewForPath(window.location.pathname) === "cover" && !localStorage.getItem("vamsha.seenIntro");
    } catch {
      return false;
    }
  });
  const [contributions, setContributions] = useLocalStorageState("vamsha.contributions", INITIAL_CONTRIBUTIONS);
  const [overrides, setOverrides] = useLocalStorageState("vamsha.overrides", {});
  // Lightweight, honor-system role — there's no backend/accounts yet, so this
  // is "which hat am I wearing on this device" rather than real access
  // control. Admin/Family Head get a direct-apply fast path instead of
  // waiting in the review queue; Family Head is otherwise equivalent to
  // Admin, just the person the family recognizes as having set up the tree.
  const [myRole, setMyRole] = useLocalStorageState("vamsha.myRole", "member");
  const canModerate = myRole === "admin" || myRole === "head";
  const nextContribId = useRef(Math.max(0, ...contributions.map((c) => c.id)) + 1);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [biographyPersonId, setBiographyPersonId] = useState(null);
  const [contributeRequest, setContributeRequest] = useState(null);
  const [editRequest, setEditRequest] = useState(null);
  const [addFamilyRequest, setAddFamilyRequest] = useState(null);
  const [interviewRequest, setInterviewRequest] = useState(null);
  const [voiceWizardRequest, setVoiceWizardRequest] = useState(null);
  const [playingExp, setPlayingExp] = useState(null);
  const [toast, setToast] = useState("");
  const isPoppingRef = useRef(false);

  const pendingCount = contributions.filter((c) => c.status === "Pending").length;

  // Seed a baseline history entry on load, then let the browser/device Back
  // button step backward through views and close modals one layer at a time
  // (instead of leaving the app), by restoring whatever full state was
  // pushed alongside each entry.
  useEffect(() => {
    const initialView = viewForPath(window.location.pathname);
    window.history.replaceState(
      { view: initialView, selectedPersonId: null, biographyPersonId: null, contributeRequest: null, editRequest: null, addFamilyRequest: null, interviewRequest: null, voiceWizardRequest: null },
      "",
      pathForView(initialView)
    );

    function onPopState(e) {
      const s = e.state || { view: viewForPath(window.location.pathname) };
      isPoppingRef.current = true;
      setView(s.view || "cover");
      setSelectedPersonId(s.selectedPersonId || null);
      setBiographyPersonId(s.biographyPersonId || null);
      setContributeRequest(s.contributeRequest || null);
      setEditRequest(s.editRequest || null);
      setAddFamilyRequest(s.addFamilyRequest || null);
      setInterviewRequest(s.interviewRequest || null);
      setVoiceWizardRequest(s.voiceWizardRequest || null);
      requestAnimationFrame(() => { isPoppingRef.current = false; });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Applies a partial state change and pushes a new history entry so the
  // change is reachable via Back — unless we're already mid-popstate
  // (restoring history, not creating new entries).
  function commit(next) {
    const full = {
      view: next.view !== undefined ? next.view : view,
      selectedPersonId: next.selectedPersonId !== undefined ? next.selectedPersonId : selectedPersonId,
      biographyPersonId: next.biographyPersonId !== undefined ? next.biographyPersonId : biographyPersonId,
      contributeRequest: next.contributeRequest !== undefined ? next.contributeRequest : contributeRequest,
      editRequest: next.editRequest !== undefined ? next.editRequest : editRequest,
      addFamilyRequest: next.addFamilyRequest !== undefined ? next.addFamilyRequest : addFamilyRequest,
      interviewRequest: next.interviewRequest !== undefined ? next.interviewRequest : interviewRequest,
      voiceWizardRequest: next.voiceWizardRequest !== undefined ? next.voiceWizardRequest : voiceWizardRequest,
    };
    setView(full.view);
    setSelectedPersonId(full.selectedPersonId);
    setBiographyPersonId(full.biographyPersonId);
    setContributeRequest(full.contributeRequest);
    setEditRequest(full.editRequest);
    setAddFamilyRequest(full.addFamilyRequest);
    setInterviewRequest(full.interviewRequest);
    setVoiceWizardRequest(full.voiceWizardRequest);
    if (!isPoppingRef.current) {
      window.history.pushState(full, "", pathForView(full.view));
    }
  }

  function showToast(msg) {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2800);
  }

  function goTo(nextView) {
    commit({ view: nextView, selectedPersonId: null, biographyPersonId: null, contributeRequest: null, editRequest: null, addFamilyRequest: null, interviewRequest: null, voiceWizardRequest: null });
    window.scrollTo({ top: 0 });
  }

  function selectPerson(id) {
    commit({ selectedPersonId: id });
  }

  function openContribute(opts = {}) {
    commit({ contributeRequest: opts });
  }

  // Closing any modal/overlay goes back one history step rather than
  // clearing state directly, so Back and the on-screen Close button behave
  // identically and the history stack always reflects what's really open.
  function closeOverlay() {
    window.history.back();
  }

  function submitContribution(data) {
    const contribution = { id: nextContribId.current++, status: canModerate ? "Verified" : "Pending", date: todayStr(), ...data };
    setContributions((prev) => [...prev, contribution]);
    if (canModerate) applyContributionEffects(contribution);
    closeOverlay();
    showToast(canModerate ? "Added — now visible on the folio." : "Thanks — submitted for admin review.");
  }

  function submitEdit(data) {
    const contribution = { id: nextContribId.current++, type: "edit", personId: editRequest.personId, status: canModerate ? "Verified" : "Pending", date: todayStr(), ...data };
    setContributions((prev) => [...prev, contribution]);
    if (canModerate) applyContributionEffects(contribution);
    closeOverlay();
    showToast(canModerate ? "Edit applied." : "Edit proposed — sent for admin review.");
  }

  function submitAddFamily(data) {
    const contribution = {
      id: nextContribId.current++,
      type: "newPerson",
      anchorPersonId: addFamilyRequest.personId,
      relation: addFamilyRequest.relation,
      status: canModerate ? "Verified" : "Pending",
      date: todayStr(),
      ...data,
    };
    setContributions((prev) => [...prev, contribution]);
    if (canModerate) applyContributionEffects(contribution);
    closeOverlay();
    showToast(canModerate ? "Added to the family tree." : "Proposed — sent for admin review.");
  }

  function submitInterview(data) {
    const contribution = {
      id: nextContribId.current++,
      type: "interview",
      personId: interviewRequest.personId,
      status: canModerate ? "Verified" : "Pending",
      date: todayStr(),
      ...data,
    };
    setContributions((prev) => [...prev, contribution]);
    if (canModerate) applyContributionEffects(contribution);
    closeOverlay();
    showToast(canModerate ? "Chapter added to the biography." : "Chapter proposed — sent for admin review.");
  }

  // Called once per step by the voice walkthrough wizard — each field goes
  // through the exact same edit/apply pipeline as editing it individually
  // from the Folio, just triggered from a different UI. Submitting (rather
  // than batching to the end) is what makes a half-finished walkthrough safe
  // to resume later: whatever's answered is already saved.
  function submitWizardField(personId, field, fieldLabel, content, contributor) {
    const contribution = {
      id: nextContribId.current++,
      type: "edit",
      field,
      fieldLabel,
      personId,
      content,
      status: canModerate ? "Verified" : "Pending",
      date: todayStr(),
      contributor: contributor.trim() || "Anonymous",
    };
    setContributions((prev) => [...prev, contribution]);
    if (canModerate) applyContributionEffects(contribution);
    showToast(canModerate ? `${fieldLabel} updated.` : `${fieldLabel} proposed — sent for review.`);
  }

  function toggleExpPlay(key) {
    setPlayingExp((cur) => {
      const next = cur === key ? null : key;
      if (next) window.setTimeout(() => setPlayingExp((c) => (c === key ? null : c)), 2600);
      return next;
    });
  }

  // The actual data mutation behind an approved contribution — shared by the
  // admin queue's Approve button and by the direct-apply fast path so
  // Admin/Family Head get identical behavior whether they submit it
  // themselves or approve someone else's proposal.
  function applyContributionEffects(c) {
    if (c.type === "newPerson" && c.anchorPersonId) {
      const rawAnchor = byId(c.anchorPersonId);
      const anchor = rawAnchor ? applyOverrides(rawAnchor, overrides) : null;
      if (anchor) {
        const id = makeUniquePersonId(c.name);
        const newPerson = { id, name: c.name, trust: "approx" };
        if (c.birthYear) newPerson.born = `${c.birthYear}-01-01`;
        if (c.geo) newPerson.geo = c.geo;
        if (c.relation === "spouse") {
          newPerson.gen = anchor.gen;
          newPerson.parents = [];
          newPerson.spouse = anchor.id;
          // No real wedding date is collected in this flow — `new Date(null)`
          // silently resolves to Jan 1 1970 rather than failing, so a
          // MARRIAGES record here would show up as a bogus date in the
          // Vault. Only add one once we actually have a date to record.
          addPerson(newPerson);
          setOverrides((prev) => ({ ...prev, [anchor.id]: { ...(prev[anchor.id] || {}), spouse: id } }));
        } else {
          newPerson.gen = anchor.gen + 1;
          newPerson.parents = anchor.spouse ? [anchor.id, anchor.spouse] : [anchor.id];
          addPerson(newPerson);
        }
      }
    }
    if (c.type === "interview" && c.personId) {
      setOverrides((prev) => {
        const cur = prev[c.personId] || {};
        const nextNewChapters = [...(cur.newChapters || []), { title: c.title, text: c.text }];
        return { ...prev, [c.personId]: { ...cur, newChapters: nextNewChapters } };
      });
    }
    // A memory/photo/audio/video/document contribution tagged with an
    // experience category (e.g. "Photograph", "Voice") also gets appended to
    // that person's "Their Experience" grid, in addition to showing up in
    // the plain Contributions list.
    if (c.expCategory && c.personId) {
      setOverrides((prev) => {
        const cur = prev[c.personId] || {};
        const entry = {
          type: c.expCategory,
          caption: c.type === "memory" ? c.content : "",
          mediaUrl: c.type === "photo" ? c.content : undefined
        };
        return { ...prev, [c.personId]: { ...cur, experienceAdds: [...(cur.experienceAdds || []), entry] } };
      });
    }
    if (c.type === "edit" && c.personId) {
      setOverrides((prev) => {
        const cur = prev[c.personId] || {};
        let next = cur;
        if (c.field === "summary") next = { ...cur, summary: c.content };
        else if (c.field === "lifeLesson") {
          try {
            const { quote, values } = JSON.parse(c.content);
            next = { ...cur, lifeLesson: { quote, values } };
          } catch { /* malformed content, skip */ }
        }
        else if (c.field === "places") next = { ...cur, places: c.content.split(",").map((s) => s.trim()).filter(Boolean) };
        else if (c.field === "geo") {
          try { next = { ...cur, geo: JSON.parse(c.content) }; } catch { /* malformed content, skip */ }
        }
        else if (c.field?.startsWith("chapter:")) {
          const idx = +c.field.split(":")[1];
          next = { ...cur, chapters: { ...(cur.chapters || {}), [idx]: c.content } };
        } else if (c.field?.startsWith("experience:")) {
          const idx = +c.field.split(":")[1];
          next = { ...cur, experienceEdits: { ...(cur.experienceEdits || {}), [idx]: { caption: c.content } } };
        } else if (c.field === "heritage") {
          try {
            const { rashi, gotra } = JSON.parse(c.content);
            next = { ...cur, rashi: rashi || undefined, gotra: gotra || undefined };
          } catch { /* malformed content, skip */ }
        }
        return { ...prev, [c.personId]: next };
      });
    }
  }

  function approveContribution(c) {
    setContributions((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "Verified" } : x)));
    applyContributionEffects(c);
    showToast(c.type === "edit" ? "Edit applied — now visible on the folio." : c.type === "newPerson" ? "Added to the family tree." : c.type === "interview" ? "Chapter added to the biography." : "Marked Verified — now visible on the folio.");
  }

  function rejectContribution(c) {
    setContributions((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "Rejected" } : x)));
    showToast("Submission rejected.");
  }

  function changePhoto(personId, dataUrl) {
    setOverrides((prev) => ({ ...prev, [personId]: { ...(prev[personId] || {}), photoUrl: dataUrl } }));
    showToast("Photo updated.");
  }

  // Admin/Family Head only — undoes a bad chapter edit (e.g. one submitted
  // with duplicated or garbled text) by dropping the override, reverting to
  // the auto-generated fallback built from summary/life lesson/places.
  function resetChapterOverride(personId, idx) {
    setOverrides((prev) => {
      const cur = prev[personId];
      if (!cur?.chapters || cur.chapters[idx] === undefined) return prev;
      const nextChapters = { ...cur.chapters };
      delete nextChapters[idx];
      return { ...prev, [personId]: { ...cur, chapters: nextChapters } };
    });
    showToast("Chapter reset to the auto-generated version.");
  }

  // Admin/Family Head only — hides a bad/duplicate Experience card without
  // needing a review round-trip, same spirit as the chapter reset above.
  function removeExperienceEntry(personId, idx) {
    setOverrides((prev) => {
      const cur = prev[personId] || {};
      return { ...prev, [personId]: { ...cur, experienceEdits: { ...(cur.experienceEdits || {}), [idx]: { removed: true } } } };
    });
    showToast("Removed from Their Experience.");
  }

  function dismissIntro() {
    try { localStorage.setItem("vamsha.seenIntro", "1"); } catch { /* storage unavailable */ }
    setShowIntro(false);
  }

  const rawSelectedPerson = selectedPersonId ? byId(selectedPersonId) : null;
  const selectedPerson = rawSelectedPerson ? applyOverrides(rawSelectedPerson, overrides) : null;
  const rawBiographyPerson = biographyPersonId ? byId(biographyPersonId) : null;
  const biographyPerson = rawBiographyPerson ? applyOverrides(rawBiographyPerson, overrides) : null;

  return (
    <div id="app">
      <TopBar view={view} onNav={goTo} pendingCount={pendingCount} myRole={myRole} onRoleChange={setMyRole} />
      <main>
        {view === "cover" && <CoverPage contributions={contributions} onNav={goTo} onContribute={openContribute} />}
        {view === "tree" && <TreeView contributions={contributions} overrides={overrides} onSelectPerson={selectPerson} />}
        {view === "treasury" && <TreasuryView onSelectPerson={selectPerson} />}
        {view === "vault" && <VaultView contributions={contributions} overrides={overrides} />}
        {view === "map" && <JourneyMapView overrides={overrides} onSelectPerson={selectPerson} />}
        {view === "admin" && <AdminView contributions={contributions} overrides={overrides} onApprove={approveContribution} onReject={rejectContribution} canModerate={canModerate} />}
        {view === "builder" && <FamilyBuilderView onNav={goTo} />}
      </main>
      <BottomBar view={view} onNav={goTo} pendingCount={pendingCount} />

      <button className="record-pill" onClick={() => openContribute({})} aria-label="Record a memory">
        <span className="dot" /> Record a memory
      </button>

      {selectedPerson && (
        <FolioModal
          person={selectedPerson}
          contributions={contributions}
          onClose={closeOverlay}
          onEdit={(req) => commit({ editRequest: { personId: selectedPerson.id, ...req } })}
          onShare={(personId, type) => commit({ selectedPersonId: null, contributeRequest: { personId, type } })}
          onOpenBiography={() => commit({ biographyPersonId: selectedPerson.id })}
          onChangePhoto={changePhoto}
          onAddFamily={(relation) => commit({ addFamilyRequest: { personId: selectedPerson.id, anchorName: selectedPerson.name, relation } })}
          onOpenInterview={() => commit({ interviewRequest: { personId: selectedPerson.id, name: selectedPerson.name, context: [selectedPerson.summary, selectedPerson.lifeLesson?.quote].filter(Boolean).join(" ") } })}
          onOpenVoiceWizard={() => commit({ voiceWizardRequest: { personId: selectedPerson.id, name: selectedPerson.name, person: selectedPerson } })}
          playingExp={playingExp}
          onToggleExpPlay={toggleExpPlay}
          canModerate={canModerate}
          onRemoveExperience={(idx) => removeExperienceEntry(selectedPerson.id, idx)}
        />
      )}
      {biographyPerson && (
        <BiographyOverlay
          person={biographyPerson}
          onClose={closeOverlay}
          onEditChapter={(idx, text) => commit({ editRequest: { personId: biographyPerson.id, field: `chapter:${idx}`, fieldLabel: `Chapter: ${biographyPerson.chapters[idx].title}`, value: text } })}
          canModerate={canModerate}
          isChapterOverridden={(idx) => overrides[biographyPerson.id]?.chapters?.[idx] !== undefined}
          onResetChapter={(idx) => resetChapterOverride(biographyPerson.id, idx)}
        />
      )}
      {contributeRequest && (
        <ContributeModal initial={contributeRequest} onCancel={closeOverlay} onSubmit={submitContribution} canModerate={canModerate} />
      )}
      {editRequest && (
        <EditModal request={editRequest} onCancel={closeOverlay} onSubmit={submitEdit} canModerate={canModerate} />
      )}
      {addFamilyRequest && (
        <AddFamilyMemberModal request={addFamilyRequest} onCancel={closeOverlay} onSubmit={submitAddFamily} canModerate={canModerate} />
      )}
      {interviewRequest && (
        <AIInterviewModal request={interviewRequest} onCancel={closeOverlay} onSubmit={submitInterview} />
      )}
      {voiceWizardRequest && (
        <FolioVoiceWizard
          request={voiceWizardRequest}
          onSubmitField={(field, fieldLabel, content, contributor) => submitWizardField(voiceWizardRequest.personId, field, fieldLabel, content, contributor)}
          onFinish={closeOverlay}
          onOpenInterview={() => commit({ voiceWizardRequest: null, interviewRequest: { personId: voiceWizardRequest.personId, name: voiceWizardRequest.name, context: [voiceWizardRequest.person.summary, voiceWizardRequest.person.lifeLesson?.quote].filter(Boolean).join(" ") } })}
        />
      )}

      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>

      {showIntro && <WelcomeIntro onDismiss={dismissIntro} />}
    </div>
  );
}
