// Vercel serverless function — Twilio posts every inbound WhatsApp message
// here as application/x-www-form-urlencoded. Twilio parses this the same
// way it parses a normal POST body (api/scan-family-tree.js already relies
// on req.body being pre-parsed for JSON; the Node runtime does the same for
// form-encoded bodies).
//
// Flow: validate signature -> idempotency check -> resolve who's texting ->
// (first time: send them a one-time account-linking link) -> advance their
// conversation -> store any media -> save any resulting memory as ordinary
// `contributions` rows -> reply via the Twilio REST API.
//
// Replies are NOT returned as inline TwiML from this response — a trial
// Twilio account's "Try out WhatsApp" flow doesn't support that at all
// ("Direct TwiML XML is not supported during response", per Twilio's own
// trial docs), while a REST API send works the same way across trial,
// Sandbox, and a full paid account. This endpoint always just acks Twilio
// with a bare 200 once the inbound message has been durably recorded.
import { serviceClient, validateTwilioSignature, normalizePhoneNumber, resolveIdentity, sendWhatsAppMessage } from "./_whatsappAuth.js";
import { classifyMediaType, fetchTwilioMedia, storeMedia } from "./_whatsappMedia.js";
import { advanceConversation } from "./_whatsappConversation.js";

function maskPhone(p) {
  const s = String(p || "");
  return s.length > 4 ? `${"*".repeat(s.length - 4)}${s.slice(-4)}` : s;
}

function log(event, fields = {}) {
  // Structured, and deliberately never includes message text or media
  // content — only safe metadata, per the integration spec's logging rule.
  console.log(JSON.stringify({ event, ...fields }));
}

// Temporary fine-grained tracing while chasing an intermittent hang during
// local testing: some requests stall completely between two awaits with
// neither a resolved value nor a thrown error, and the coarser per-stage
// logs above weren't enough to tell which specific call it was. Safe to
// remove once the Sandbox has run cleanly for a while.
function checkpoint(name, startedAt) {
  console.log(JSON.stringify({ event: "CHECKPOINT", name, ms: Date.now() - startedAt }));
}

// A failed outbound send is a separate problem from the inbound webhook
// itself (which Twilio has already successfully delivered) — logged, not
// thrown, so it never turns into a webhook retry that re-processes a
// message we already handled. The explicit timeout exists because this
// call was observed, during local testing, to sometimes hang indefinitely
// with neither a resolve nor a reject — silent, with nothing logged at
// all — rather than failing fast; this guarantees a log line either way.
async function reply(phoneNumber, message) {
  if (!message) return;
  const started = Date.now();
  try {
    await Promise.race([
      sendWhatsAppMessage(phoneNumber, message),
      new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_10S")), 10000)),
    ]);
    log("REPLY_SENT", { phone: maskPhone(phoneNumber), ms: Date.now() - started });
  } catch (err) {
    log("PROCESSING_FAILED", { reason: `reply_send_failed: ${err.message}`, phone: maskPhone(phoneNumber), ms: Date.now() - started });
  }
}

function ack(res) {
  res.status(200).send("");
}

