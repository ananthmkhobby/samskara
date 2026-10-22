# 16 — Monetization and Cost Model

**Status:** Pilot-first. **All prices in this document are unvalidated hypotheses.** Cost figures are estimates to be replaced with pilot actuals.
**Related:** 13-whatsapp-integration.md (messaging costs), 15-security-and-privacy.md.

---

## 1. Strategy: validate before pricing

The original brief proposed four tiers:

| Tier | Hypothesized price | Status |
|---|---|---|
| Starter | Free / low-cost pilot | Hypothesis |
| Community Plus | ~₹4,999/yr | **Unvalidated** |
| Community Premium | ~₹9,999/yr | **Unvalidated** |
| Enterprise | Custom | Hypothesis |

None of these numbers have been tested with a single paying association. And the market signal we do have points the wrong way: Indian resident associations are price-resistant — MyGate reportedly moved from per-flat charging to free — and we have no confirmed current pricing for either major competitor (doc 02).

So the MVP doesn't optimise for a tier structure. It optimises for **one real community, through one full festival cycle**, free or heavily discounted, with the explicit goal of finding out whether anyone will pay, how much, and for what. Tier design comes after.

---

## 2. Cost model

### 2.1 Pilot-scale assumptions

One community, 300 flats, ~600 residents, **15 events/year** (midpoint of 10–20).

| Input | Assumption | Reasoning |
|---|---|---|
| Photos per event | 400 | 30–40 contributors × ~10–15 each, after dedup |
| Stored photo size | ~1.5 MB (resized original) + ~0.2 MB (display/thumbnails) | Phone originals are 3–5 MB; we store a resized master, not raw |
| Video per event | 10 clips × 50 MB | Short phone clips, capped length |
| Active viewers per event | 300 | Half the community |
| Viewed per viewer per event | 100 thumbnails + 20 full images + 2 videos | Browsing, not downloading everything |

### 2.2 Storage

- Photos: 15 × 400 × 1.7 MB ≈ **10.2 GB/yr**
- Video: 15 × 10 × 50 MB ≈ **7.5 GB/yr**
- **Total ≈ 18 GB/year**, accumulating (≈36 GB by year 2).

### 2.3 Bandwidth (egress)

Per viewer per event: 100 × 0.05 MB + 20 × 1.5 MB + 2 × 50 MB ≈ 135 MB
→ 300 viewers × 15 events × 135 MB ≈ **~610 GB/year ≈ ~50 GB/month**, peaking in festival months (Navratri/Diwali could be 3× a quiet month).

Video dominates egress. Capping clip length and serving a compressed rendition is the single biggest lever here.

### 2.4 Line items

Exchange rate used throughout: **US$1 ≈ ₹85**. Vendor prices to be re-checked before budgeting.

| Line item | Basis | Annual cost | Fixed or per-community |
|---|---|---|---|
| **Supabase Pro** | $25/mo; includes 100 GB storage, 250 GB egress/mo | $300 ≈ **₹25,500** | Fixed (shared with family product, if already on Pro) |
| Supabase overage | Pilot fits inside included quotas (18 GB storage, ~50–150 GB/mo egress) | **₹0** at pilot scale | Per-community, at scale |
| **Vercel Pro** | $20/mo/seat — committed cost (project already hit Hobby-plan function limit) | $240 ≈ **₹20,400** | Fixed, shared with family product |
| **Twilio/WhatsApp — Utility only** | Doc 13 §2.2: 24,000 msgs × ₹0.115 + 10–30% markup | **₹3,000 – ₹3,600** (ceiling; likely lower with partial opt-in) | Per-community |
| **OpenAI — existing-pattern features only** | Transcription of short voice notes/captions: ~450 min/yr × $0.006 ≈ $2.70; dedup via perceptual hashing (no API) or cheap embeddings ≈ $1–3 | **~₹500** | Per-community |
| Payment gateway (when charging) | ~2% of revenue | ~₹100–200 | Per-community |
| **Total marginal per community** | | **~₹3,600 – ₹4,300/yr** | |
| **Total fixed platform** | | **~₹46,000/yr** | Shared |

Explicitly **not** in this model:
- **Marketing-category WhatsApp invites.** At ~₹22–27k/yr per community (doc 13) they'd be the largest line item by far. They're designed out.
- **AI-heavier features** (auto-curation, generated event films, captioning every photo with vision models). Deferred; cost them only if they ship.
- Supabase overage at scale: at 50+ communities, storage (~₹1.8/GB/mo at $0.021/GB) and egress (~₹7.6/GB at $0.09/GB beyond quota) start to matter — e.g., 50 communities × 50 GB/mo egress ≈ 2.5 TB/mo, ~2.25 TB over quota ≈ **₹17k/month**. Video is the variable to watch.
- GST (18% on SaaS) is charged on top of price and passed through; it isn't margin.
- Our own time, support, and onboarding — real, but not cash cost at pilot stage.

### 2.5 The headline

The **marginal cost per community is ~₹4k/year, and ~80% of it is WhatsApp Utility messaging.** Storage and compute are close to free at pilot scale because they ride on infrastructure the family product already pays for.

---

## 3. Gross-margin sanity check (against unvalidated prices)

