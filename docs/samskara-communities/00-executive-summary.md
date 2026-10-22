# 00 — Executive Summary: Samskara Communities

**Status:** Planning / pre-design-doc. Per `docs/SDLC.md`, this vertical touches data model, auth, money and privacy, so a formal design doc is required before any migration lands.

## What it is

Samskara Communities is a new vertical of the Samskara family-archive app for **residential apartment societies in India** (pilot scope: one society of 100-500 flats). It gives a society a durable, moderated archive of its shared life: festival and event photos, organized by year and event, curated by the association committee, with optional, permission-based links from a resident's community memories into their own personal Samskara family archive.

It is **not** an apartment-management app. No visitor management, billing, maintenance dues, parking or security. That ground belongs to NoBrokerHood and MyGate, and we do not compete there.

## Why now

- The Samskara platform already has the hard parts: multi-tenant membership (`family_members`, `current_family_id()` in `supabase/migrations/20260726120000_multi_family_membership.sql`), a media pipeline with perceptual-hash dedup (`src/lib/imageHash.js`), a Pending/Verified/Rejected moderation pattern, and plan tiers (`src/lib/planTiers.js`). Communities is mostly an extension of existing patterns, not a new product from scratch.
- From the research done so far, no ops app (NoBrokerHood, MyGate) offers a community-memory or archive feature today, so that space looks open.
- India's DPDP Act rules were notified in November 2025, and the core obligations come into force around May 2027. Building consent handling for children's photos in from the start is cheaper than adding it later.

## Core differentiation: institutional continuity

The real alternative today is free: **a Google Photos shared album or a WhatsApp group run by one volunteer.** That works until the volunteer moves out, steps down from the committee or stops looking after it. The archive is tied to one person's account. Samskara Communities makes the **society** the owner of its archive. Committee roles hand over, households move in and out, and the archive stays. Moderation and a year/event structure come on top of that, but continuity is the reason someone would pay.

## Strategy: pilot first

We will **not** build the full brief and then look for customers. The MVP is cut down to what one real pilot society (free or heavily discounted) needs to get through **one full festival cycle**: onboarding, event creation, QR/link uploads, moderation, a year/event timeline. After that we measure real usage and willingness to pay before building anything more.

Locked decisions:
1. Invites go out only as free links or QR codes that the association shares in its own WhatsApp groups. **No outbound WhatsApp Business API invites.** Those count as Marketing-category messages, and at 300 flats they would cost about ₹21-25k/year, which is more than the subscription.
2. Pilot first, as described above.
3. Upgrade to **Vercel Pro**, because the project is already at the 12/12 function cap on Hobby.
4. **Any photo containing a child stays moderation-only** until a committee moderator explicitly approves it.

## The single biggest risk

**Willingness to pay has not been validated.** Associations resist paying; MyGate reportedly went from charging per flat to free. The proposed ₹4,999-9,999/year tiers are guesses. We also have no distribution advantage over the ops apps, and a two-sided cold start (committee as gatekeeper, plus resident adoption). The pilot exists to test willingness to pay before anything else gets more investment.