export default async function handler(req, res) {
  const requestStarted = Date.now();
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  let valid;
  try {
    valid = validateTwilioSignature(req);
  } catch (err) {
    res.status(500).send(err.message);
    return;
  }
  if (!valid) {
    res.status(403).send("Invalid signature");
    return;
  }

  const supabase = serviceClient();
  const body = req.body || {};
  const phoneNumber = normalizePhoneNumber(body.From);
  const messageSid = body.MessageSid;
  const textBody = body.Body || "";
  const numMedia = parseInt(body.NumMedia || "0", 10);
  const mediaUrl = numMedia > 0 ? body.MediaUrl0 : null;
  const mediaContentType = numMedia > 0 ? body.MediaContentType0 : null;

  log("WHATSAPP_MESSAGE_RECEIVED", { phone: maskPhone(phoneNumber), hasMedia: numMedia > 0, mediaContentType });

  if (!phoneNumber || !messageSid) {
    ack(res);
    return;
  }

  // Idempotency: Twilio retries on anything but a prompt 200, so the same
  // message can arrive more than once. The unique constraint on
  // twilio_message_sid is the actual guard — this insert either claims the
  // message or tells us someone already has.
  const { error: insertMsgErr } = await supabase.from("whatsapp_messages").insert({
    twilio_message_sid: messageSid,
    phone_number: phoneNumber,
    message_type: numMedia > 0 ? (classifyMediaType(mediaContentType) || "unknown") : "text",
    text_body: textBody || null,
    media_content_type: mediaContentType,
    processing_status: "processing",
  });
  if (insertMsgErr) {
    if (insertMsgErr.code === "23505") {
      log("PROCESSING_FAILED", { reason: "duplicate", messageSid });
      ack(res);
      return;
    }
    log("PROCESSING_FAILED", { reason: "message_log_insert_failed", messageSid });
    await reply(phoneNumber, "I couldn't process that right now. Please try sending it again.");
    ack(res);
    return;
  }

  async function finishMessage(fields) {
    await supabase.from("whatsapp_messages").update({ ...fields, processed_at: new Date().toISOString() }).eq("twilio_message_sid", messageSid);
  }

  try {
    const identity = await resolveIdentity(supabase, phoneNumber);
    log("WHATSAPP_USER_IDENTIFIED", { phone: maskPhone(phoneNumber), known: !!identity, ms: Date.now() - requestStarted });

    if (!identity) {
      const { data: token, error: tokenErr } = await supabase
        .from("whatsapp_link_tokens").insert({ phone_number: phoneNumber }).select("code").single();
      if (tokenErr) throw new Error(tokenErr.message);
      const link = `${process.env.APP_URL}/connect-whatsapp?token=${token.code}`;
      await finishMessage({ processing_status: "completed" });
      await reply(phoneNumber, `Welcome to Samskara 👋\nTo protect your family's memories, I need to connect this WhatsApp number with your Samskara account.\n\nOpen this secure link:\n${link}\n\nIt expires in 15 minutes.`);
      ack(res);
      return;
    }

    await finishMessage({ user_id: identity.userId, family_id: identity.familyId });
    checkpoint("after_finishMessage_identity", requestStarted);

    // Unsupported attachment — fail clearly rather than silently dropping it
    // or feeding an unknown type into the conversation engine.
    if (numMedia > 0 && !classifyMediaType(mediaContentType)) {
      await finishMessage({ processing_status: "failed", error_message: "unsupported media type" });
      await reply(phoneNumber, "I'm not able to preserve this file type yet. Please send a photo, PDF, text, or voice note.");
      ack(res);
      return;
    }

    let mediaKind = null, mediaPath = null;
    if (numMedia > 0) {
      const { buffer, ext, kind } = await fetchTwilioMedia(mediaUrl, mediaContentType);
      // The person isn't resolved yet at upload time — "unassigned" is the
      // same placeholder the in-app ContributeModal already uses for media
      // about someone not yet (or never) linked to a tree entry.
      mediaPath = await storeMedia(supabase, identity.familyId, "unassigned", buffer, ext, mediaContentType);
      // _whatsappMedia.js classifies images as "image" (matching
      // whatsapp_messages.message_type's DB check constraint), but the
      // conversation engine and contributions.type both speak "photo"
      // (matching the rest of the app — ContributeModal etc. use "photo").
      // Translated here, once, at the boundary — found as a real bug during
      // testing: without it every photo flow silently skipped the story
      // step and the photo itself was never included in the final save,
      // only whatever text happened to be typed along the way.
      mediaKind = kind === "image" ? "photo" : kind;
      log("MEDIA_STORED", { phone: maskPhone(phoneNumber), kind, ms: Date.now() - requestStarted });
    }

    const { data: conversation } = await supabase
      .from("whatsapp_conversations").select("*").eq("phone_number", phoneNumber).maybeSingle();
    checkpoint("after_conversation_select", requestStarted);

    // An abandoned conversation older than a day starts fresh rather than
    // trapping the next message in a stale flow.
    const isStale = conversation && Date.now() - new Date(conversation.last_interaction_at).getTime() > 24 * 60 * 60 * 1000;
    const effectiveConversation = isStale ? null : conversation;

    const result = await advanceConversation({
      supabase, familyId: identity.familyId,
      conversation: effectiveConversation,
      inbound: { textBody, mediaKind, mediaPath, originalFilename: null },
      memberships: identity.memberships,
    });
    checkpoint("after_advanceConversation", requestStarted);

    // Changes the same `active_family_id` pointer the in-app family switcher
    // uses (current_family_id()), so switching here and switching in the app
    // are the same action, not two parallel states to keep in sync.
    if (result.switchToFamilyId) {
      await supabase.from("user_preferences").upsert({ user_id: identity.userId, active_family_id: result.switchToFamilyId });
      log("FAMILY_SWITCHED", { phone: maskPhone(phoneNumber), familyId: result.switchToFamilyId });
    }

    if (result.contributions.length) {
      log("PERSON_MATCHED", { phone: maskPhone(phoneNumber), matched: !!result.personId });
      const status = identity.role === "head" || identity.role === "admin" ? "Verified" : "Pending";
      const rows = result.contributions.map((c) => ({
        family_id: identity.familyId,
        person_id: result.personId || null,
        type: c.type,
        content: c.content,
        title: c.title,
        contributor: identity.displayName,
        contributor_user_id: identity.userId,
        status,
        source: "whatsapp",
        source_message_id: messageSid,
      }));
      const { error: contribErr } = await supabase.from("contributions").insert(rows);
      if (contribErr) {
        // Nothing lost — keep the draft in place so a retry of YES works,
        // rather than clearing the conversation on a failed save.
        await supabase.from("whatsapp_conversations").upsert({
          phone_number: phoneNumber, user_id: identity.userId, family_id: identity.familyId,
          state: "WAITING_FOR_CONFIRMATION", pending_person_id: result.personId || null,
          context: conversation?.context || {}, last_interaction_at: new Date().toISOString(),
        });
        await finishMessage({ processing_status: "failed", error_message: "contribution insert failed" });
        log("PROCESSING_FAILED", { reason: "contribution_insert", phone: maskPhone(phoneNumber) });
        await reply(phoneNumber, "I couldn't save this memory right now. Nothing has been lost. Please try sending it again.");
        ack(res);
        return;
      }
      log("MEMORY_CREATED", { phone: maskPhone(phoneNumber), count: rows.length, status });
      const whoText = result.personName ? `${result.personName}'s memories` : "your family's memories";
      const replyText = status === "Verified"
        ? `Saved ❤️\nI added this to ${whoText}.`
        : `Saved — sent to your family's review queue for ${whoText}. A Head or Admin will confirm it shortly.`;
      await supabase.from("whatsapp_conversations").upsert({
        phone_number: phoneNumber, user_id: identity.userId, family_id: identity.familyId,
        state: "IDLE", pending_person_id: null, context: {}, last_interaction_at: new Date().toISOString(),
      });
      await finishMessage({ processing_status: "completed", stored_media_path: mediaPath });
      await reply(phoneNumber, replyText);
      ack(res);
      return;
    }

    await supabase.from("whatsapp_conversations").upsert({
      phone_number: phoneNumber, user_id: identity.userId, family_id: identity.familyId,
      state: result.nextState, pending_person_id: result.pendingPersonId || null,
      context: result.context, last_interaction_at: new Date().toISOString(),
    });
    await finishMessage({ processing_status: "completed", stored_media_path: mediaPath });
    await reply(phoneNumber, result.reply);
    ack(res);
  } catch (err) {
    log("PROCESSING_FAILED", { reason: err.message, messageSid });
    await finishMessage({ processing_status: "failed", error_message: err.message }).catch(() => {});
    await reply(phoneNumber, "I couldn't save this memory right now. Nothing has been lost. Please try sending it again.");
    ack(res);
  }
}
