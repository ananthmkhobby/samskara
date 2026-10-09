// The WhatsApp conversation state machine. Pure-ish: takes the current
// conversation row + the inbound message, returns what to say back and what
// (if anything) to save — the webhook handler does all the actual reading
// and writing. Kept separate from webhook.js so the "what happens at each
// step" logic can be read and changed without wading through Twilio
// plumbing.
//
// AI involvement in this MVP is zero — person matching is a plain name
// search (same substring approach as the in-app Search page,
// src/components/SearchView.jsx), and nothing is ever saved without an
// explicit YES. Matches the spec's "AI MUST NOT automatically create
// relationships or modify genealogy without confirmation" even though this
// pass doesn't call an AI model at all yet.

const YES = /^(y|yes|yep|yeah|ok|okay)$/i;
const NO = /^(n|no|nope)$/i;
const SKIP = /^skip$/i;
const CANCEL = /^cancel$/i;
const FAMILY_COMMAND = /^(family|families|switch family|switch)$/i;
// Someone saying hello or asking for help shouldn't be captured as the
// opening line of a memory — without this, "Hi" became `memoryText: "Hi"`
// and the bot asked "who is this about?", which reads as broken.
const GREETING = /^(hi+|hello+|hey+|hola|yo|namaste|namaskara|namaskaram|help|menu|start)$/i;
// "family" is deliberately not one of SHARE's words — FAMILY_COMMAND is
// only ever checked in the IDLE entry branch below, never inside
// WAITING_FOR_PRIVACY_CHOICE, so there's no real collision either way, but
// keeping them visually distinct avoids the two ever being confused later.
const PRIVATE_RE = /^(private|priv|just me|only me)$/i;
const SHARE_RE = /^(share|shared|everyone|all|public)$/i;

const MEDIA_PROMPT = {
  photo: "Beautiful memory ❤️\nWho is in this, or who is this about?",
  audio: "Who is in this, or who is this about?",
  document: "Got it — who is in this, or who is this about?",
};

const STORY_PROMPT = {
  photo: "Tell me anything you remember about this photo.",
  document: "Tell me anything you remember about this document.",
};

async function searchPeople(supabase, familyId, term) {
  const { data, error } = await supabase
    .from("people").select("id, name").eq("family_id", familyId)
    .ilike("name", `%${term.trim()}%`).limit(5);
  if (error) throw new Error(error.message);
  return data || [];
}

function personPromptAfterSkip() {
  return "No problem — who is it? Tell me their name, or reply SKIP to save this without linking it to a person.";
}

function helpReply(memberships) {
  return "Send me a photo, voice note, document, or tell me about a memory, and I'll help preserve it for your family."
    + (memberships && memberships.length > 1 ? "\n\n(Reply FAMILY to switch which family I save things to — you're connected to more than one.)" : "");
}

// Shared by the first attempt at a name (WAITING_FOR_PERSON) and by a
// WAITING_FOR_PERSON_CONFIRMATION reply that wasn't YES/NO — in both cases
// the caller just told us a name and we need to search for it fresh.
async function matchPersonReply(supabase, familyId, ctx, text) {
  const matches = await searchPeople(supabase, familyId, text);
  if (matches.length === 1) {
    const next = { ...ctx, candidatePersonId: matches[0].id, candidatePersonName: matches[0].name };
    delete next.candidates; delete next.allowSkip;
    return { reply: `I found ${matches[0].name} in your family tree.\nIs this the person? Reply YES or NO.`, nextState: "WAITING_FOR_PERSON_CONFIRMATION", pendingPersonId: null, context: next, contributions: [] };
  }
  if (matches.length > 1) {
    const list = matches.map((m, i) => `${i + 1}. ${m.name}`).join("\n");
    const next = { ...ctx, candidates: matches.map((m) => ({ id: m.id, name: m.name })) };
    delete next.allowSkip;
    return { reply: `I found a few people named like that:\n${list}\n\nReply with the number, or send a different name.`, nextState: "WAITING_FOR_PERSON", pendingPersonId: null, context: next, contributions: [] };
  }
  const next = { ...ctx, allowSkip: true };
  delete next.candidates;
  return { reply: "I couldn't find that person in your family tree.\nYou can try a different name, or reply SKIP to save this as an unassigned family memory for now.", nextState: "WAITING_FOR_PERSON", pendingPersonId: null, context: next, contributions: [] };
}

