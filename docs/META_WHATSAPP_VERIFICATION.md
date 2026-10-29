# Meta Business verification & Twilio WhatsApp production setup

This is action item #10 from `docs/ARCHITECTURE_REVIEW.md` — the one
remaining gap between "WhatsApp works" (true today, but only on Twilio's
Sandbox number) and "WhatsApp works for real on `oursamskara.com`"
(not yet true). Everything below is account-level work on Meta's and
Twilio's own sites — none of it is a code change, and none of it can be
done by an AI agent on your behalf; it needs your own login on both
platforms and, in a couple of places, your own judgment calls about the
business.

**Current state, verified 2026-10-29**: `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM` have been empty in the
production Vercel project since it was created (2026-10-15) — this was
never filled in, not something that broke. The WhatsApp feature has
never actually sent a message on `oursamskara.com`; everything that's
been tested so far ran on Twilio's shared Sandbox number.

## Why this takes several steps, not one

Meta's WhatsApp Business Platform treats "a business can message
someone" as a privilege it grants in stages, not a toggle: first you
prove you're a real business, then you register a number and give it a
display name (which Meta itself reviews, separately), then every
message *type* you plan to send outside a live conversation needs its
own pre-approved template. Skipping ahead at any step just means the
later step fails or silently doesn't apply (e.g. a custom display name
that shows only in tiny contact-view text until Business verification
is done).

## Step 1 — Meta Business verification

1. Go to [business.facebook.com](https://business.facebook.com) and
   create (or sign into) a Meta Business Account for Samskara, if one
   doesn't exist yet.
2. In Business Settings → Security Center, start **Business
   verification**. You'll need: a registered business name/entity (or
   your own name if operating as an individual/sole proprietor — Meta
   supports this), a business email on the same domain as
   `oursamskara.com` if possible, and a phone number for a verification
   call/SMS. Meta may also ask for a business document (registration
   certificate, tax ID, or similar) depending on your region and
   business type.
3. This step is free and separate from "Meta Verified" (the paid
   blue-checkmark product) — don't pay for anything here.
4. Verification can take anywhere from a few hours to a few days. You'll
   get an email/notification when it resolves.

**Why this has to happen first**: a custom WhatsApp display name (Step 2)
only shows to recipients once this is done — before that, they see the
number in a reviewed-but-unverified state, which looks untrustworthy for
a family-archive product asking people to trust it with photos.

## Step 2 — Register a real Twilio WhatsApp Sender

