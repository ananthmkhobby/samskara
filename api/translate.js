// Vercel serverless function — keeps the OpenAI key server-side. Never call
// OpenAI directly from the browser with this key; it would be visible to
// anyone who opens devtools on the deployed site.
import { allowAiRequest } from "./_aiAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Translation isn't set up yet — add OPENAI_API_KEY to this project's environment variables." });
    return;
  }

  // Gate before spending any OpenAI credit — signed-in family members pass
  // straight through; anonymous demo visitors share a daily ceiling.
  try {
    await allowAiRequest(req);
  } catch (err) {
    res.status(429).json({ error: err.message });
    return;
  }
  const { text, targetLang } = req.body || {};
  if (!text || !targetLang) {
    res.status(400).json({ error: "Missing text or targetLang." });
    return;
  }
  const targetLabel = targetLang === "kn" ? "Kannada" : "English";
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `You translate short family-memory text between Kannada and English. Translate the user's message into ${targetLabel}. Reply with only the translation — no notes, no quotation marks.` },
          { role: "user", content: text }
        ],
        temperature: 0.2
      })
    });
    const data = await r.json();
    if (!r.ok) {
      // Logged server-side only — the upstream message can name the
      // provider and expose account/billing state to anyone calling this.
      console.error("AI provider error:", data.error?.message || r.status);
      throw new Error("UPSTREAM");
    }
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error("No translation came back — try again.");
    res.status(200).json({ translated });
  } catch (err) {
    res.status(500).json({ error: err.message === "UPSTREAM" ? "Translation failed — please try again." : (err.message || "Translation failed — please try again.") });
  }
}
