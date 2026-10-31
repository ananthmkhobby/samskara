# Samskara — Feature List

A plain-language guide to what Samskara does, for anyone showing or explaining the app to someone new.

---

## Core archive

**Family Tree** — Build and browse your family tree across generations. Tap anyone to open their Folio (their personal page), drag to pan, pinch/zoom to explore. Classic, Focus, and an auto-picked illustrated view for small trees.

**Folio (person profile)** — Each person's own page: dates, heritage details (rashi, gotra), life lessons, photos, chapters of their story. Admins/Heads edit directly; members submit edits for approval.

**Fix a Relationship** — Admin/Head tool to correct who's whose parent, with built-in checks (max 2 parents, no self-parent, no accidental loops in the tree).

**Timeline / Vault** — A chronological feed of everything added to the family archive — memories, milestones, and life events in the order they happened.

**Gallery** — The family's photo collection. Verified photos only; a "Private to me" tab for photos you've uploaded but haven't shared with the whole family yet.

**Photo Tags** — Tap a photo to pin a name on a face — link it to someone in the tree or just a free-text label. Any member can tag; only the tagger or a moderator can remove a tag.

**Search** — Find anyone in the family tree by name.

**Vamshavali** — A traditional lineage document — father's and mother's line, gotra, living status — generated from the tree data.

---

## Onboarding & joining

**Regular Invites** — A Head/Admin generates an invite link, optionally pre-linked to a specific person in the tree. The joining member redeems it and lands connected.

**Fast Family Onboarding (pilot feature, off by default)** — Lets a new member describe how they're related to someone already in the tree — even if the people connecting them aren't known or don't exist in the tree yet — without ever inventing ancestors. Goes into an admin queue ("Connection Workbench") for a Head/Admin to resolve properly.

**Join by Invite Code** — A signed-in or new user can join a family with a one-time invite code from the login screen.

**First Memory Wizard** — Lets a completely anonymous visitor preserve one photo and story before ever signing up — a low-friction way to try the app before committing to an account.

---

## Family roles

**Head** — Full control: can rename the family, fix any relationship, remove someone from the tree, and everything an Admin can do.

**Admin** — Can edit the tree, approve/reject member submissions, manage invites, resolve onboarding questions — everything except removing someone from the tree (Head-only).

**Member** — Can view the shared archive, contribute memories/photos (goes to Pending for review unless they're a moderator), and tag photos.

---

## Memory capture

**Contribute a Memory** — Add a photo, story, voice recording, or video to the archive, tagged to a person or the family generally.

**Voice-guided Folio fill-in** — Answer a few spoken questions to fill in a person's heritage, life lesson, and summary — skip anything, pick it up later.

**AI Interview** *(plan-gated)* — A guided voice Q&A that helps draft a biography from spoken answers.

**Photo scan & translate** *(plan-gated, AI feature)* — Extract text/details from scanned documents and photos.

---

## Family culture & practice

**Parampare** — A living-heritage feed: family wisdom, sayings, and lineage details (gotra, pravara, veda, shakha, guru), filterable by category. Can be shared one-time with another family via a code.

**Treasury** — A repository of family wisdom, quotes, and advice passed down.

**Japa** — Tracks chanting/spiritual-practice logs across family members.

**Journey** — A map plotting family members' life locations and migration routes across generations.

**Library** — A shared family book collection — who owns, gifted, read, or recommends each book. A book becomes a read-only "memorial" once its last owner has passed.

---

## Sharing

**Share a Photo (WhatsApp/social)** — Generate a public preview link for one approved photo, with a choice between a generic branded card or the actual photo as the preview image.

**Gallery Export** *(partner integration)* — A code-based, loginless way for an approved third-party photo tool to pull a family's verified photos.

**Content Share (Parampare)** — Share one lineage/wisdom entry with another family via a one-time redemption code — text only, never the photo.

**Family Photobook (PDF)** *(plan-gated)* — Download a printable PDF photobook of the family tree.

---

## Notifications & connectivity

**WhatsApp Connect** *(rolling out)* — Message a WhatsApp number to send photos and stories straight from your phone, and get nudged when something needs your review.

**Push Notifications** — Browser/app notifications for family activity (new content, pending approvals).

**Activity Feed** — "What's new in the family" — a running log of recent additions.

---

## Admin & account tools

**Admin Dashboard** — Review pending contributions, manage invites, see who's unlinked, manage roster and roles.

**Connection Workbench** — Resolve Fast Family Onboarding's queue: link an unlinked member to their real tree entry, confirm a provisional person, invite someone named but missing, or mark something a duplicate.

**Account Settings** — Manage your own account, display name, notification preferences, and request account/data deletion.

**Plans** — Starter/Rooted/Legacy tiers with different limits (tree size, photos, AI calls) and optional modules (Treasury, Journey, Japa, AI features, Fast Family Onboarding).

**SuperAdmin tools** *(operator-only)* — Provision new families, manage plan tiers, handle password-reset requests, run broadcasts, manage the blog team.

---

## Trust & privacy

**Consent Gate** — Every account explicitly reviews and agrees to the Privacy Policy and Terms before using the app — not a pre-ticked box.

**Private-to-me content** — Mark a photo or memory as visible only to you until you choose to share it with the family.

**Family data isolation** — Enforced at the database level, not just the UI — one family's data is never visible to another family's members.

**Account/Data Deletion** — Self-service request to delete your account or export your data.

---

## Public-facing

**Blog** — Samskara's own stories and articles, open to anyone, no login required.

**Live Demo** — A fully browsable sample family tree (the Rao family) for anyone to explore before signing up.
