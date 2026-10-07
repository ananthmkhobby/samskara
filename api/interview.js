// Vercel serverless function — merges the two AI-guided-interview endpoints
// (asking a follow-up question, drafting the final chapter) into one, to
// stay under Vercel's Hobby-plan 12-function cap. Both halves share the
// same gate/shape; action discriminates which OpenAI call to make. Safe to
// merge with zero live-behavior change since both were already fully
// hidden behind SHOW_AI_FEATURES=false.
import { allowAiRequest } from "./_aiAuth.js";

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

async function handleFollowup(req, res, apiKey) {
  const { personName, context, history } = req.body || {};
  if (!personName || !Array.isArray(history) || !history.length) {
    res.status(400).json({ error: "Missing personName or history." });
    return;
  }
  const transcript = history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join("\n\n");
  try {
    const data = await callOpenAI(apiKey, {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a warm, patient oral-history interviewer helping a family record ${personName}'s life story. Given the conversation so far, ask ONE natural, specific follow-up question that digs into something they just mentioned — a name, a place, a feeling, a decision. Keep it short and conversational, like a grandchild asking, never a form question like "tell me about your childhood." Reply with only the question — no preamble, no quotation marks.${context ? ` Known context about them: ${context}` : ""}`
        },
        { role: "user", content: transcript }
      ],
      temperature: 0.7
    });
    const question = data.choices?.[0]?.message?.content?.trim();
    if (!question) throw new Error("No question came back — try again.");
    res.status(200).json({ question });
  } catch (err) {
    res.status(500).json({ error: err.message === "UPSTREAM" ? "Couldn't come up with the next question — please try again." : (err.message || "Couldn't come up with the next question — please try again.") });
  }
}

async function handleDraft(req, res, apiKey) {
  const { personName, history } = req.body || {};
  if (!personName || !Array.isArray(history) || !history.length) {
    res.status(400).json({ error: "Missing personName or history." });
    return;
  }
  const transcript = history.map((h) => `Q: ${h.question}\nA: ${h.answer}`).join("\n\n");
  try {
    const data = await callOpenAI(apiKey, {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You turn a raw interview transcript into a warm, flowing biography chapter about ${personName}, written in third person, for a family archive. Use only what's stated or clearly implied in the transcript — never invent names, dates, or events. Write 2-4 short paragraphs. Reply with ONLY valid JSON (no markdown fences, no commentary) matching: {"title": string, "text": string} where text uses "\\n\\n" between paragraphs.`
        },
        { role: "user", content: transcript }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });
    const raw = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);
    if (!parsed.title || !parsed.text) throw new Error("The draft came back incomplete — try again.");
    res.status(200).json({ title: parsed.title, text: parsed.text });
  } catch (err) {
    res.status(500).json({ error: err.message === "UPSTREAM" ? "Couldn't draft the chapter — please try again." : (err.message || "Couldn't draft the chapter — please try again.") });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "The AI interview isn't set up yet — add OPENAI_API_KEY to this project's environment variables." });
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
  if (action === "draft") {
    await handleDraft(req, res, apiKey);
  } else if (action === "followup") {
    await handleFollowup(req, res, apiKey);
  } else {
    res.status(400).json({ error: "Unknown action." });
  }
}
