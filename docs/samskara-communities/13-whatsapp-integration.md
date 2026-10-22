# 13 — WhatsApp Integration

**Status:** Design locked for MVP. One open question for the product owner (§7).
**Related:** 15-security-and-privacy.md (consent model), 16-monetization-and-cost-model.md (messaging line item).

---

## 1. The short version

WhatsApp is how Indian housing communities already talk. Samskara Communities uses it in two very different ways, and keeping them apart is the whole design:

| | (a) Link / QR sharing | (b) Transactional notifications |
|---|---|---|
| Who sends | The association, in its own existing WhatsApp groups | Samskara, via Twilio + WhatsApp Business API |
| Meta involvement | None | Full (templates, categories, per-message billing) |
| Cost to Samskara | ₹0 | ~₹0.115/message (Utility), billed per delivered message |
| Consent needed | None beyond the group the resident is already in | Explicit, separate, per-resident opt-in |
| Role | **Primary** distribution mechanism | Narrow convenience feature |

Samskara **never** sends outbound event invites, reminders, or announcements through the Business API. The rest of this doc explains why (§2) and what each half does (§3, §4).

---

## 2. The cost-math correction

The original brief assumed Samskara would "send event invites over WhatsApp." That assumption doesn't survive Meta's pricing.

### 2.1 How Meta prices messages

> Rates below are third-party-sourced figures for India. **Verify against Meta's own rate card** (and our BSP's price sheet) before quoting them anywhere external.

| Category | Approx. rate (India) | Notes |
|---|---|---|
| Marketing | ~₹0.86/message (from Jan 2026) | Promotional or engagement content |
| Utility | ~₹0.115/message | Free if sent within 24h of the user's last message to us |
| Authentication | ~₹0.115/message | OTPs; not relevant here |
| Service | Free | Replies inside a user-initiated conversation |

BSP resellers (Twilio included) typically add **10–30%** on top.

**Crucially, the category is not our choice.** Meta reviews each message template and assigns its category. An event invite — "Diwali Mela this Saturday, 6pm, Clubhouse lawn, RSVP here" — is promotional/engagement content and will almost certainly be classified **Marketing**, however we word it. Only narrowly transactional messages tied to something the user did ("your RSVP is confirmed", "the album you asked about is live") reliably qualify as **Utility**.

### 2.2 Modeled community

- 300 flats, ~600 WhatsApp recipients (≈2 adults per flat)
- 20 events/year, 2 messages/event (invite + reminder) = 40 community-wide sends
- 40 × 600 = **24,000 messages/year**

