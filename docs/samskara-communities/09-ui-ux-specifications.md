# 09 — UI/UX Specifications (20 screens)

**Visual language:** reuse `src/styles/tokens.css` as-is.
- Colours: parchment backgrounds (`--parchment`, `--parchment-paper`), `--ink` text, `--maroon` primary actions, `--gold` festival accents, `--forest` civic/sports accents
- Type: `--font-display` for headings, `--font-devanagari` for optional festival glyphs, `--font-body` for UI text
- Shape: `--radius` cards with `--shadow-1`
- Existing classes: `.card`, `.btn primary|ghost|small`, `.eyebrow`, `.section-head`, `.empty-state`, `.form-hint`, `.avatar`
- New components follow the same naming style. No new palette.

**Roles used below:** Visitor (not signed in), Resident (`resident`), Alumni, Committee (`committee`/`admin`).

---

### 1. Community landing (public, `/c/:slug`)
- **Objective:** the visitor understands what this is and taps Join.
- **Hierarchy:** community name and crest → 1 sentence ("Our society's shared festival memories") → up to 3 public highlight photos (only if the committee made them public) → Join button.
- **Components:** `CoverPage.jsx`-style hero, `.btn primary`, privacy note.
- **Empty:** no public photos means a parchment illustration plus the community name.
- **Permission state:** visitors never see residents, households or non-public media. If already signed in as a member, the page redirects to Home.

### 2. Registration (committee creates community)
- **Objective:** a committee member sets up the community in under 5 minutes.
- **Hierarchy:** society name, city, approximate number of flats → blocks (quick-add "A, B, C" or "Tower 1–4") → optional bulk unit generation (floors × flats per floor) → your role.
- **Components:** stepped form (pattern from `FamilyBuilderView.jsx`), unit-grid preview.
- **Empty:** not applicable (this is a creation flow).
- **Permission state:** whoever creates the community becomes `admin`, and the community stays in `pending_verification` (screen 3) until approved. Uploads are allowed meanwhile, but invites are not.

