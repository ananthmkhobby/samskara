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

const MEDIA_PROMPT = {
  photo: "Beautiful memory ❤️\nWho is in this photo?",
  audio: "Who is this memory about?",
  document: "Got it — who is this document about, or who in the family is it connected to?",
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

// Builds the final contribution rows for a resolved memory. Mirrors exactly
// what a manual ContributeModal submission produces (api callers insert
// into `contributions` the same way) — a photo/document comes with its own
// row, and a story (if any) becomes a separate linked `memory` row sharing
// source_message_id, since today's `photo`/`document` contribution types
// carry no caption field of their own.
function buildContributions(ctx) {
  const rows = [];
  if (ctx.mediaKind === "photo") rows.push({ type: "photo", content: ctx.mediaPath });
  else if (ctx.mediaKind === "document") rows.push({ type: "document", content: ctx.mediaPath, title: ctx.originalFilename || "Document" });
  else if (ctx.mediaKind === "audio") rows.push({ type: "audio", content: ctx.mediaPath });

  if (ctx.story) rows.push({ type: "memory", content: ctx.story });
  else if (ctx.mediaKind === null && ctx.memoryText) rows.push({ type: "memory", content: ctx.memoryText });

  return rows;
}

function confirmationSummary(ctx, personName) {
  const who = personName ? `*${personName}*` : "an unassigned family memory (not linked to anyone yet)";
  const lines = [`Here's what I understood:`, who];
  if (ctx.story) lines.push(`"${ctx.story}"`);
  else if (ctx.mediaKind === null && ctx.memoryText) lines.push(`"${ctx.memoryText}"`);
  else if (ctx.mediaKind === "audio") lines.push("(voice note)");
  lines.push("", "Save this? Reply YES or NO.");
  return lines.join("\n");
}

// Shared tail once a person has been resolved (matched, confirmed, or
// explicitly skipped) — branches on whether this memory still needs a story
// (photo/document) or is ready to confirm straight away (audio/text,
// matching the lighter Phase-1 voice-note flow in the spec).
function advanceWithPerson({ ctx: base, personId, personName }) {
  const next = { ...base, personId, personName };
  delete next.allowSkip;
  if (next.mediaKind === "photo" || next.mediaKind === "document") {
    return { reply: STORY_PROMPT[next.mediaKind], nextState: "WAITING_FOR_STORY", pendingPersonId: personId, context: next, contributions: [] };
  }
  return { reply: confirmationSummary(next, personName), nextState: "WAITING_FOR_CONFIRMATION", pendingPersonId: personId, context: next, contributions: [] };
}

export async function advanceConversation({ supabase, familyId, conversation, inbound }) {
  const state = conversation?.state || "IDLE";
  let ctx = { ...(conversation?.context || {}) };
  const text = (inbound.textBody || "").trim();

  if (CANCEL.test(text) && state !== "IDLE") {
    return { reply: "Cancelled — nothing was saved. Send a photo, voice note, document, or tell me about a memory whenever you're ready.", nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [] };
  }

  // New media mid-conversation means they've moved on to a different
  // memory — start that one fresh rather than erroring into a dead end.
  if (inbound.mediaKind && state !== "IDLE") {
    ctx = {};
  }

  // ---- Entry point: nothing in flight yet -------------------------------
  if (state === "IDLE" || (inbound.mediaKind && Object.keys(ctx).length === 0)) {
    if (inbound.mediaKind) {
      ctx = { mediaKind: inbound.mediaKind, mediaPath: inbound.mediaPath, originalFilename: inbound.originalFilename || null };
      return { reply: MEDIA_PROMPT[inbound.mediaKind], nextState: "WAITING_FOR_PERSON", pendingPersonId: null, context: ctx, contributions: [] };
    }
    // A bare yes/no/ok with nothing else in flight is almost always a stray
    // reply to something that already finished (e.g. confirming a save a
    // second time out of habit) rather than someone actually trying to
    // start a new memory titled "Yes" — treat it the same as empty text
    // instead of silently creating a nonsense draft.
    if (text && !YES.test(text) && !NO.test(text)) {
      ctx = { mediaKind: null, memoryText: text };
      return { reply: "Got it — who is this memory about? Tell me a name.", nextState: "WAITING_FOR_PERSON", pendingPersonId: null, context: ctx, contributions: [] };
    }
    return { reply: "Send me a photo, voice note, document, or tell me about a memory, and I'll help preserve it for your family.", nextState: "IDLE", pendingPersonId: null, context: {}, contributions: [] };
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
    return { reply: `Sorry, just reply YES or NO — is this ${ctx.candidatePersonName}?`, nextState: "WAITING_FOR_PERSON_CONFIRMATION", pendingPersonId: null, context: ctx, contributions: [] };
  }

  // ---- Collecting the story (photo/document only) ------------------------
  if (state === "WAITING_FOR_STORY") {
    if (!text) return { reply: STORY_PROMPT[ctx.mediaKind] || "Tell me anything you remember about this.", nextState: "WAITING_FOR_STORY", pendingPersonId: ctx.personId || null, context: ctx, contributions: [] };
    const next = { ...ctx, story: text };
    return { reply: confirmationSummary(next, ctx.personName), nextState: "WAITING_FOR_CONFIRMATION", pendingPersonId: ctx.personId || null, context: next, contributions: [] };
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
