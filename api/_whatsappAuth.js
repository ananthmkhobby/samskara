// Shared helpers for the WhatsApp webhook — identity resolution and request
// validation. Mirrors api/_memberAuth.js's serviceClient() rather than
// inventing a second way to get a service-role Supabase client.
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Not configured on this deployment — missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Twilio signs every webhook request with the account's auth token. The URL
// used in that signature must be the exact public URL Twilio was configured
// to call — built from APP_URL (an env var we control), never from
// req.headers.host, which a caller could spoof.
export function validateTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.APP_URL;
  if (!authToken || !appUrl) throw new Error("WhatsApp isn't configured on this deployment yet.");
  const signature = req.headers["x-twilio-signature"];
  if (!signature) return false;
  const url = `${appUrl}/api/whatsapp-webhook`;
  return twilio.validateRequest(authToken, signature, url, req.body || {});
}

// A WhatsApp "From" field looks like "whatsapp:+919xxxxxxxxx" — normalize to
// a bare E.164 number so it matches whatsapp_connections.phone_number.
export function normalizePhoneNumber(whatsappFrom) {
  return String(whatsappFrom || "").replace(/^whatsapp:/, "").trim();
}

// Resolves a phone number to its linked Samskara user + family + role, or
// null if the number has never been linked. One family per user is already
// enforced at the schema level (family_members.user_id is unique), so this
// never has to disambiguate between multiple families for one person.
export async function resolveIdentity(supabase, phoneNumber) {
  const { data: connection, error: connErr } = await supabase
    .from("whatsapp_connections").select("user_id").eq("phone_number", phoneNumber).maybeSingle();
  if (connErr) throw new Error(connErr.message);
  if (!connection) return null;

  const { data: member, error: memberErr } = await supabase
    .from("family_members").select("family_id, role, display_name").eq("user_id", connection.user_id).maybeSingle();
  if (memberErr) throw new Error(memberErr.message);
  if (!member) return null;

  return {
    userId: connection.user_id,
    familyId: member.family_id,
    role: member.role,
    displayName: member.display_name || "A family member",
  };
}
