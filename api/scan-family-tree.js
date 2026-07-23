// Vercel serverless function — reads an uploaded photo of an existing family
// tree chart and asks OpenAI's vision model to extract its structure. The key
// stays server-side; the browser only ever talks to this endpoint.
const SYSTEM_PROMPT = `You read photos of hand-drawn or printed family tree charts and extract their structure.
Reply with ONLY valid JSON (no markdown fences, no commentary) matching this exact shape:
{"name": string, "spouseName": string, "birthYear": string, "spouseBirthYear": string, "children": [ ...same shape, recursively... ]}
Use "" for any field you don't know. There must be exactly one root person — the earliest generation visible in the photo. If you can't confidently find a single root, pick whoever appears most senior/central.
If the image clearly is not a family tree chart, reply with exactly {"error": "not a family tree"} instead.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Photo scanning isn't set up yet — add OPENAI_API_KEY to this project's environment variables." });
    return;
  }
  const { image } = req.body || {};
  if (!image) {
    res.status(400).json({ error: "Missing image." });
    return;
  }
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Extract the family tree structure from this photo." },
            { type: "image_url", image_url: { url: image } }
          ] }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || "OpenAI request failed.");
    const raw = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error("That doesn't look like a family tree chart — try a clearer photo, or build it manually instead.");
    if (!parsed.name) throw new Error("Couldn't make out a clear starting person — try a clearer photo, or build it manually instead.");
    res.status(200).json({ tree: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't read that photo." });
  }
}