// Only meaningful for someone in more than one family (married-in members
// linked to both their own and their spouse's tree) — a single-family
// account just gets told so and stays IDLE, since there's nothing to pick.
function buildFamilySwitchPrompt(memberships) {
  if (!memberships || memberships.length <= 1) {
    const name = memberships?.[0]?.familyName || "your family";
    return { reply: `You're only connected to one family on Samskara right now: ${name}.`, nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [] };
  }
  const list = memberships.map((m, i) => `${i + 1}. ${m.familyName}`).join("\n");
  return {
    reply: `Which family should I save things to from now on?\n${list}\n\nReply with the number.`,
    nextState: "WAITING_FOR_FAMILY_SWITCH",
    pendingPersonId: null,
    context: { familyOptions: memberships.map((m) => ({ id: m.familyId, name: m.familyName })) },
    contributions: [],
  };
}

// Builds the final contribution rows for a resolved memory. Mirrors exactly
// what a manual ContributeModal submission produces (api callers insert
// into `contributions` the same way) — a photo/document comes with its own
// row, and a story (if any) becomes a separate linked `memory` row sharing
// source_message_id, since today's `photo`/`document` contribution types
// carry no caption field of their own.
function buildContributions(ctx) {
  const rows = [];
  const visibility = ctx.visibility || "shared";
  if (ctx.mediaKind === "photo") rows.push({ type: "photo", content: ctx.mediaPath, image_hash: ctx.mediaImageHash ?? null, visibility });
  else if (ctx.mediaKind === "document") rows.push({ type: "document", content: ctx.mediaPath, title: ctx.originalFilename || "Document", visibility });
  else if (ctx.mediaKind === "audio") rows.push({ type: "audio", content: ctx.mediaPath, visibility });

  if (ctx.story) rows.push({ type: "memory", content: ctx.story, visibility });
  else if (ctx.mediaKind === null && ctx.memoryText) rows.push({ type: "memory", content: ctx.memoryText, visibility });

  return rows;
}

const PRIVACY_PROMPT = "Private to just you, or shared with the family? Reply PRIVATE or SHARE.";

function confirmationSummary(ctx, personName) {
  const who = personName ? `*${personName}*` : "an unassigned family memory (not linked to anyone yet)";
  const lines = [`Here's what I understood:`, who];
  if (ctx.story) lines.push(`"${ctx.story}"`);
  else if (ctx.mediaKind === null && ctx.memoryText) lines.push(`"${ctx.memoryText}"`);
  else if (ctx.mediaKind === "audio") lines.push("(voice note)");
  lines.push(ctx.visibility === "private" ? "(Private — only you'll see this)" : "(Shared with the family)");
  lines.push("", "Save this? Reply YES or NO.");
  return lines.join("\n");
}

// Shared tail once a person has been resolved (matched, confirmed, or
// explicitly skipped) — branches on whether this memory still needs a story
// (photo/document) or is ready for the privacy question straight away
// (audio/text, matching the lighter Phase-1 voice-note flow in the spec).
function advanceWithPerson({ ctx: base, personId, personName }) {
  const next = { ...base, personId, personName };
  delete next.allowSkip;
  if (next.mediaKind === "photo" || next.mediaKind === "document") {
    return { reply: STORY_PROMPT[next.mediaKind], nextState: "WAITING_FOR_STORY", pendingPersonId: personId, context: next, contributions: [] };
  }
  return { reply: PRIVACY_PROMPT, nextState: "WAITING_FOR_PRIVACY_CHOICE", pendingPersonId: personId, context: next, contributions: [] };
}