| Scenario | Per full-community send | Per year (base) | Per year with 10–30% markup |
|---|---|---|---|
| Marketing (what invites would really be) | 600 × ₹0.86 = **₹516** | 40 × ₹516 = ₹20,640 | **~₹22,700 – ₹26,800** |
| Utility (what we'd wish they were) | 600 × ₹0.115 = **₹69** | 40 × ₹69 = ₹2,760 | **~₹3,000 – ₹3,600** |

Against a hypothesized ₹4,999/yr Community Plus tier (see doc 16), Marketing-category invites alone would cost **4–5× the subscription price**, per community, every year. Even the ₹9,999 Premium tier would run at a loss on messaging alone. That's not a pricing problem we can tune away; it's a design that cannot ship.

### 2.3 The decision

Invites go out the way associations already send them: a committee member pastes a link (or a poster with a QR code) into the society's WhatsApp group. Meta isn't involved, nobody pays per message, and residents get the invite in the place they already read society news.

The Business API is kept only for what it's actually priced for: small volumes of opted-in, user-triggered Utility messages.

---

## 3. (a) Link and QR sharing — primary distribution

### 3.1 What Samskara provides

For every event (and every album), the committee gets a **Share** panel with:

- **A short link** — `samskara.app/c/<community-slug>/e/<event-slug>` (exact routing in doc 08). Opens the event page; unauthenticated viewers see only what the event's visibility scope allows (doc 15 §5).
- **A pre-written message** in English plus the community's chosen regional language, copy-to-clipboard, e.g.
  > 🪔 Diwali Mela 2026 — Sat 7 Nov, 6pm, Clubhouse lawn. RSVP and add your photos afterwards: samskara.app/c/…
- **A WhatsApp share button** using the standard `https://wa.me/?text=<encoded message>` deep link. This opens the user's own WhatsApp with the text pre-filled; *they* choose the group and press send. It's just a URL — no API, no Meta account, no cost.
- **A QR code** (PNG + printable A4 poster) for the notice board, lift lobby, and the event venue itself. A QR at the venue is the single best way to collect photos on the day ("scan to add your photos").
- **Post-event share** — the same panel on the album: "The Ganesh Chaturthi album is up — 412 photos. Add yours: …"

### 3.2 Why this is the better product, not just the cheaper one

- It meets residents in the group they already trust, sent by a neighbour they know, not by an unknown business number.
- It needs no phone-number collection, no opt-in, and no consent records from Samskara's side for distribution.
- It can't be spam-reported against our business number, which protects our sender quality rating for the transactional messages that do go through the API (shared with the family product — §7).

### 3.3 What we lose, honestly

- **No delivery/read tracking.** We can't know who saw the invite. Proxy metric instead: link-open counts per event (anonymous, aggregate) and RSVP counts.
- **No automatic reminders.** If the committee wants a reminder, they paste the link again. The Share panel can surface a "Post a reminder" nudge to the *committee member* in-app the day before — that's a nudge to a person, not a message to the community.

---

## 4. (b) Transactional notifications — narrow, opt-in only

### 4.1 Scope

Only messages that are (1) triggered by something the recipient did or explicitly asked for and (2) pass Meta's Utility review. Candidate templates for MVP:

| Template | Trigger | Expected category |
|---|---|---|
| `community_rsvp_confirmed` | Resident RSVPs to an event | Utility |
| `community_album_ready` | An album the resident opted to follow is published | Utility (needs Meta review — "the album is live" is transactional only if tied to the user's own follow/RSVP) |
| `community_upload_moderated` | A photo the resident uploaded was approved / held for review | Utility |

Every template is submitted to Meta and **its assigned category is checked before the feature is enabled.** If Meta classifies any of these as Marketing, that template is dropped, not reworded until it slips through.

### 4.2 Mirror the family product's consent split

The family product already got this right, and Communities copies the shape:

- `whatsapp_connections` (migration `20261001120000_whatsapp_integration.sql`) records that a user has linked a phone number — one row per user, unique phone number, created via a short-lived single-use link token.
- `whatsapp_notification_prefs` (migration `20261017200000_whatsapp_nudge_optin.sql`) is a **separate** table — `user_id`, `nudges_enabled boolean default false` — with own-row-only RLS.

Being connected is not permission to message someone proactively. Meta expects consent per message category, and so do residents.

For Communities, add a parallel, per-community preference rather than overloading the family flag:

```
community_whatsapp_prefs
  user_id         uuid  -> auth.users
  community_id    uuid  -> communities
  rsvp_confirmations   boolean default false
  album_ready          boolean default false
  moderation_updates   boolean default false
  opted_in_at / updated_at timestamptz
  primary key (user_id, community_id)
  RLS: read/write own row only
```

Rules:

1. **Default off, every flag.** Opting into the family product's nudges does not opt anyone into community messages, and vice versa.
2. **Opt-in is per community and per message type**, presented at the moment it's useful ("Want a WhatsApp message when this album is ready?"), not as a blanket checkbox at sign-up.
3. **Reuse `whatsapp_connections`** for the phone number itself — one verified number per user across both products — so we don't hold the same number twice.
4. **Replying STOP**, or toggling off in-app, clears the relevant flags immediately. Store the opt-out timestamp.
5. **Guests never receive API messages.** Guest contributors (doc 15 §3) have no account and therefore no prefs row.
6. Sends go through the same server-side path as the family product (service-role client from `api/_whatsappAuth.js`, Twilio signature validation on inbound webhooks), and every outbound send re-checks the pref row at send time, not at queue time.

### 4.3 Volume and cost expectations

The ~₹3,000–3,600/yr figure in §2.2 assumes *every* recipient gets *every* message at Utility rates. Real volume will be lower, because only opted-in residents receive anything and RSVP confirmations land inside the 24h service window (free) when the RSVP itself came via WhatsApp. We budget the ₹3–3.5k ceiling per community in doc 16 and measure actuals during the pilot.

Hard guardrail: a per-community monthly send cap (suggested 2,000 messages) with an alert to us, so a bug or misclassified template can't silently run up a Marketing-rate bill.

---

## 5. Out of scope (and why)

| Not doing | Why |
|---|---|
| Outbound event invites via API | Would be Marketing-category: ~₹22–27k/yr per 300-flat community (§2.2), more than any plausible subscription |
| Reminder blasts ("Mela starts in 2 hours!") | Same — Marketing category, same math, doubles the bill |
| Broadcast announcements from the committee | Marketing; also duplicates what the society group already does for free |
| "Message all residents" or bulk-send UI of any kind | No safe way to keep this Utility-only; removing the capability removes the risk |
| Ingesting photos from society WhatsApp groups | Group media can't be pulled via the Business API anyway; and it would bypass the children's-photo moderation default (doc 15 §2) |
| Samskara joining or administering society groups | No API path; and it would put us inside residents' private conversations |

Inbound 1:1 photo contribution over WhatsApp (as the family product does) is a possible **Phase 2** item — those are service conversations initiated by the user, so free — but it must route every photo through the same moderation pipeline as app uploads. Not in MVP.

---

## 6. Implementation notes (for doc 18 / backlog)

- Share panel and QR generation: pure front-end + a static QR library; no backend dependency.
- Link-open counter: anonymous aggregate counter per event; no per-viewer tracking (also consistent with DPDP's limits on tracking children — doc 15 §13.4).
- Templates: submit for Meta review early; approval and category assignment can take days.
- Per-community send cap and alert: required before the first transactional template goes live.

---

## 7. Open question for the product owner

**Shared or separate Twilio / Meta business account?**

The family product is currently going through Meta Business verification and WhatsApp Sender registration for its production number. If Communities uses the same Twilio account and Meta business, that verification is shared infrastructure — no second process. Trade-offs to decide (not assumed here):

- **Shared:** one verification, one number, one bill. But both products share one sender quality rating — a burst of spam reports from a community could throttle family-product messages. The sender display name would also have to fit both products.
- **Separate:** clean isolation of quality ratings and billing per product; a Communities-specific display name. Costs a second verification cycle and a second number.
- **Middle path:** same Meta business, separate phone number/sender under it — likely the best fit, but needs confirming against how Twilio and Meta handle multiple senders on one verified business.

Decision needed before any Communities template is submitted to Meta.
