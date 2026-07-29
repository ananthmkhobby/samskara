import { useEffect, useReducer, useRef, useState } from "react";
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
import SuperAdminView from "./components/SuperAdminView";
import HelpView from "./components/HelpView";
import JoinFamilyModal from "./components/JoinFamilyModal";
import ParamparaView from "./components/ParamparaView";
import ParamparaContributeModal from "./components/ParamparaContributeModal";
import LibraryView from "./components/LibraryView";
import BookModal from "./components/BookModal";
import AddBookModal from "./components/AddBookModal";
import LibraryEntryModal from "./components/LibraryEntryModal";
import ChitrashaleRoom from "./components/ChitrashaleRoom";
import ChitrashaleAddModal from "./components/ChitrashaleAddModal";
import LoginPage from "./components/LoginPage";
import HelpStandalone from "./components/HelpStandalone";
import { PEOPLE, INITIAL_CONTRIBUTIONS, BOOKS, BOOK_OWNERSHIP, BOOK_READERS, addPerson, addBook, makeUniquePersonId } from "./data/people";
import { byId, todayStr, getBiographyChapters, getBiographyTimeline } from "./data/helpers";
import { verifiedObjectsBySpot, hasAnyRoomObjects } from "./lib/chitrashale";
import { CURRENT_ROLE, IS_DEMO, CURRENT_FAMILY_ID, CURRENT_USER_ID, ACCOUNT_NEEDS_FAMILY, NEEDS_LOGIN } from "./data/session";
import { insertContribution, updateContributionStatus, updatePersonFields, updatePersonSpouse, mergeLifeLesson, appendChapter, insertExperienceEntry, updateExperienceCaption, deleteExperienceEntry as dbDeleteExperienceEntry, updateBookFields, insertOwnership, setReaderStatus } from "./data/familyDb";
import { resolveMediaUrl, uploadFamilyMedia } from "./lib/mediaUpload";

// Audio/video/photo contributions store a Storage path in `content` — this
// resolves it to a directly-playable signed URL right after submission, so
// playback works immediately without waiting for a reload (boot hydration
// does the same resolution for everything fetched at startup).
async function withMediaUrl(contribution) {
  if (!["audio", "video", "photo"].includes(contribution.type)) return contribution;
  const mediaUrl = await resolveMediaUrl(contribution.content);
  return { ...contribution, mediaUrl };
}

const VIEW_PATHS = { cover: "/", tree: "/tree", parampara: "/parampara", library: "/library", treasury: "/treasury", vault: "/vault", map: "/journey", admin: "/admin", builder: "/builder", superadmin: "/superadmin", help: "/help" };
const PATH_TO_VIEW = Object.fromEntries(Object.entries(VIEW_PATHS).map(([k, v]) => [v, k]));
const pathForView = (v) => VIEW_PATHS[v] || "/";
const viewForPath = (p) => PATH_TO_VIEW[p] || "cover";

