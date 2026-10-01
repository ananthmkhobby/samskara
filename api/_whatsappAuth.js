// Shared helpers for the WhatsApp webhook — identity resolution and request
// validation. Mirrors api/_memberAuth.js's serviceClient() rather than
// inventing a second way to get a service-role Supabase client.
import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

// Found during local testing: an individual Supabase REST call occasionally
// hangs indefinitely — neither resolving nor rejecting — rather than
// failing fast, which left the webhook stuck forever with no log line at
// all (confirmed via per-stage timing checkpoints: the stuck call moved
// around between runs, so this isn't one specific query, it's generic
// local-network flakiness that can hit any outbound call). supabase-js
// doesn't impose a request timeout of its own, so every call made through
// this client gets one via a custom fetch — any single stuck call now
// fails after 8s instead of hanging the whole request.
function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Not configured on this deployment — missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchWithTimeout },
  });
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

let restClient = null;
function twilioRestClient() {
  if (!restClient) restClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return restClient;
}

// Replies are sent via Twilio's REST API rather than returned as inline
// TwiML from the webhook response — a trial account's "Try out WhatsApp"
// flow (what a brand-new Twilio account gets today in place of the old
// Sandbox) doesn't support direct TwiML in the response at all, while the
// REST API send works identically across trial, Sandbox, and a full paid
// account. One code path, no WHATSAPP_ENV branching needed.
export async function sendWhatsAppMessage(phoneNumber, body) {
  if (!body) return;
  await twilioRestClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: `whatsapp:${phoneNumber}`,
    body,
  });
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
