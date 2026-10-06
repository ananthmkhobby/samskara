// Vercel serverless function — a Head/Admin picks an unidentified photo and
// a specific family member to ask, and Samskara sends them that photo over
// WhatsApp asking who it is. This is Samskara messaging someone *first*,
// which WhatsApp only permits via a Meta-approved Content Template outside
// the 24h customer-service window — see TWILIO_PHOTO_ID_TEMPLATE_SID below.
import { serviceClient, requireModerator } from "./_memberAuth.js";
import { sendWhatsAppTemplate } from "./_whatsappAuth.js";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // a day is ample for Meta to fetch it once, right after this call

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { familyId, contributionId, targetUserId, list } = req.body || {};
  if (!familyId) {
    res.status(400).json({ error: "Missing familyId." });
    return;
  }

  let supabase;
  try {
    supabase = serviceClient();
    await requireModerator(supabase, req, familyId);
  } catch (err) {
    res.status(403).json({ error: err.message });
    return;
  }

  // Listing mode: who in this family could even be asked — needs a login
  // and a connected WhatsApp number. No Twilio/template check here, since
  // the Admin UI wants this list regardless of whether sending is wired up
  // yet.
  if (list) {
    try {
      const { data: members, error: memberErr } = await supabase
        .from("family_members").select("user_id, display_name").eq("family_id", familyId);
      if (memberErr) throw new Error(memberErr.message);
      const { data: connections, error: connErr } = await supabase
        .from("whatsapp_connections").select("user_id").in("user_id", members.map((m) => m.user_id));
      if (connErr) throw new Error(connErr.message);
      const connectedIds = new Set(connections.map((c) => c.user_id));
      const askable = members.filter((m) => connectedIds.has(m.user_id))
        .map((m) => ({ userId: m.user_id, displayName: m.display_name }));
      res.status(200).json({ members: askable });
    } catch (err) {
      res.status(500).json({ error: err.message || "Couldn't load family members." });
    }
    return;
  }

  if (!contributionId || !targetUserId) {
    res.status(400).json({ error: "Missing contributionId or targetUserId." });
    return;
  }

  const templateSid = process.env.TWILIO_PHOTO_ID_TEMPLATE_SID;
  if (!templateSid) {
    res.status(500).json({ error: "This feature needs a WhatsApp message template approved by Meta first — set TWILIO_PHOTO_ID_TEMPLATE_SID once it's approved." });
    return;
  }

  try {
    const { data: contribution, error: contribErr } = await supabase
      .from("contributions").select("id, type, content, person_id").eq("id", contributionId).eq("family_id", familyId).maybeSingle();
    if (contribErr) throw new Error(contribErr.message);
    if (!contribution || contribution.type !== "photo" || !contribution.content) {
      throw new Error("That photo couldn't be found.");
    }

    const { data: targetMember, error: memberErr } = await supabase
      .from("family_members").select("display_name").eq("user_id", targetUserId).eq("family_id", familyId).maybeSingle();
    if (memberErr) throw new Error(memberErr.message);
    if (!targetMember) throw new Error("That person isn't a member of this family.");

    const { data: connection, error: connErr } = await supabase
      .from("whatsapp_connections").select("phone_number").eq("user_id", targetUserId).maybeSingle();
    if (connErr) throw new Error(connErr.message);
    if (!connection) throw new Error("That family member hasn't connected WhatsApp yet.");

    const { data: family, error: familyErr } = await supabase.from("families").select("name").eq("id", familyId).single();
    if (familyErr) throw new Error(familyErr.message);

    const { data: signed, error: signErr } = await supabase.storage.from("family-media").createSignedUrl(contribution.content, SIGNED_URL_TTL_SECONDS);
    if (signErr) throw new Error(signErr.message);

    // Variable numbering must match how the template was actually built in
    // the Twilio Content Template Builder — "1" assumed here for the image
    // header (a media-header variable), "2"/"3" for the body's two {{}}
    // placeholders (recipient name, family name), per the template spec
    // given when this feature was proposed. Adjust these keys if the
    // approved template numbers them differently.
    await sendWhatsAppTemplate(connection.phone_number, templateSid, {
      "1": signed.signedUrl,
      "2": targetMember.display_name || "there",
      "3": family.name || "your family",
    });

    await supabase.from("whatsapp_conversations").upsert({
      phone_number: connection.phone_number, user_id: targetUserId, family_id: familyId,
      state: "WAITING_FOR_PHOTO_ID", pending_person_id: null,
      context: { contributionId }, last_interaction_at: new Date().toISOString(),
    });

    res.status(200).json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't send that right now." });
  }
}
