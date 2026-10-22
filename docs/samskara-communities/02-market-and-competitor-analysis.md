# 02 — Market and Competitor Analysis

> **Evidence key.** **[Confirmed]** = found in research. **[Inferred]** = our reasoning from the evidence. **[Unverified]** = flagged by the research pass as not checked against a primary source. Re-check all [Unverified] items before pricing or committing to a GTM plan.

## 1. Market framing

- Target: organized residential societies in Indian metros with an active association committee and a cultural calendar. Pilot size: 100-500 flats.
- Buyer: the association or management committee (holds the budget, acts as gatekeeper). Users: residents, the cultural committee, event photographers.
- **[Inferred]** The market is large in count but low in willingness to pay per society. Societies already spend on ops apps and treat "community software" as something that should be cheap or free.

## 2. Competitive landscape

### 2.1 NoBrokerHood and MyGate (ops apps)

- **[Confirmed]** Both are society-operations tools: visitor/gate management, billing, helpdesk, notices. NoBrokerHood claims 18k+ societies.
- **[Confirmed, with a caveat]** The research found **no gallery, archive or community-memory feature** in either.
- **[Unverified]** Their exact current feature sets. Product pages were not opened directly, so a small gallery/notice-attachment feature could exist and not have been found. **Action:** check manually with the live apps before pitching "nobody does this".
- **[Inferred]** They hold the distribution: they are already installed in thousands of societies and already in the committee's workflow. If they decide to add an "event photos" tab, they can ship it to their whole installed base faster than we can win one pilot.

**Implication, the no-moat risk.** We have **no speed or first-mover advantage**. We cannot win on "first to market". We must win on **durability and trust**: an archive that outlives committee terms and household moves, moderation that committees trust, and a careful approach to children's photos. A gallery tab added to an ops app is likely to be shallow (no year/event curation, no family-archive bridge). Our pitch must make that depth obvious.

### 2.2 Google Photos shared albums (the real alternative)

- **[Confirmed]** Free and familiar. It is the "good enough" incumbent.
- **[Confirmed]** Weaknesses relevant to us:
  - no moderation workflow (anyone with access adds anything),
  - no year/event structure beyond album names,
  - **ownership tied to one individual's account**. When the volunteer leaves, stops paying for storage or deletes their account, the archive is gone or orphaned.
- **[Unverified]** Current Google Photos shared-album limits (member caps, photo caps, storage counting against the owner's quota). Check before quoting specifics in sales material.

### 2.3 WhatsApp groups

- **[Inferred]** This is where photos are actually shared today. Media gets compressed, expires from phones and can't be searched. It is not a competitor as an archive. It is the **distribution channel** we piggyback on (decision #1).

### 2.4 Comparison

| Capability | NoBrokerHood / MyGate | Google Photos shared album | WhatsApp group | **Samskara Communities** |
|---|---|---|---|---|
| Visitor/billing/ops | Yes | No | No | **No (by design)** |
| Event/festival archive | Not found [Unverified] | Ad hoc | No | **Yes, year → event → album** |
| Moderation workflow | Not found | No | Admin-only removal | **Yes, Pending/Approved/Rejected** |
| Survives volunteer leaving | n/a | **No** (individual-owned) | Partial | **Yes, community-owned** |
| Children's-photo protection | Unknown | No | No | **Moderation-only by default** |
| Link to personal family archive | No | No | No | **Yes, opt-in** |
| Installed base in societies | **Very large** | Universal | Universal | Zero |
| Price to society | Low / free trend | Free | Free | Hypothesis: ₹4,999-9,999/yr |

## 3. Pricing resistance

- **[Confirmed, reported]** MyGate reportedly moved from a per-flat charge to free for societies. This shows strong price resistance from associations.
- **[Inferred]** Committee budgets need approval from the general body. A new, non-essential line item is a hard sell, and harder when Google Photos is free.
- **Status of our tiers:** ₹4,999-9,999/year are **unvalidated hypotheses**. They are not market prices. The pilot is free or heavily discounted and exists to answer these questions:
  1. Would this committee pay at all after one festival cycle?
  2. Who pays: the association fund, the cultural committee, or individual residents (for example through the family-product upsell)?
  3. What price feels trivial to them (the ₹2-3/flat/month range is a candidate to test)?
- **[Inferred] Alternative revenue path:** if societies won't pay, Communities may still be worth it as an acquisition channel for the paid family product. Track resident to family-archive conversion during the pilot.

## 4. WhatsApp cost math: correction to the original brief

The original brief assumed Samskara would send event invites over the WhatsApp Business Platform. **That assumption has been reversed.**

### 4.1 Category classification
- **[Inferred, high confidence]** Meta would almost certainly classify outbound event invites ("Join us for Diwali, upload your photos") as **Marketing**-category template messages. Utility category covers transactional updates tied to a user action or account, not promotion.

### 4.2 Cost at pilot scale
Assumptions: 300 flats, about 20 events/year, roughly one invite plus one reminder per flat per event.

| Category | Use | Est. annual cost |
|---|---|---|
| Marketing | Event invites/reminders | **~₹21-25k/year** |
| Utility | Opted-in transactional ("your album is ready") | **~₹3-3.5k/year** |

- **[Unverified]** These figures come from the research pass's reading of India per-message rates. The **official Meta rate card was not confirmed** against the primary source. Treat them as order-of-magnitude, and re-check before the blueprint's cost-model document is finalized.
- **Conclusion:** Marketing-category invites alone would cost **more than the whole proposed subscription**. Unit economics don't work.

### 4.3 Resulting distribution strategy (decision #1)
- Samskara generates a **free link and QR code** for each community and event.
- The **association shares them** in its own existing WhatsApp groups, on notice boards and at the event venue (QR standee).
- Samskara **never** sends outbound Business API invites.
- Twilio/WhatsApp is used only for **opted-in Utility messages**. The existing Twilio signature-validation helper and `serviceClient()` pattern are reused. The conversation engine in `api/whatsapp-webhook.js` is not.
- **Side effect:** the committee must actively share the link, so committee buy-in matters even more (see the cold-start risk below).

## 5. Regulatory context: DPDP Act

- **[Confirmed]** DPDP Rules were notified in November 2025 with a staggered rollout. Core obligations (notice/consent, security safeguards, breach reporting, **verifiable parental consent for under-18s**) are not enforced until about **May 2027**.
- **[Inferred]** The children's surface is **much larger** for Communities than for the family product. One festival photo can capture dozens of children from other households, and none of their parents have any way to consent. Hence decision #4: photos with children stay moderation-only until a committee moderator approves them. Designing this in now avoids a retrofit before May 2027.

## 6. Risks from this analysis

| # | Risk | Mitigation |
|---|---|---|
| R1 | WhatsApp invite cost exceeds revenue | Free link/QR only; Utility-only messaging |
| R2 | No distribution moat vs. ops apps | Compete on durability/trust and depth; pilot proof |
| R3 | Willingness to pay not validated | Pilot-first; explicit pricing conversation after the festival cycle |
| R4 | Two-sided cold start (committee + residents), no network-effect carryover from the family product | One champion committee member per pilot; QR at venue; zero-signup upload path |
| R5 | Children's-photo consent at scale | Moderation-only default (decision #4) |

## 7. Open research items

1. Open the MyGate and NoBrokerHood apps and product pages directly to confirm there is no gallery/archive feature.
2. Confirm the current Meta WhatsApp India rate card for Marketing vs. Utility.
3. Confirm Google Photos shared-album limits and ownership behavior when the owner's account is deleted.
4. Interview 3-5 committee members on budget authority and acceptable price.