| | Community Plus (hyp. ₹4,999) | Community Premium (hyp. ₹9,999) |
|---|---|---|
| Marginal cost (WhatsApp at ceiling) | ~₹4,300 | ~₹4,300 + extra storage/video ≈ ₹5,000 |
| **Gross margin** | **~₹700 (~14%)** | **~₹5,000 (~50%)** |
| Marginal cost (WhatsApp at 30% opt-in ≈ ₹1,100) | ~₹1,800 | ~₹2,500 |
| **Gross margin** | **~₹3,200 (~64%)** | **~₹7,500 (~75%)** |

Fixed platform cost (~₹46k/yr) breaks even at roughly **15 Plus communities at realistic opt-in**, or ~65 at the messaging ceiling.

What this tells us:

1. **The Plus tier only works if WhatsApp opt-in is partial, or if WhatsApp notifications aren't in it.** Options: make transactional WhatsApp a Premium feature; use in-app/email/web-push notifications (near-zero cost) as the default and WhatsApp as the upgrade; or cap WhatsApp messages per community per year.
2. **Pilot opt-in rate is the most important cost number we don't have.** Measure it.
3. Premium's margin is comfortable, but only if associations actually pay ₹9,999 — which is exactly what we don't know.

All margin figures inherit the unvalidated prices; treat them as "is this obviously broken?", not a forecast.

---

## 4. Optional paid add-ons — Phase 2+

The brief mentioned yearbooks, printed photo books, and curated event films.

| Add-on | Why it's attractive | Why not MVP | Verdict |
|---|---|---|---|
| **Annual yearbook (PDF/digital)** | Natural year-end artefact; low marginal cost; could be the thing committees show at the AGM | Needs a year of content to exist; layout tooling is real work | **Phase 2.** Good first add-on candidate — ask about it in the pilot (§5) |
| **Printed photo books** | Clear willingness to pay for physical keepsakes; one-off purchase, not subscription | Print partner, fulfilment, returns, colour quality, and a fresh consent step for every photo used (doc 15 §4) — especially photos with children | **Phase 2+.** Only with a print-on-demand partner; never inventory |
| **Curated event films** | High perceived value for weddings-scale events like Durga Puja | Either human editing (doesn't scale) or AI-heavy generation (cost and quality unknown); large video egress | **Phase 3 / don't plan for it.** Revisit if the pilot shows strong demand |

None of these get MVP attention. They're possible revenue lines for a community that already values the archive — they can't create that value.

---

## 5. Validating willingness to pay during the pilot

### 5.1 Pilot terms

- One community, one full festival cycle (e.g., Ganesh Chaturthi → Navratri → Diwali, or Pongal/Sankranti → Ugadi/Vishu depending on region).
- Free, or a token amount (e.g., ₹999) — paying anything at all is a stronger signal than free.
- Tell the committee upfront: at the end, we'll propose a price and ask whether they'd renew.

### 5.2 Measure (in-product, no extra tracking of individuals)

| Signal | What "real product" looks like | What "nice-to-have" looks like |
|---|---|---|
| Contributor breadth | 15%+ of households upload at least once | Only committee members upload |
| Return after the event | Album views continue 2+ weeks post-event | Views die within 48 hours |
| Event-to-event pull | Committee creates the next event without being prompted | We have to nudge every event |
| Moderation burden | Moderators clear the queue within a few days | Queue backs up; committee asks us to "turn off" the children hold |
| WhatsApp opt-in rate | Measure it — drives cost (§3) | — |
| Family-archive linking | Residents link community photos into family trees | Nobody does |
| Organic spread | A neighbouring society or resident asks how to get it | No inbound interest |

### 5.3 Ask (committee interview at end of cycle, and a short resident survey)

Committee:
1. What did you use before for event photos? What did it cost — in money and in volunteer time?
2. If we stopped tomorrow, what would you miss?
3. Who in the association approves spending like this, and from which budget (events fund vs. maintenance)?
4. Would you pay ₹4,999 a year? ₹9,999? (Ask a Van Westendorp-style ladder: too cheap / bargain / getting expensive / too expensive.)
5. Would you pay more for a printed or digital yearbook at year-end?
6. Would you rather the association pay, or residents opt in individually?

Residents (3–4 questions max):
1. Did you look at the albums? Did you add photos?
2. Would you be upset if it went away?
3. Would you pay ₹X personally for the yearbook / prints?

### 5.4 Decision criteria

- **Build the paid tier** if the committee says yes to a specific price *and* names the budget it comes from, and at least four of the seven §5.2 signals look like "real product".
- **Rethink the model** (resident-paid add-ons, yearbook-only revenue, or bundling into the family subscription) if usage is strong but the committee won't pay.
- **Stop or reposition** if usage is committee-only and dies between events — that's a nice-to-have, whatever anyone says in an interview.

One pilot is a weak sample. A positive result justifies a second and third pilot at a real price, not a pricing page.

---

## 6. Open assumptions needing pilot data

1. Every price in §1 and §3.
2. WhatsApp opt-in rate (largest driver of marginal cost).
3. Photo/video volume per event and the 1.5 MB stored-size assumption.
4. Whether video should be capped or premium-only, given it drives most egress.
5. Whether the association, or individual residents, are the buyer.
6. Whether Supabase Pro is already paid for by the family product (if not, it becomes a new fixed cost attributable to Communities).
7. How fixed costs (Vercel Pro, Supabase Pro) should be allocated between the family product and Communities.