// Captured once at module load — before React 18 StrictMode's intentional
// mount→unmount→remount cycle, and before the mount effect's
// history.replaceState() rebuilds the URL from just the view name (which
// drops any query string). Reading location.search fresh inside the
// component would see it already stripped by the time the kept render runs.
const FORCE_INTRO = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("intro") === "1";
// Same "read once at module load" reasoning as FORCE_INTRO above — an
// invite link's `?code=` needs to survive to the first render. AuthPanel
// already handles this for a logged-out visitor (or one with zero
// families); this one is for someone who opens a second family's invite
// link while already signed in and a member elsewhere.
const INVITE_CODE_FROM_URL = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("code") : null;

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
  const [contributions, setContributions] = useState(INITIAL_CONTRIBUTIONS);
  // Real per-family role from Supabase Auth (data/session.js), resolved once
  // at boot — the demo family stays fully open to match its original
  // honor-system behavior, so it always grants the moderator fast-path.
  const canModerate = IS_DEMO || CURRENT_ROLE === "admin" || CURRENT_ROLE === "head";
  // A few actions (photo change, chapter reset, experience removal) mutate
  // PEOPLE in place without an accompanying contribution being queued, so
  // there's no other state change to ride along on to trigger a re-render —
  // this tick is a plain "something changed, please re-render" signal.
  const [, bump] = useReducer((x) => x + 1, 0);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [biographyPersonId, setBiographyPersonId] = useState(null);
  const [contributeRequest, setContributeRequest] = useState(null);
  const [editRequest, setEditRequest] = useState(null);
  const [addFamilyRequest, setAddFamilyRequest] = useState(null);
  const [interviewRequest, setInterviewRequest] = useState(null);
  const [voiceWizardRequest, setVoiceWizardRequest] = useState(null);
  const [joinFamilyRequest, setJoinFamilyRequest] = useState(null);
  const [paramparaContributeOpen, setParamparaContributeOpen] = useState(false);
  const [openBookId, setOpenBookId] = useState(null);
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [libraryEntryRequest, setLibraryEntryRequest] = useState(null);
  const [roomPersonId, setRoomPersonId] = useState(null);
  const [chitrashaleAddSpot, setChitrashaleAddSpot] = useState(null);
  const [playingExp, setPlayingExp] = useState(null);
  const [toast, setToast] = useState("");
  const isPoppingRef = useRef(false);

  const pendingCount = contributions.filter((c) => c.status === "Pending").length;

  // Without this, the page behind any open modal stays scrollable — wheel/touch
  // drag on the backdrop scrolls the body instead of (or in addition to) the
  // modal's own content, which is disorienting and especially janky on mobile.
  useEffect(() => {
    const anyModalOpen = !!(
      selectedPersonId || biographyPersonId || contributeRequest || editRequest ||
      addFamilyRequest || interviewRequest || voiceWizardRequest || joinFamilyRequest ||
      paramparaContributeOpen || openBookId || addBookOpen || libraryEntryRequest ||
      roomPersonId || chitrashaleAddSpot || showIntro
    );
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedPersonId, biographyPersonId, contributeRequest, editRequest, addFamilyRequest, interviewRequest, voiceWizardRequest, joinFamilyRequest, paramparaContributeOpen, openBookId, addBookOpen, libraryEntryRequest, roomPersonId, chitrashaleAddSpot, showIntro]);

  // Seed a baseline history entry on load, then let the browser/device Back
  // button step backward through views and close modals one layer at a time
  // (instead of leaving the app), by restoring whatever full state was
  // pushed alongside each entry.
  useEffect(() => {
    const initialView = viewForPath(window.location.pathname);
    window.history.replaceState(
      { view: initialView, selectedPersonId: null, biographyPersonId: null, contributeRequest: null, editRequest: null, addFamilyRequest: null, interviewRequest: null, voiceWizardRequest: null, joinFamilyRequest: null, paramparaContributeOpen: false, openBookId: null, addBookOpen: false, libraryEntryRequest: null, roomPersonId: null, chitrashaleAddSpot: null },
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
      setJoinFamilyRequest(s.joinFamilyRequest || null);
      setParamparaContributeOpen(s.paramparaContributeOpen || false);
      setOpenBookId(s.openBookId || null);
      setAddBookOpen(s.addBookOpen || false);
      setLibraryEntryRequest(s.libraryEntryRequest || null);
      setRoomPersonId(s.roomPersonId || null);
      setChitrashaleAddSpot(s.chitrashaleAddSpot || null);
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
      joinFamilyRequest: next.joinFamilyRequest !== undefined ? next.joinFamilyRequest : joinFamilyRequest,
      paramparaContributeOpen: next.paramparaContributeOpen !== undefined ? next.paramparaContributeOpen : paramparaContributeOpen,
      openBookId: next.openBookId !== undefined ? next.openBookId : openBookId,
      addBookOpen: next.addBookOpen !== undefined ? next.addBookOpen : addBookOpen,
      libraryEntryRequest: next.libraryEntryRequest !== undefined ? next.libraryEntryRequest : libraryEntryRequest,
      roomPersonId: next.roomPersonId !== undefined ? next.roomPersonId : roomPersonId,
      chitrashaleAddSpot: next.chitrashaleAddSpot !== undefined ? next.chitrashaleAddSpot : chitrashaleAddSpot,
    };
    setView(full.view);
    setSelectedPersonId(full.selectedPersonId);
    setBiographyPersonId(full.biographyPersonId);
    setContributeRequest(full.contributeRequest);
    setEditRequest(full.editRequest);
    setAddFamilyRequest(full.addFamilyRequest);
    setInterviewRequest(full.interviewRequest);
    setVoiceWizardRequest(full.voiceWizardRequest);
    setJoinFamilyRequest(full.joinFamilyRequest);
    setParamparaContributeOpen(full.paramparaContributeOpen);
    setOpenBookId(full.openBookId);
    setAddBookOpen(full.addBookOpen);
    setLibraryEntryRequest(full.libraryEntryRequest);
    setRoomPersonId(full.roomPersonId);
    setChitrashaleAddSpot(full.chitrashaleAddSpot);
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
    commit({
      view: nextView, selectedPersonId: null, biographyPersonId: null, contributeRequest: null, editRequest: null,
      addFamilyRequest: null, interviewRequest: null, voiceWizardRequest: null, joinFamilyRequest: null,
      paramparaContributeOpen: false, openBookId: null, addBookOpen: false, libraryEntryRequest: null,
      roomPersonId: null, chitrashaleAddSpot: null,
    });
    window.scrollTo({ top: 0 });
  }

  function selectPerson(id) {
    commit({ selectedPersonId: id });
  }

  function openRoom(personId) {
    commit({ roomPersonId: personId });
  }

  function openContribute(opts = {}) {
    commit({ contributeRequest: opts });
  }

  function openJoinFamily(opts = {}) {
    commit({ joinFamilyRequest: opts });
  }

  function openParamparaContribute() {
    commit({ paramparaContributeOpen: true });
  }

  function openBook(bookId) {
    commit({ openBookId: bookId });
  }

  function openAddBook() {
    commit({ addBookOpen: true });
  }

  function openLibraryEntry(bookId, kind) {
    commit({ libraryEntryRequest: { bookId, kind } });
  }

  // Story edits, ownership, and reader status are all direct writes (see
  // the Library migration's RLS) rather than routed through the
  // contribution review queue — a book's story is moderator-only anyway,
  // and marking yourself as a reader or adding a journey link carries
  // none of the moderation weight a memory or wisdom entry does.
  async function saveBookStory(bookId, story) {
    const book = BOOKS.find((b) => b.id === bookId);
    if (!book) return;
    book.story = story;
    bump();
    try {
      await updateBookFields(bookId, { story });
    } catch (err) {
      showToast(`Couldn't save that: ${err.message}`);
    }
  }

  // Uploading a soft copy is a direct write, same as saveBookStory above —
  // both are moderator-only actions gated by the Story tab's own UI, not
  // routed through the contribution review queue.
  async function uploadBookFile(bookId, file) {
    const book = BOOKS.find((b) => b.id === bookId);
    if (!book) return;
    try {
      const filePath = await uploadFamilyMedia(CURRENT_FAMILY_ID, "library", file, file.name.split(".").pop() || "pdf");
      const fileUrl = await resolveMediaUrl(filePath);
      book.filePath = filePath;
      book.fileName = file.name;
      book.fileUrl = fileUrl;
      bump();
      await updateBookFields(bookId, { file_path: filePath, file_name: file.name });
    } catch (err) {
      showToast(`Couldn't upload that file: ${err.message}`);
    }
  }

  async function addOwnership(o) {
    try {
      const row = await insertOwnership(CURRENT_FAMILY_ID, o);
      BOOK_OWNERSHIP.push(row);
      bump();
    } catch (err) {
      showToast(`Couldn't add to the journey: ${err.message}`);
    }
  }

  async function setReaderStatusFor(bookId, personId, status) {
    try {
      const row = await setReaderStatus(CURRENT_FAMILY_ID, bookId, personId, status);
      const idx = BOOK_READERS.findIndex((r) => r.bookId === bookId && r.personId === personId);
      if (idx >= 0) BOOK_READERS[idx] = row; else BOOK_READERS.push(row);
      bump();
    } catch (err) {
      showToast(`Couldn't update reading status: ${err.message}`);
    }
  }

  // Someone who's already signed in (and already belongs to at least one
  // family — the zero-family case is handled inline by AuthPanel's
  // ACCOUNT_NEEDS_FAMILY branch) opens a second family's invite link:
  // surface the redeem prompt immediately rather than silently dropping
  // the ?code= param, which is all that happened before this existed.
  useEffect(() => {
    if (INVITE_CODE_FROM_URL && CURRENT_USER_ID && !ACCOUNT_NEEDS_FAMILY) {
      openJoinFamily({ code: INVITE_CODE_FROM_URL });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closing any modal/overlay goes back one history step rather than
  // clearing state directly, so Back and the on-screen Close button behave
  // identically and the history stack always reflects what's really open.
  function closeOverlay() {
    window.history.back();
  }

  async function submitContribution(data) {
    const status = canModerate ? "Verified" : "Pending";
    try {
      const contribution = await withMediaUrl(await insertContribution(CURRENT_FAMILY_ID, { ...data, status, date: todayStr(), contributorUserId: CURRENT_USER_ID }));
      setContributions((prev) => [...prev, contribution]);
      if (canModerate) applyContributionEffects(contribution);
      closeOverlay();
      showToast(canModerate ? "Added — now visible on the folio." : "Thanks — submitted for admin review.");
    } catch (err) {
      showToast(`Couldn't save that: ${err.message}`);
    }
  }

  async function submitEdit(data) {
    const status = canModerate ? "Verified" : "Pending";
    try {
      const contribution = await insertContribution(CURRENT_FAMILY_ID, { ...data, type: "edit", personId: editRequest.personId, status, date: todayStr(), contributorUserId: CURRENT_USER_ID });
      setContributions((prev) => [...prev, contribution]);
      if (canModerate) applyContributionEffects(contribution);
      closeOverlay();
      showToast(canModerate ? "Edit applied." : "Edit proposed — sent for admin review.");
    } catch (err) {
      showToast(`Couldn't save that: ${err.message}`);
    }
  }

  async function submitAddFamily(data) {
    const status = canModerate ? "Verified" : "Pending";
    try {
      const contribution = await insertContribution(CURRENT_FAMILY_ID, {
        ...data, type: "newPerson", anchorPersonId: addFamilyRequest.personId, relation: addFamilyRequest.relation,
        status, date: todayStr(), contributorUserId: CURRENT_USER_ID,
      });
      setContributions((prev) => [...prev, contribution]);
      if (canModerate) applyContributionEffects(contribution);
      closeOverlay();
      showToast(canModerate ? "Added to the family tree." : "Proposed — sent for admin review.");
    } catch (err) {
      showToast(`Couldn't save that: ${err.message}`);
    }
  }

  async function submitInterview(data) {
    const status = canModerate ? "Verified" : "Pending";
    try {
      const contribution = await insertContribution(CURRENT_FAMILY_ID, {
        ...data, type: "interview", personId: interviewRequest.personId, status, date: todayStr(), contributorUserId: CURRENT_USER_ID,
      });
      setContributions((prev) => [...prev, contribution]);
      if (canModerate) applyContributionEffects(contribution);
      closeOverlay();
      showToast(canModerate ? "Chapter added to the biography." : "Chapter proposed — sent for admin review.");
    } catch (err) {
      showToast(`Couldn't save that: ${err.message}`);
    }
  }

  // Called once per step by the voice walkthrough wizard — each field goes
  // through the exact same edit/apply pipeline as editing it individually
  // from the Folio, just triggered from a different UI. Submitting (rather
  // than batching to the end) is what makes a half-finished walkthrough safe
  // to resume later: whatever's answered is already saved.
  async function submitWizardField(personId, field, fieldLabel, content, contributor) {
    const status = canModerate ? "Verified" : "Pending";
    try {
      const contribution = await insertContribution(CURRENT_FAMILY_ID, {
        type: "edit", field, fieldLabel, personId, content, status, date: todayStr(),
        contributor: contributor.trim() || "Anonymous", contributorUserId: CURRENT_USER_ID,
      });
      setContributions((prev) => [...prev, contribution]);
      if (canModerate) applyContributionEffects(contribution);
      showToast(canModerate ? `${fieldLabel} updated.` : `${fieldLabel} proposed — sent for review.`);
    } catch (err) {
      showToast(`Couldn't save that: ${err.message}`);
    }
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
  // themselves or approve someone else's proposal. Each branch updates the
  // in-memory PEOPLE entry immediately (for instant UI feedback) and fires
  // the matching Supabase write in the background.
  function applyContributionEffects(c) {
    const familyId = CURRENT_FAMILY_ID;
    if (c.type === "newPerson" && c.anchorPersonId) {
      const anchor = byId(c.anchorPersonId);
      if (anchor) {
        const id = makeUniquePersonId(c.name);
        const newPerson = { id, name: c.name, trust: "approx" };
        // Only a year is ever collected here, never a real day/month — flag
        // it so the Vault doesn't list this as a real January 1st event.
        if (c.birthYear) { newPerson.born = `${c.birthYear}-01-01`; newPerson.bornYearOnly = true; }
        if (c.geo) newPerson.geo = c.geo;
        if (c.relation === "spouse") {
          newPerson.gen = anchor.gen;
          newPerson.parents = [];
          newPerson.spouse = anchor.id;
          // No real wedding date is collected in this flow — `new Date(null)`
          // silently resolves to Jan 1 1970 rather than failing, so a
          // marriage record here would show up as a bogus date in the Vault.
          // Only add one once we actually have a date to record.
          anchor.spouse = id;
          // If the anchor already has children on record, this spouse is
          // their other parent too — credit them retroactively, so adding
          // a grandmother after a grandfather doesn't leave her out of
          // "Child of X & Y" captions for kids who already existed.
          const anchorChildren = PEOPLE.filter((p) => p.parents?.includes(anchor.id) && !p.parents.includes(id));
          anchorChildren.forEach((child) => { child.parents = [...child.parents, id]; });
          // The anchor's spouse column can only point at this new person
          // once the person row actually exists — awaiting the insert first
          // avoids a foreign-key violation from the two writes racing.
          addPerson(newPerson)
            .then(() => updatePersonSpouse(familyId, anchor.id, id))
            .then(() => Promise.all(anchorChildren.map((child) => updatePersonFields(familyId, child.id, { parents: child.parents }))))
            .catch((err) => console.error("Failed to persist spouse link:", err.message));
        } else if (c.relation === "parent") {
          // Growing the tree upward: this person becomes a new root above
          // the anchor, rather than the anchor gaining a child below it.
          // The layout (classicTreeLayout.js) positions every generation
          // relative to MIN_GEN, so a lower gen number here just becomes
          // the new top row — no other tree code needs to change.
          newPerson.gen = anchor.gen - 1;
          newPerson.parents = [];
          addPerson(newPerson).catch((err) => console.error("Failed to persist new parent:", err.message));
          if (!anchor.parents.includes(id)) {
            anchor.parents = [...anchor.parents, id];
            updatePersonFields(familyId, anchor.id, { parents: anchor.parents }).catch((err) => console.error("Failed to link parent:", err.message));
          }
        } else {
          newPerson.gen = anchor.gen + 1;
          newPerson.parents = anchor.spouse ? [anchor.id, anchor.spouse] : [anchor.id];
          addPerson(newPerson).catch((err) => console.error("Failed to persist new person:", err.message));
        }
      }
    }
    if (c.type === "newBook") {
      // A book's id is database-generated (not a client-chosen slug like a
      // person's), so unlike addPerson this can't optimistically push a
      // placeholder first — the real row only exists once the insert
      // resolves, which is fine here since nothing else needs to reference
      // it synchronously in the same tick.
      let parsed = {};
      try { parsed = JSON.parse(c.content); } catch { /* malformed content, skip */ }
      addBook({ title: c.name, category: c.field, story: parsed.story || "", coverPath: parsed.coverPath || null, filePath: parsed.filePath || null, fileName: parsed.fileName || null, contributor: c.contributor })
        .then(() => bump())
        .catch((err) => console.error("Failed to persist book:", err.message));
    }
    if (c.type === "interview" && c.personId) {
      const person = byId(c.personId);
      if (person) {
        const chapter = { title: c.title, text: c.text };
        person.chapters = [...(person.chapters || []), chapter];
        appendChapter(familyId, c.personId, chapter).catch((err) => console.error("Failed to persist chapter:", err.message));
        bump();
      }
    }
    // A memory/photo/audio/video/document contribution tagged with an
    // experience category (e.g. "Photograph", "Voice") also gets appended to
    // that person's "Their Experience" grid, in addition to showing up in
    // the plain Contributions list.
    if (c.expCategory && c.personId) {
      const person = byId(c.personId);
      if (person) {
        const entry = {
          personId: c.personId,
          type: c.expCategory,
          caption: c.type === "memory" ? c.content : "",
          mediaPath: c.type === "photo" ? c.content : undefined,
        };
        // c.mediaUrl was already resolved to a signed URL at submission time
        // (see withMediaUrl) — reuse it instead of the raw Storage path,
        // which isn't directly renderable.
        const localEntry = { id: null, ...entry, mediaUrl: c.type === "photo" ? c.mediaUrl : undefined };
        person.experience = [...(person.experience || []), localEntry];
        bump();
        insertExperienceEntry(familyId, entry)
          .then((id) => { localEntry.id = id; })
          .catch((err) => console.error("Failed to persist experience entry:", err.message));
      }
    }
    if (c.type === "edit" && c.personId) {
      const person = byId(c.personId);
      if (!person) return;
      if (c.field === "summary") {
        person.summary = c.content;
        updatePersonFields(familyId, c.personId, { summary: c.content }).catch((err) => console.error(err.message));
      } else if (c.field === "lifeLesson") {
        try {
          const { quote, values } = JSON.parse(c.content);
          person.lifeLesson = { ...person.lifeLesson, quote, values };
          mergeLifeLesson(familyId, c.personId, { quote, values }).catch((err) => console.error(err.message));
        } catch { /* malformed content, skip */ }
      } else if (c.field === "places") {
        const places = c.content.split(",").map((s) => s.trim()).filter(Boolean);
        person.places = places;
        updatePersonFields(familyId, c.personId, { places }).catch((err) => console.error(err.message));
      } else if (c.field === "geo") {
        try {
          const geo = JSON.parse(c.content);
          person.geo = geo;
          updatePersonFields(familyId, c.personId, { geo }).catch((err) => console.error(err.message));
        } catch { /* malformed content, skip */ }
      } else if (c.field?.startsWith("chapter:")) {
        const idx = +c.field.split(":")[1];
        const chapters = getBiographyChapters(person).map((ch, i) => (i === idx ? { ...ch, text: c.content } : ch));
        person.chapters = chapters;
        updatePersonFields(familyId, c.personId, { chapters }).catch((err) => console.error(err.message));
      } else if (c.field?.startsWith("experience:")) {
        const entryId = c.field.slice("experience:".length);
        const entry = (person.experience || []).find((e) => String(e.id) === entryId);
        if (entry) {
          entry.caption = c.content;
          updateExperienceCaption(entry.id, c.content).catch((err) => console.error(err.message));
        }
      } else if (c.field === "heritage") {
        try {
          const { rashi, gotra } = JSON.parse(c.content);
          person.rashi = rashi || undefined;
          person.gotra = gotra || undefined;
          updatePersonFields(familyId, c.personId, { rashi: rashi || null, gotra: gotra || null }).catch((err) => console.error(err.message));
        } catch { /* malformed content, skip */ }
      } else if (c.field === "dayInLife") {
        try {
          const dayInLife = JSON.parse(c.content);
          person.dayInLife = dayInLife.items?.length ? dayInLife : null;
          updatePersonFields(familyId, c.personId, { day_in_life: person.dayInLife }).catch((err) => console.error(err.message));
        } catch { /* malformed content, skip */ }
      }
      bump();
    }
  }

  async function approveContribution(c) {
    try {
      await updateContributionStatus(c.id, "Verified");
      setContributions((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "Verified" } : x)));
      applyContributionEffects(c);
      showToast(c.type === "edit" ? "Edit applied — now visible on the folio." : c.type === "newPerson" ? "Added to the family tree." : c.type === "interview" ? "Chapter added to the biography." : "Marked Verified — now visible on the folio.");
    } catch (err) {
      showToast(`Couldn't approve: ${err.message}`);
    }
  }

  async function rejectContribution(c) {
    try {
      await updateContributionStatus(c.id, "Rejected");
      setContributions((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: "Rejected" } : x)));
      showToast("Submission rejected.");
    } catch (err) {
      showToast(`Couldn't reject: ${err.message}`);
    }
  }

  function changePhoto(personId, photoPath, photoUrl) {
    const person = byId(personId);
    if (person) { person.photoPath = photoPath; person.photoUrl = photoUrl; }
    bump();
    updatePersonFields(CURRENT_FAMILY_ID, personId, { photo_path: photoPath }).catch((err) => showToast(`Couldn't save photo: ${err.message}`));
    showToast("Photo updated.");
  }

  // Admin/Family Head only — undoes a bad chapter edit by removing it from
  // the stored chapters, reverting to the auto-generated fallback built from
  // summary/life lesson/places (there's no separate "original" text to
  // restore to now that edits write the person's row directly).
  function clearChapter(personId, idx) {
    const person = byId(personId);
    if (!person) return;
    const chapters = (person.chapters || []).filter((_, i) => i !== idx);
    person.chapters = chapters;
    bump();
    updatePersonFields(CURRENT_FAMILY_ID, personId, { chapters }).catch((err) => showToast(`Couldn't reset chapter: ${err.message}`));
    showToast("Chapter reset to the auto-generated version.");
  }

  // Admin/Family Head only — hides a bad/duplicate Experience card without
  // needing a review round-trip.
  function deleteExperienceEntry(personId, entryId) {
    const person = byId(personId);
    if (person) person.experience = (person.experience || []).filter((e) => e.id !== entryId);
    bump();
    dbDeleteExperienceEntry(entryId).catch((err) => showToast(`Couldn't remove: ${err.message}`));
    showToast("Removed from Their Experience.");
  }

  function dismissIntro() {
    try { localStorage.setItem("vamsha.seenIntro", "1"); } catch { /* storage unavailable */ }
    setShowIntro(false);
  }

  const selectedPerson = selectedPersonId ? byId(selectedPersonId) : null;
  const rawBiographyPerson = biographyPersonId ? byId(biographyPersonId) : null;
  // Chapters/timeline are synthesized for display here (not stored back onto
  // the raw person) exactly where BiographyOverlay needs them ready-made —
  // every other view only reads summary/lifeLesson/places directly and never
  // needed this fallback.
  const biographyPerson = rawBiographyPerson
    ? { ...rawBiographyPerson, chapters: getBiographyChapters(rawBiographyPerson), timeline: getBiographyTimeline(rawBiographyPerson) }
    : null;

  // A first-time, fully anonymous visitor (no session, demo not explicitly
  // requested via ?demo=1) sees the login page instead of the public demo
  // family — same welcome overlay first, though, so the ceremonial intro
  // isn't lost just because there's no data behind it yet.
  if (NEEDS_LOGIN) {
    if (showIntro) return <WelcomeIntro onDismiss={dismissIntro} />;
    if (view === "help") return <HelpStandalone onBack={() => goTo("cover")} />;
    // /superadmin needs no family data either (it talks to its own API
    // route, not the Supabase family fetch) — it must bypass the login
    // gate the same way Help does, or the provisioning page becomes
    // unreachable for a signed-out visitor, which defeats its purpose.
    if (view === "superadmin") {
      return (
        <div className="login-page login-page-scroll">
          <div className="login-help-wrap"><SuperAdminView /></div>
        </div>
      );
    }
    return <LoginPage onShowHelp={() => goTo("help")} />;
  }

  return (
    <div id="app">
      <TopBar view={view} onNav={goTo} pendingCount={pendingCount} onJoinAnother={() => openJoinFamily({})} />
      <main>
        {view === "cover" && <CoverPage contributions={contributions} onNav={goTo} onContribute={openContribute} onOpenRoom={openRoom} />}
        {view === "tree" && <TreeView contributions={contributions} onSelectPerson={selectPerson} onNav={goTo} />}
        {view === "parampara" && <ParamparaView contributions={contributions} onContribute={openParamparaContribute} />}
        {view === "library" && <LibraryView onOpenBook={openBook} onAddBook={openAddBook} />}
        {view === "treasury" && <TreasuryView onSelectPerson={selectPerson} />}
        {view === "vault" && <VaultView contributions={contributions} />}
        {view === "map" && <JourneyMapView onSelectPerson={selectPerson} />}
        {view === "admin" && <AdminView contributions={contributions} onApprove={approveContribution} onReject={rejectContribution} canModerate={canModerate} />}
        {view === "builder" && <FamilyBuilderView onNav={goTo} />}
        {view === "superadmin" && <SuperAdminView />}
        {view === "help" && <HelpView />}
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
          onSelectPerson={selectPerson}
          onOpenInterview={() => commit({ interviewRequest: { personId: selectedPerson.id, name: selectedPerson.name, context: [selectedPerson.summary, selectedPerson.lifeLesson?.quote].filter(Boolean).join(" ") } })}
          onOpenVoiceWizard={() => commit({ voiceWizardRequest: { personId: selectedPerson.id, name: selectedPerson.name, person: selectedPerson } })}
          onOpenRoom={() => openRoom(selectedPerson.id)}
          hasRoomObjects={hasAnyRoomObjects(contributions, selectedPerson.id)}
          playingExp={playingExp}
          onToggleExpPlay={toggleExpPlay}
          canModerate={canModerate}
          onRemoveExperience={(entryId) => deleteExperienceEntry(selectedPerson.id, entryId)}
        />
      )}
      {biographyPerson && (
        <BiographyOverlay
          person={biographyPerson}
          onClose={closeOverlay}
          onEditChapter={(idx, text) => commit({ editRequest: { personId: biographyPerson.id, field: `chapter:${idx}`, fieldLabel: `Chapter: ${biographyPerson.chapters[idx].title}`, value: text } })}
          canModerate={canModerate}
          isChapterOverridden={(idx) => (rawBiographyPerson?.chapters?.length || 0) > idx}
          onResetChapter={(idx) => clearChapter(biographyPerson.id, idx)}
        />
      )}
      {contributeRequest && (
        <ContributeModal initial={contributeRequest} onCancel={closeOverlay} onSubmit={submitContribution} canModerate={canModerate} />
      )}
      {joinFamilyRequest && (
        <JoinFamilyModal initialCode={joinFamilyRequest.code || ""} onClose={closeOverlay} />
      )}
      {paramparaContributeOpen && (
        <ParamparaContributeModal onCancel={closeOverlay} onSubmit={submitContribution} canModerate={canModerate} />
      )}
      {openBookId && BOOKS.find((b) => b.id === openBookId) && (
        <BookModal
          book={BOOKS.find((b) => b.id === openBookId)}
          contributions={contributions}
          onClose={closeOverlay}
          canModerate={canModerate}
          onSaveStory={saveBookStory}
          onAddOwnership={addOwnership}
          onSetReaderStatus={setReaderStatusFor}
          onAddEntry={(bookId, kind) => openLibraryEntry(bookId, kind)}
          onUploadFile={uploadBookFile}
        />
      )}
      {addBookOpen && (
        <AddBookModal onCancel={closeOverlay} onSubmit={submitContribution} canModerate={canModerate} />
      )}
      {libraryEntryRequest && (
        <LibraryEntryModal bookId={libraryEntryRequest.bookId} kind={libraryEntryRequest.kind} onCancel={closeOverlay} onSubmit={submitContribution} canModerate={canModerate} />
      )}
      {roomPersonId && byId(roomPersonId) && (
        <ChitrashaleRoom
          person={byId(roomPersonId)}
          contributions={contributions}
          onClose={closeOverlay}
          onSubmit={submitContribution}
          onOpenAdd={(spot) => commit({ chitrashaleAddSpot: spot })}
        />
      )}
      {chitrashaleAddSpot && roomPersonId && byId(roomPersonId) && (
        <ChitrashaleAddModal
          person={byId(roomPersonId)}
          occupiedSpots={verifiedObjectsBySpot(contributions, roomPersonId)}
          initialSpot={typeof chitrashaleAddSpot === "string" ? chitrashaleAddSpot : null}
          canModerate={canModerate}
          onCancel={closeOverlay}
          onSubmit={submitContribution}
        />
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