1. In the [Twilio Console](https://console.twilio.com), go to
   Messaging → Senders → WhatsApp senders (or search "WhatsApp Senders"
   in the console).
2. Either port an existing business number or buy a new one through
   Twilio specifically for this. A number already used for personal
   WhatsApp can't be reused — WhatsApp Business numbers must not have an
   active personal WhatsApp account on them.
3. Start Sender registration, linking it to the Meta Business Account
   from Step 1 (Twilio's flow walks you through connecting the two).
4. Set **Business Display Name = "Samskara"** during this registration.
   Meta reviews the name itself (separately from the number) — a name
   that looks like a generic phrase, contains unrelated terms, or isn't
   recognizably tied to the business can be rejected. "Samskara" is
   distinctive and matches the product's own branding, so it should pass,
   but confirm the registration actually shows **Approved** status
   before moving on — a rejected name caps the sender at 250
   business-initiated conversations per 24 hours, which would silently
   throttle real usage.
5. Once approved, note the full number in Twilio's `whatsapp:+1XXXXXXXXXX`
   format — that's the exact value `TWILIO_WHATSAPP_FROM` needs (see
   Step 4).

**Register this one sender first and confirm it before doing anything
else** — every other step depends on it existing and being approved.

## Step 3 — Submit Content Templates for every non-reply message type

Any message Samskara sends *first* (not as a direct reply within 24
hours of the person's own last message) needs a pre-approved template.
Meta classifies each one as **Utility** (tied to the recipient's own
pending action — cheaper, safer for the number's quality rating) or
**Marketing** (costlier, riskier if people mute/report it) — you don't
choose the category, Meta assigns it based on the content.

Submit templates for, at minimum:

1. **The photo-identification ask** (`api/ask-family-photo-id.js`) — the
   existing "help us identify who's in this photo" message. This
   already works on Sandbox; it still needs its own approved template
   under the production account specifically, since Sandbox approval
   doesn't carry over.
2. **The nudge message** (`20261017200000_whatsapp_nudge_optin.sql`'s
   feature) — "N items are waiting for your review," sent to an
   opted-in Head/Admin. This is the one that fills
   `TWILIO_NUDGE_TEMPLATE_SID` (see Step 4) — Twilio's content template
   flow gives you a Content SID (`HXxxxxxxxx...`) once Meta approves it,
   and that SID is what the env var holds, not the template text itself.

Submit each via Twilio Console → Content Template Builder (it submits to
Meta on your behalf) or directly in Meta Business Manager's WhatsApp
Manager. Review time is typically minutes to a day. A template can be
rejected for being too generic, containing a placeholder Meta reads as
spam-like, or not matching its claimed category — if rejected, the
rejection reason is specific; fix and resubmit rather than appealing
blind.

**Do not point production traffic at a message type whose template isn't
Approved yet** — an unapproved template fails to send, visibly, to a
real person expecting it.

## Step 4 — Point the app at the new number

Once Steps 1–3 are done, in the **production** Vercel project
(`samskara-prod`) set:

```
TWILIO_ACCOUNT_SID=<your Twilio Account SID>
TWILIO_AUTH_TOKEN=<your Twilio Auth Token>
TWILIO_WHATSAPP_FROM=whatsapp:+1XXXXXXXXXX   # the approved Sender number
TWILIO_NUDGE_TEMPLATE_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   # from Step 3's nudge template
```

No code change needed — `api/whatsapp-webhook.js` already reads these at
request time, and `validateTwilioSignature()` keys off `APP_URL` (already
set), not the number, so this is a pure config cutover. Also set
`VITE_WHATSAPP_DISPLAY_NUMBER` to the new number's human-formatted form
(e.g. `+1 415 523 8886`) — this is the one WhatsApp-related variable
exposed to the browser, shown on the login page and the Connect-on-
WhatsApp explainer; keep it in sync with `TWILIO_WHATSAPP_FROM` since
they're not read from the same source.

Leave the **test** project (`samskara-koaham.vercel.app`) pointed at the
Sandbox number, unchanged — same reasoning as the two projects' separate
Supabase databases: disposable test traffic should never touch a real,
rate-limited production number.

## Step 5 — Point Twilio's webhook at production

In the Twilio Console, under the new Sender's configuration, set the
incoming-message webhook URL to:

```
https://oursamskara.com/api/whatsapp-webhook
```

(POST, same as the Sandbox number's existing webhook config — just a
different destination.)

## Verification checklist before calling this done

- [ ] Meta Business verification shows **Verified** in Business Settings
- [ ] The Twilio WhatsApp Sender shows **Approved**, display name
      "Samskara"
- [ ] Every template from Step 3 shows **Approved** in Twilio's Content
      Template dashboard
- [ ] `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM`
      / `TWILIO_NUDGE_TEMPLATE_SID` all set in the **production** Vercel
      project only
- [ ] `VITE_WHATSAPP_DISPLAY_NUMBER` updated to match
- [ ] Webhook URL updated in Twilio to point at `oursamskara.com`
- [ ] Send a real test message to the new number from your own phone —
      confirm you get the "connect your account" link back, confirm
      connecting it actually works end to end (same flow
      `docs/WHATSAPP_GUIDE.md` describes)
- [ ] Trigger the nudge path for real (or via the superadmin test tools)
      and confirm it arrives using the new approved template, not a
      Sandbox leftover
- [ ] Confirm the display name "Samskara" actually shows in a real
      WhatsApp chat window (not just Twilio's dashboard) — this is the
      one thing that needs Business verification to be fully done first
      to render correctly

## What stays out of scope here

- Any message type Meta would classify as **Marketing** (a promotional
  push, not tied to the recipient's own pending action) — out of scope
  until there's a dedicated Marketing-category opt-in flow and a
  tolerance for its higher cost and quality-rating exposure. Nothing in
  this app currently sends that category.
- A recurring (e.g. weekly) digest message — not built, and was
  explicitly deferred in the original feature plan pending this exact
  production-number setup.