### 3. Verification
- **Objective:** establish that the person is a real association representative.
- **Hierarchy:** status pill (Pending / Verified) → what we need (a letterhead photo or the committee's registered email) → expected time.
- **Components:** status `.card`, single file upload. Samskara staff review it in `SuperAdminView.jsx`.
- **Empty:** "Nothing submitted yet. Upload one document to get verified."
- **Permission state:** only the creating admin sees this screen. Other committee members see a "Verification pending" banner on the dashboard.

### 4. Invitation / joining
- **Objective (committee):** get a link and QR to post in the society's WhatsApp group. **Objective (resident):** join in 3 taps.
- **Hierarchy (committee):** large QR → copy link → "Copy WhatsApp message" (prefilled text) → link expiry and usage count. There is **no** in-app "send to all" button (decision 1).
- **Hierarchy (resident):** community name → choose your flat (search "B-304") or "I'm not tied to a flat" → relation (owner / tenant / family) → submit, which sets status to `pending`.
- **Components:** QR generator, `JoinFamilyModal.jsx` pattern, unit search field.
- **Empty:** if the flat is not found, show "Join without a flat; the committee will assign it."
- **Permission state:** the resident sees "Waiting for committee approval" plus read-only public highlights. The committee sees the new request in the Moderation → Members tab.

### 5. Community Home
- **Objective:** see what's happening now and add photos quickly.
- **Hierarchy:** community crest/name → Live event card ("Ganesh Chaturthi – add your photos") → upcoming strip (next 1–3 events) → recent highlights → "My household" card → (committee only) "12 items to review" banner.
- **Components:** reuses `HomeDashboard.jsx` layout and `.today-row` / `quick-action-icon` patterns.
- **Empty:** a new community shows "Create your first event" (committee) or "No events yet. Your committee will add the first one" (resident).
- **Permission state:** only the committee sees the moderation banner and "New event". Alumni see "You lived here 2016–2024" and only past events.

### 6. Residential tree
- **Objective:** find a flat or household; the committee maintains the structure.
- **Hierarchy:** search bar → block accordions with unit counts → units → household chip (Current / Owner / Past).
- **Components:** new `CommunityStructureView`, built as a lazy-loaded accordion (see doc 06). Optional floor × flat grid toggle via the `tree-mode-toggle` style.
- **Empty:** no units yet means "Add blocks and flats" (committee) or "Structure not set up yet" (resident).
- **Permission state:** residents see flat numbers and only opted-in household names. The committee sees everything and gets edit and "end occupancy" actions.

### 7. Memory tree (yearbook)
- **Objective:** browse memories by year and event.
- **Hierarchy:** year pills → grid of event cards (cover, name, date, count) → Yearbook/Timeline toggle.
- **Components:** `.card` grid, festival glyph in `--font-devanagari`.
- **Empty:** "Your society's yearbook starts with its first event."
- **Permission state:** counts exclude unapproved and child-review media for everyone except the uploader and the committee. The committee sees draft and unpublished events with a dashed border.

### 8. Event calendar / timeline
- **Objective:** see events in date order, including upcoming ones.
- **Hierarchy:** "Upcoming" section → past events grouped by month, as rows of date, name and count.
- **Components:** list rows adapted from `ActivityView.jsx`. Not a month-grid calendar (deferred, see doc 07).
- **Empty:** "No events scheduled."
- **Permission state:** the committee gets "+ Event" in the section head. Residents get a read-only view.

### 9. Event detail
- **Objective:** relive an event and contribute to it.
- **Hierarchy:** header (cover, name, date, status) → highlights strip → gallery grid → organizers → contributors summary → story.
- **Components:** `PhotoLightbox.jsx`, sticky "Add your photos" button while Live, committee "Share link/QR".
- **Empty:** a Live event with 0 photos shows "Be the first to add photos from today."
- **Permission state:** the uploader sees their own pending items with an "Awaiting review" overlay. Others never see those items. The committee sees approve/reject inline.

### 10. Collaborative photo upload
- **Objective:** a resident uploads many phone photos to the right event in one go.
- **Hierarchy:** event picker (defaults to the Live event) → **upfront notice:** "Photos with children are reviewed by the committee before anyone else sees them" → multi-select from the gallery → per-batch toggle "These include children" (required yes/no) → upload progress.
- **Components:** reuses `ContributeModal.jsx` and `ChitrashaleAddModal.jsx` upload mechanics, with resumable/background upload.
- **Empty:** no Live event shows a picker of recent events, plus "Everyday moments".
- **Permission state:** answering "yes, includes children" or leaving the toggle unanswered sets `review_only` (default-safe). After upload, the confirmation says "Visible only to you and the committee until approved."

### 11. Community gallery
- **Objective:** see all media across events; find "photos of our Diwali".
- **Hierarchy:** filter bar (year, event, "my uploads", highlights only) → masonry/grid → lightbox.
- **Components:** existing gallery grid patterns and `PhotoLightbox.jsx`. "Save to my family archive" action (feeds screen 19).
- **Empty:** "No photos yet. Add some from an event."
- **Permission state:** residents see published media only. The committee also gets a "Show pending" filter. Alumni see only media from their occupancy period plus their own uploads.

### 12. Event highlights
- **Objective:** a curated best-of per event, and a year-end best-of.
- **Hierarchy:** a section in screen 9 plus the highlights filter in screen 11. Committee curate mode lets them star up to 12 per event.
- **Components:** horizontal strip, star toggle.
- **Empty:** the committee sees "Pick highlights", with auto-suggestions of the most-viewed items. Residents see the section hidden.
- **Permission state:** only the committee can star. Child-containing photos can be highlights only once their wider visibility is approved.

### 13. Household profile
- **Objective:** see who is the current household at a unit, its history, and its contributions.
- **Hierarchy:** unit badge "B-304" → **Current household** (tenure, since date) → owner (if different) → **Past households** timeline → members (minors shown without photos to non-committee viewers) → contributions count.
- **Components:** `.card` sections, `.avatar`, occupancy timeline.
- **Empty:** a vacant unit shows "No current household" with the committee action "Record new occupancy".
- **Permission state:** a household edits its own members and its opt-in name visibility. The committee records move-in and move-out. Other residents see only the unit number, plus the name if the household opted in.

### 14. Community history
- **Objective:** a long-form story of the society (founding, milestones).
- **Hierarchy:** milestones list by year → each with text and 1–3 photos → links to related events.
- **Components:** reuses the `BlogView.jsx` / `BlogEditorView.jsx` editor for committee-written entries.
- **Empty:** "Tell the story of how [name] began." Committee gets a CTA; residents get a "suggest a memory" link.
- **Permission state:** the committee writes. Residents can suggest, which creates a Pending item in screen 15.

### 15. Contribution moderation
- **Objective:** the committee clears the queue fast, especially child-containing photos.
- **Hierarchy:** tabs **Children (review)** / Pending / Approved / Rejected / Members. This follows the tabbed Pending/Verified/Rejected/All structure in `AdminView.jsx`, with "Children" first and badged.
- **Components:** grid with multi-select. Per item: Approve for community / Keep private to uploader / Reject. A bulk "Approve batch" action. A "contains child" flag a moderator can add to any item.
- **Empty:** "All caught up."
- **Permission state:** `committee`/`admin` only. Residents who reach the route see "Only the committee can review contributions."

### 16. Association admin dashboard
- **Objective:** the committee's control centre for the pilot.
- **Hierarchy:** verification status → queue counts → Live event with its share QR → member counts (active / pending / alumni) → tabs: Overview / Events / Members & Roles (17) / Storage & Plan (18).
- **Components:** tab layout from `AdminView.jsx`.
- **Empty:** a fresh community shows a checklist: set up blocks → create first event → share QR.
- **Permission state:** `admin` sees every tab. `committee` sees Overview, Events and Members (read-only roles).

### 17. Roles and permissions
- **Objective:** assign committee roles, and hand over when the committee changes after elections.
- **Hierarchy:** members list with role pill → change role → "Transfer admin" (requires at least 2 admins before the last one can leave).
- **Components:** list rows, role select.
- **Empty:** not applicable (the creator is always listed).
- **Permission state:** only `admin` edits. A committee member sees the list read-only. Changes are logged.

### 18. Storage / subscription management
- **Objective:** know usage versus limit and upgrade if needed.
- **Hierarchy:** storage bar (used / quota) → largest events → current plan → upgrade.
- **Components:** reuses `PlansView.jsx`. Follows the gating rules in the monetisation plan (pilot is free or comped).
- **Empty:** "0 GB used."
- **Permission state:** `admin` only. At 90% of quota, the committee sees a banner; residents see nothing until uploads are blocked, and then "Storage full, ask your committee."

### 19. Personal Samskara connection
- **Objective:** a resident optionally links community memories to their family archive.
- **Hierarchy:** "Link to my family archive" → pick a family (from the user's spaces) → choose what flows: nothing by default, per-photo "Save to family", or auto-copy of my own uploads → revoke.
- **Components:** extends `FamilySwitcher.jsx` space list. Consent copy in the style of `ConsentGate.jsx`.
- **Empty:** a user with no family archive sees "Start a family archive", leading to the existing onboarding.
- **Permission state:** copies are personal and travel one way only. Family data never becomes visible to the community. Saving a photo that shows other households' children is blocked unless it has been approved for community-wide visibility.

### 20. Membership exit / data controls
- **Objective:** a resident leaving the society (or the app) knows exactly what happens to their data.
- **Hierarchy:** current status → "I moved out" (becomes Alumni: keeps access to past events and own uploads) vs "Leave community" (removed) → my uploads: keep in archive / remove all → export my uploads (zip).
- **Components:** `.card` choices with explicit consequences, confirm dialog.
- **Empty:** not applicable.
- **Permission state:** the household head can end the household's occupancy. Individuals control only their own membership and uploads. The committee can mark a household as moved out, and the resident is notified and can dispute.

---

## Design tensions resolved
- **20 screens vs pilot simplicity:** all 20 are specified, but screens 8, 12, 17 and 18 are tabs or sections, not routes (doc 08). 3 is a manual staff step.
- **"Tree" vs usability:** the residential tree is an accordion and the memory tree is a yearbook. Neither is a node diagram.
- **Child-safety vs friction:** the uploader is asked once per batch, unanswered means "review", and moderators get a dedicated first tab with bulk approve.
