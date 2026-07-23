// Vercel serverless function — turns a raw guided-interview transcript
// (spoken answers, transcribed client-side) into a polished biography
// chapter, the way a family member would if they sat down and wrote it up
// themselves. Only uses what's in the transcript — never invents facts.
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
  const { personName, history } = req.body || {};
  if (!personName || !Array.isArray(history) || !history.length) {
    res.status(400).json({ error: "Missing personName or history." });
    return;
  }
  const transcript = history.map((h) => `Q: ${h.question}\nA: ${h.answer}`).join("\n\n");
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
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
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || "OpenAI request failed.");
    const raw = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);
    if (!parsed.title || !parsed.text) throw new Error("The draft came back incomplete — try again.");
    res.status(200).json({ title: parsed.title, text: parsed.text });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't draft the chapter." });
  }
}