export async function advanceConversation({ supabase, familyId, conversation, inbound, memberships }) {
  const state = conversation?.state || "IDLE";
  let ctx = { ...(conversation?.context || {}) };
  const text = (inbound.textBody || "").trim();
  // "Hey!!" / "hi there" read as a greeting to a person, not to a regex —
  // strip trailing punctuation and a trailing "there"/"samskara" before
  // testing against GREETING, so the common WhatsApp forms still match.
  const greetingCheckText = text.replace(/[!.?]+$/, "").replace(/\s+(there|samskara)$/i, "").trim();

  if (CANCEL.test(text) && state !== "IDLE") {
    return { reply: "Cancelled — nothing was saved. Send a photo, voice note, document, or tell me about a memory whenever you're ready.", nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [] };
  }

  // A greeting anywhere mid-flow means they're starting over or just saying
  // hi, not answering whatever question is in flight — same treatment as
  // CANCEL. Without this, a stale WAITING_FOR_PERSON_CONFIRMATION (e.g. from
  // an old test message that matched the wrong person and was never
  // confirmed) would re-ask "is this <wrong person>?" on every later "Hi",
  // forever, since that state's fallback only recognized exact YES/NO.
  if (GREETING.test(greetingCheckText) && state !== "IDLE") {
    return { reply: helpReply(memberships), nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [] };
  }

  // New media mid-conversation means they've moved on to a different
  // memory — start that one fresh rather than erroring into a dead end.
  if (inbound.mediaKind && state !== "IDLE") {
    ctx = {};
  }

  // ---- Entry point: nothing in flight yet -------------------------------
  if (state === "IDLE" || (inbound.mediaKind && Object.keys(ctx).length === 0)) {
    if (inbound.mediaKind) {
      ctx = { mediaKind: inbound.mediaKind, mediaPath: inbound.mediaPath, mediaImageHash: inbound.mediaImageHash ?? null, originalFilename: inbound.originalFilename || null };
      return { reply: MEDIA_PROMPT[inbound.mediaKind], nextState: "WAITING_FOR_PERSON", pendingPersonId: null, context: ctx, contributions: [] };
    }
    if (FAMILY_COMMAND.test(text)) {
      return buildFamilySwitchPrompt(memberships);
    }
    // A bare yes/no/ok with nothing else in flight is almost always a stray
    // reply to something that already finished (e.g. confirming a save a
    // second time out of habit) rather than someone actually trying to
    // start a new memory titled "Yes" — treat it the same as empty text
    // instead of silently creating a nonsense draft. A greeting or help
    // request gets the same treatment, for the same reason.
    if (text && !YES.test(text) && !NO.test(text) && !GREETING.test(greetingCheckText)) {
      ctx = { mediaKind: null, memoryText: text };
      return { reply: "Got it — who is this memory about? Tell me a name.", nextState: "WAITING_FOR_PERSON", pendingPersonId: null, context: ctx, contributions: [] };
    }
    return { reply: helpReply(memberships), nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [] };
  }

  // ---- Waiting for a name (first attempt, a retry, a number pick, or SKIP) ----
  if (state === "WAITING_FOR_PERSON") {
    if (SKIP.test(text) && ctx.allowSkip) {
      return advanceWithPerson({ ctx, personId: null, personName: null });
    }
    // Picking a number from a previously-shown candidate list.
    if (ctx.candidates && /^\d+$/.test(text)) {
      const idx = parseInt(text, 10) - 1;
      const picked = ctx.candidates[idx];
      if (picked) {
        const { candidates: _candidates, ...rest } = ctx;
        return advanceWithPerson({ ctx: rest, personId: picked.id, personName: picked.name });
      }
      return { reply: `Please reply with a number between 1 and ${ctx.candidates.length}, or send a different name.`, nextState: "WAITING_FOR_PERSON", pendingPersonId: null, context: ctx, contributions: [] };
    }
    if (!text) {
      return { reply: "Who is this about? Tell me a name.", nextState: "WAITING_FOR_PERSON", pendingPersonId: null, context: ctx, contributions: [] };
    }
    return matchPersonReply(supabase, familyId, ctx, text);
  }

  // ---- Confirming a single strong match ---------------------------------
  if (state === "WAITING_FOR_PERSON_CONFIRMATION") {
    if (YES.test(text)) {
      const { candidatePersonId, candidatePersonName, ...rest } = ctx;
      return advanceWithPerson({ ctx: rest, personId: candidatePersonId, personName: candidatePersonName });
    }
    if (NO.test(text)) {
      const { candidatePersonId: _id, candidatePersonName: _name, ...rest } = ctx;
      return { reply: personPromptAfterSkip(), nextState: "WAITING_FOR_PERSON", pendingPersonId: null, context: { ...rest, allowSkip: true }, contributions: [] };
    }
    if (!text) {
      return { reply: `Sorry, just reply YES or NO — is this ${ctx.candidatePersonName}?`, nextState: "WAITING_FOR_PERSON_CONFIRMATION", pendingPersonId: null, context: ctx, contributions: [] };
    }
    // Not yes/no — almost certainly a corrected name, not a literal answer
    // to the question (e.g. the match was wrong and they just typed who
    // they actually meant). Re-search instead of repeating "is this X?"
    // forever on a candidate they've effectively already rejected.
    const { candidatePersonId: _id, candidatePersonName: _name, ...rest } = ctx;
    return matchPersonReply(supabase, familyId, rest, text);
  }

  // ---- Collecting the story (photo/document only) ------------------------
  if (state === "WAITING_FOR_STORY") {
    if (!text) return { reply: STORY_PROMPT[ctx.mediaKind] || "Tell me anything you remember about this.", nextState: "WAITING_FOR_STORY", pendingPersonId: ctx.personId || null, context: ctx, contributions: [] };
    const next = { ...ctx, story: text };
    return { reply: PRIVACY_PROMPT, nextState: "WAITING_FOR_PRIVACY_CHOICE", pendingPersonId: ctx.personId || null, context: next, contributions: [] };
  }

  // ---- Private or shared? (every media/text kind passes through here,
  // right before the final save confirmation) -----------------------------
  if (state === "WAITING_FOR_PRIVACY_CHOICE") {
    if (PRIVATE_RE.test(text) || SHARE_RE.test(text)) {
      const next = { ...ctx, visibility: PRIVATE_RE.test(text) ? "private" : "shared" };
      return { reply: confirmationSummary(next, ctx.personName), nextState: "WAITING_FOR_CONFIRMATION", pendingPersonId: ctx.personId || null, context: next, contributions: [] };
    }
    return { reply: "Sorry, just reply PRIVATE (only you see it) or SHARE (the whole family sees it).", nextState: "WAITING_FOR_PRIVACY_CHOICE", pendingPersonId: ctx.personId || null, context: ctx, contributions: [] };
  }

  // ---- Picking which family to switch to ---------------------------------
  if (state === "WAITING_FOR_FAMILY_SWITCH") {
    const idx = /^\d+$/.test(text) ? parseInt(text, 10) - 1 : -1;
    const picked = ctx.familyOptions?.[idx];
    if (!picked) {
      return { reply: `Please reply with a number between 1 and ${ctx.familyOptions?.length || 1}.`, nextState: "WAITING_FOR_FAMILY_SWITCH", pendingPersonId: null, context: ctx, contributions: [] };
    }
    return {
      reply: `Switched — I'll save things to ${picked.name} from now on. This also switches it in the app.`,
      nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [],
      switchToFamilyId: picked.id,
    };
  }

  // ---- Someone was asked to identify a photo (outbound-initiated) --------
  // Reached only via Admin's "Ask the family" action, which seeds this
  // state + a contributionId in context before the photo is even sent —
  // there's no media-upload step here, just a name search exactly like
  // WAITING_FOR_PERSON, kept separate because the eventual YES means
  // "attach this person to that existing photo," not "create a new
  // contribution."
  if (state === "WAITING_FOR_PHOTO_ID") {
    if (SKIP.test(text)) {
      return { reply: "No problem — thanks for taking a look anyway!", nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [] };
    }
    if (ctx.candidates && /^\d+$/.test(text)) {
      const idx = parseInt(text, 10) - 1;
      const picked = ctx.candidates[idx];
      if (picked) {
        const { candidates: _candidates, ...rest } = ctx;
        return { reply: `Is this ${picked.name}? Reply YES or NO.`, nextState: "WAITING_FOR_PHOTO_ID_CONFIRMATION", pendingPersonId: null, context: { ...rest, candidatePersonId: picked.id, candidatePersonName: picked.name }, contributions: [] };
      }
      return { reply: `Please reply with a number between 1 and ${ctx.candidates.length}, or send a different name.`, nextState: "WAITING_FOR_PHOTO_ID", pendingPersonId: null, context: ctx, contributions: [] };
    }
    if (!text) {
      return { reply: "Who is this? Tell me a name, or reply SKIP if you're not sure.", nextState: "WAITING_FOR_PHOTO_ID", pendingPersonId: null, context: ctx, contributions: [] };
    }
    const matches = await searchPeople(supabase, familyId, text);
    if (matches.length === 1) {
      return { reply: `I found ${matches[0].name} in your family tree.\nIs this the person? Reply YES or NO.`, nextState: "WAITING_FOR_PHOTO_ID_CONFIRMATION", pendingPersonId: null, context: { ...ctx, candidatePersonId: matches[0].id, candidatePersonName: matches[0].name }, contributions: [] };
    }
    if (matches.length > 1) {
      const list = matches.map((m, i) => `${i + 1}. ${m.name}`).join("\n");
      return { reply: `I found a few people named like that:\n${list}\n\nReply with the number, or send a different name.`, nextState: "WAITING_FOR_PHOTO_ID", pendingPersonId: null, context: { ...ctx, candidates: matches.map((m) => ({ id: m.id, name: m.name })) }, contributions: [] };
    }
    return { reply: "I couldn't find that person in your family tree.\nTry a different name, or reply SKIP if you're not sure.", nextState: "WAITING_FOR_PHOTO_ID", pendingPersonId: null, context: ctx, contributions: [] };
  }

  if (state === "WAITING_FOR_PHOTO_ID_CONFIRMATION") {
    if (YES.test(text)) {
      return {
        reply: null, nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [],
        photoIdResolved: { contributionId: ctx.contributionId, personId: ctx.candidatePersonId, personName: ctx.candidatePersonName },
      };
    }
    if (NO.test(text)) {
      const { candidatePersonId: _id, candidatePersonName: _name, candidates: _candidates, ...rest } = ctx;
      return { reply: "No problem — who is it? Tell me a name, or reply SKIP if you're not sure.", nextState: "WAITING_FOR_PHOTO_ID", pendingPersonId: null, context: rest, contributions: [] };
    }
    if (!text) {
      return { reply: `Sorry, just reply YES or NO — is this ${ctx.candidatePersonName}?`, nextState: "WAITING_FOR_PHOTO_ID_CONFIRMATION", pendingPersonId: null, context: ctx, contributions: [] };
    }
    // Same reasoning as the other confirmation's fallback — a corrected
    // name, not a literal yes/no, so search fresh instead of looping.
    const matches = await searchPeople(supabase, familyId, text);
    const { candidatePersonId: _id, candidatePersonName: _name, candidates: _candidates, ...rest } = ctx;
    if (matches.length === 1) {
      return { reply: `I found ${matches[0].name} in your family tree.\nIs this the person? Reply YES or NO.`, nextState: "WAITING_FOR_PHOTO_ID_CONFIRMATION", pendingPersonId: null, context: { ...rest, candidatePersonId: matches[0].id, candidatePersonName: matches[0].name }, contributions: [] };
    }
    if (matches.length > 1) {
      const list = matches.map((m, i) => `${i + 1}. ${m.name}`).join("\n");
      return { reply: `I found a few people named like that:\n${list}\n\nReply with the number, or send a different name.`, nextState: "WAITING_FOR_PHOTO_ID", pendingPersonId: null, context: { ...rest, candidates: matches.map((m) => ({ id: m.id, name: m.name })) }, contributions: [] };
    }
    return { reply: "I couldn't find that person in your family tree.\nTry a different name, or reply SKIP if you're not sure.", nextState: "WAITING_FOR_PHOTO_ID", pendingPersonId: null, context: rest, contributions: [] };
  }

  // ---- Final save confirmation -------------------------------------------
  if (state === "WAITING_FOR_CONFIRMATION") {
    if (YES.test(text)) {
      const contributions = buildContributions(ctx);
      return { reply: null, nextState: "IDLE", pendingPersonId: null, context: {}, contributions, personId: ctx.personId || null, personName: ctx.personName || null };
    }
    if (NO.test(text)) {
      return { reply: "No problem — I've discarded this one. Send it again anytime you're ready, or send something new.", nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [] };
    }
    return { reply: "Sorry, just reply YES or NO — should I save this?", nextState: "WAITING_FOR_CONFIRMATION", pendingPersonId: ctx.personId || null, context: ctx, contributions: [] };
  }

  // Shouldn't be reachable, but fail safe into a fresh start rather than a
  // silent dead end.
  return { reply: "Let's start fresh — send me a photo, voice note, document, or tell me about a memory.", nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [] };
}
