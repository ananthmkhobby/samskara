# 20 — Pilot Validation Plan

**Status:** Draft v1 — written 2026-10-17, pending product-owner review

## 1. Purpose

Decision #2: validate real usage and willingness-to-pay with **one** community over **one full festival cycle** before building Phase 2. This doc defines how to pick the pilot, what to offer, what to measure, and what result means go or stop.

## 2. Selecting the pilot community

Must-haves:
- 100–500 flats, with an active, elected association committee.
- At least two community events in the pilot window, one of them a major festival (e.g. Ganesh Chaturthi, Navratri/Durga Puja, Diwali, Pongal/Sankranti, Onam — depending on region).
- A named committee champion who will create events, moderate, and share links in the society WhatsApp groups.
- Evidence of the pain: photos currently scattered across WhatsApp and/or one volunteer's Google Photos/Drive.
- Committee willing to sign a short pilot agreement covering the children's-photo policy and data handling.

Prefer:
- A society with a recent or upcoming committee change (tests the durability claim directly).
- Mixed owner/tenant population (exercises move-out handling).
- **Not** a society where the champion is a close personal contact of the founder — friendly pilots inflate willingness-to-pay.

Shortlist 3–5 candidates, interview the committee of each, pick one, keep one as backup.

## 3. Terms to offer

- Free for the pilot window (event cycle + ~4 weeks after the last event).
- Written commitment: the archive is retained for at least 12 months after the pilot whether or not they pay, and is exportable. (Without this, we are asking them to trust a product whose pitch is durability while threatening to delete it.)
- Explicit statement up front that at the end we will ask whether they'd pay ₹X/yr to continue. Telling them in advance makes the end question honest rather than a surprise.
- Samskara does onboarding: provisioning, creating QR posters for the event venue, a 15-minute walkthrough for committee moderators.

## 4. What to measure

### Usage (from doc 17 M9 stats, plus manual notes)
| Metric | Definition |
|---|---|
| Resident adoption | Households with ≥1 active member ÷ total flats |
| Contributor breadth | Distinct uploaders per event |
| Contribution volume | Approved items per event; items per contributor |
| Committee engagement | Events created by committee (not us); median moderation latency; % queue cleared within 72h |
| Return visits | Residents who view the gallery in the week *after* an event |
| Children's-photo load | % uploads marked/defaulted as containing children; flags/takedowns; time to resolve |
| Moderation burden | Moderator self-reported minutes per event |

### Willingness to pay (the critical signal — asked, not inferred)
Near the end of the pilot, in a meeting with the committee (ideally including the treasurer):
1. "Would the association renew at **₹4,999/year**?" — yes / no / maybe-with-conditions.
2. If no: "At ₹2,499?" If yes: "At ₹9,999?"
3. "Who would approve this spend, and from which budget head?"
4. Ask for a **non-binding letter of intent or a pre-payment** at the stated price. A signed intent or payment is the strongest signal; a verbal yes is weak.

Also ask a sample of 10–20 residents: would you personally want a "copy to my family archive" feature (informs Phase 2 P2a), and would you pay individually for anything?

## 5. Decision gate

| Outcome | Signal | Decision |
|---|---|---|
| **Build Phase 2** | Committee commits (LOI or payment) at ≥ ₹4,999/yr **and** adoption ≥ ~30% of households **and** committee ran at least the last event without our help | Proceed to Phase 2; recruit 2–3 more paying communities in parallel |
| **Iterate** | Strong usage but price "no" at ₹4,999, yes at a lower tier; or price yes but usage thin | Run a second pilot with a changed variable (price, community type, or feature) before Phase 2 |
| **Stop as a paid product** | Committee declines at all tested price points **or** adoption < ~10% of households **or** committee stopped moderating mid-pilot | Do not build Phase 2. Options: keep as a free feature funnelling to the family product, or shelve |

Thresholds above are starting proposals; the product owner should fix them **before** the pilot starts so the result can't be rationalised afterwards (OD-8).

## 6. Risks to the validity of the pilot
- Single community = small sample; a "yes" proves possible, not repeatable.
- Free pilot can attract usage that disappears at any price.
- Champion dependency: if the champion leaves mid-pilot, record it — it is itself evidence about the durability thesis.
