// Media handling for the WhatsApp webhook: pull a message's attachment off
// Twilio's (temporary, auth-gated) media URL and re-upload it into Samskara's
// own storage — the app must never permanently depend on a Twilio URL, and
// per section 21 of the integration spec, MIME type and size are validated
// before anything is stored.
import { randomUUID } from "crypto";

const BUCKET = "family-media";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB — comfortably above WhatsApp's own image/voice-note limits

const ALLOWED = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/opus": { kind: "audio", ext: "opus" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/amr": { kind: "audio", ext: "amr" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "application/pdf": { kind: "document", ext: "pdf" },
};

export function classifyMediaType(contentType) {
  return ALLOWED[contentType]?.kind || null;
}

// Twilio media URLs require the same Account SID/Auth Token as the webhook
// itself (HTTP Basic Auth) — they are not publicly fetchable.
export async function fetchTwilioMedia(mediaUrl, contentType) {
  const info = ALLOWED[contentType];
  if (!info) throw new Error(`UNSUPPORTED_TYPE:${contentType}`);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error("Couldn't retrieve that attachment from WhatsApp — please try sending it again.");

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new Error("That file is too large to preserve right now — please send something smaller.");

  return { buffer, ext: info.ext, kind: info.kind };
}

// Same bucket and {familyId}/{personId}/{uuid}.{ext} path convention the
// browser's own uploadFamilyMedia() uses (src/lib/mediaUpload.js) — the
// webhook runs under the service role, so it uses the Storage client
// directly rather than going through the browser-only helper.
export async function storeMedia(supabase, familyId, personId, buffer, ext, contentType) {
  const path = `${familyId}/${personId}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType });
  if (error) throw new Error(`Couldn't save that attachment: ${error.message}`);
  return path;
}
