// Vercel serverless function — given how a guided family-memory interview
// has gone so far, asks OpenAI for one natural, specific follow-up question,
// the same way a curious grandchild would dig deeper into what was just said
// instead of moving on to the next item on a generic checklist.
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
  const { personName, context, history } = req.body || {};
  if (!personName || !Array.isArray(history) || !history.length) {
    res.status(400).json({ error: "Missing personName or history." });
    return;
  }
  const transcript = history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`).join("\n\n");
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a warm, patient oral-history interviewer helping a family record ${personName}'s life story. Given the conversation so far, ask ONE natural, specific follow-up question that digs into something they just mentioned — a name, a place, a feeling, a decision. Keep it short and conversational, like a grandchild asking, never a form question like "tell me about your childhood." Reply with only the question — no preamble, no quotation marks.${context ? ` Known context about them: ${context}` : ""}`
          },
          { role: "user", content: transcript }
        ],
        temperature: 0.7
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || "OpenAI request failed.");
    const question = data.choices?.[0]?.message?.content?.trim();
    if (!question) throw new Error("No question came back — try again.");
    res.status(200).json({ question });
  } catch (err) {
    res.status(500).json({ error: err.message || "Couldn't come up with the next question." });
  }
}
