// Media handling for the WhatsApp webhook: pull a message's attachment off
// Twilio's (temporary, auth-gated) media URL and re-upload it into Samskara's
// own storage — the app must never permanently depend on a Twilio URL, and
// per section 21 of the integration spec, MIME type and size are validated
// before anything is stored.
import { randomUUID } from "crypto";
import { Jimp } from "jimp";
import { computeDHash } from "../src/lib/imageHash.js";

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

// Turns a spoken WhatsApp voice note into text via OpenAI's Whisper API —
// reuses the same OPENAI_API_KEY already configured for the AI Interview
// and translation features (api/translate.js), no separate account needed.
export async function transcribeAudio(buffer, contentType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Voice transcription isn't set up yet — add OPENAI_API_KEY to this project's environment variables.");
  const info = ALLOWED[contentType];
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), `voice.${info?.ext || "ogg"}`);
  form.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    // Logged server-side only — matches translate.js's own convention of
    // never surfacing the upstream provider's error text to the user.
    console.error("Whisper transcription error:", data.error?.message || res.status);
    throw new Error("transcription request failed");
  }
  const text = (data.text || "").trim();
  if (!text) throw new Error("empty transcription");
  return text;
}

// Best-effort perceptual hash for duplicate-photo detection (Admin >
// Duplicates) — unlike the browser's resizeImage(), WhatsApp photos are
// stored at their original resolution with no client-side decode step
// already done, so this is the one place that needs an actual image
// library (jimp — pure JS, no native bindings, same reasoning that made
// @react-pdf/renderer/pdfkit the safe Vercel choice elsewhere in this
// project). Never lets a decode failure fail the whole message.
async function hashImageBuffer(buffer) {
  try {
    const img = await Jimp.read(buffer);
    img.resize({ w: 32, h: 32 }).greyscale();
    return computeDHash(img.bitmap);
  } catch {
    return null;
  }
}

// Same bucket and {familyId}/{personId}/{uuid}.{ext} path convention the
// browser's own uploadFamilyMedia() uses (src/lib/mediaUpload.js) — the
// webhook runs under the service role, so it uses the Storage client
// directly rather than going through the browser-only helper.
export async function storeMedia(supabase, familyId, personId, buffer, ext, contentType) {
  const path = `${familyId}/${personId}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType });
  if (error) throw new Error(`Couldn't save that attachment: ${error.message}`);
  const imageHash = contentType.startsWith("image/") ? await hashImageBuffer(buffer) : null;
  return { path, imageHash };
}
