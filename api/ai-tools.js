// Vercel serverless function — merges the two remaining small OpenAI-backed
// tools (family-tree photo scanning, text translation) into one endpoint,
// to stay under Vercel's Hobby-plan 12-function cap. Both halves share the
// same gate/shape; action discriminates which one runs. Safe to merge with
// zero live-behavior change since both are already fully hidden behind
// SHOW_AI_FEATURES=false.
import { allowAiRequest } from "./_aiAuth.js";

const SCAN_SYSTEM_PROMPT = `You read photos of hand-drawn or printed family tree charts and extract their structure.
Reply with ONLY valid JSON (no markdown fences, no commentary) matching this exact shape:
{"name": string, "spouseName": string, "birthYear": string, "spouseBirthYear": string, "children": [ ...same shape, recursively... ]}
Use "" for any field you don't know. There must be exactly one root person — the earliest generation visible in the photo. If you can't confidently find a single root, pick whoever appears most senior/central.
If the image clearly is not a family tree chart, reply with exactly {"error": "not a family tree"} instead.`;

async function callOpenAI(apiKey, body) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    // Logged server-side only — the upstream message can name the provider
    // and expose account/billing state to anyone calling this.
    console.error("AI provider error:", data.error?.message || r.status);
    throw new Error("UPSTREAM");
  }
  return data;
}

async function handleScan(req, res, apiKey) {
  const { image } = req.body || {};
  if (!image) {
    res.status(400).json({ error: "Missing image." });
    return;
  }
  try {
    const data = await callOpenAI(apiKey, {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SCAN_SYSTEM_PROMPT },
        { role: "user", content: [
          { type: "text", text: "Extract the family tree structure from this photo." },
          { type: "image_url", image_url: { url: image } }
        ] }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    const raw = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error("That doesn't look like a family tree chart — try a clearer photo, or build it manually instead.");
    if (!parsed.name) throw new Error("Couldn't make out a clear starting person — try a clearer photo, or build it manually instead.");
    res.status(200).json({ tree: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message === "UPSTREAM" ? "Couldn't read that photo — please try again." : (err.message || "Couldn't read that photo — please try again.") });
  }
}

async function handleTranslate(req, res, apiKey) {
  const { text, targetLang } = req.body || {};
  if (!text || !targetLang) {
    res.status(400).json({ error: "Missing text or targetLang." });
    return;
  }
  const targetLabel = targetLang === "kn" ? "Kannada" : "English";
  try {
    const data = await callOpenAI(apiKey, {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `You translate short family-memory text between Kannada and English. Translate the user's message into ${targetLabel}. Reply with only the translation — no notes, no quotation marks.` },
        { role: "user", content: text }
      ],
      temperature: 0.2
    });
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error("No translation came back — try again.");
    res.status(200).json({ translated });
  } catch (err) {
    res.status(500).json({ error: err.message === "UPSTREAM" ? "Translation failed — please try again." : (err.message || "Translation failed — please try again.") });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "This isn't set up yet — add OPENAI_API_KEY to this project's environment variables." });
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

  const { action } = req.body || {};
  if (action === "scan") {
    await handleScan(req, res, apiKey);
  } else if (action === "translate") {
    await handleTranslate(req, res, apiKey);
  } else {
    res.status(400).json({ error: "Unknown action." });
  }
}
