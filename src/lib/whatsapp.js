// The human-facing WhatsApp number — separate from the server-only
// TWILIO_WHATSAPP_FROM (api/_whatsappAuth.js), which carries the
// `whatsapp:` scheme prefix Twilio's API expects and is never exposed to
// the browser. Set per Vercel project (test = Sandbox number, production =
// the real number), same per-environment-secret convention as every other
// var in docs/ENVIRONMENTS.md. Falls back to a plain placeholder so a
// missing var never breaks the page, just reads oddly until it's set.
export const WHATSAPP_DISPLAY_NUMBER = import.meta.env.VITE_WHATSAPP_DISPLAY_NUMBER || "our WhatsApp number (coming soon)";
