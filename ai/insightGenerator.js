import fetch from "node-fetch";

/**
 * Calls a single Gemini model via REST and returns the text (or null)
 */
async function callGemini(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
      // Optional: set a sensible timeout in your environment if you like
    });

    const json = await response.json();
    console.log(json);

    // Debug log (you can remove or lower this in production)
    console.log(`🔵 Response from ${model}:`, JSON.stringify(json, null, 2));

    // Common path for Gemini 2.x responses
    const text =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      json?.candidates?.[0]?.content?.parts?.[0]?.text ||
      null;

    return text ? text.trim() : null;
  } catch (err) {
    console.log(`❌ Error calling ${model}:`, err?.message || err);
    return null;
  }
}

/**
 * Public function called by controllers to generate a human-friendly insight.
 * Attempts multiple models to avoid overload; always returns a short safe fallback if none succeed.
 */
export default async function generateAiInsight(summaryData) {
  // This prompt is intentionally simple and targeted at non-technical people.
  const prompt = `
You are explaining to a common villager who does NOT know data, government terms, or statistics.
Write the explanation in SIMPLE everyday language, like you are speaking to someone who reads a local newspaper.
Rules:
- Use 5 short sentences (5 lines max).
- No technical words, no jargon, no percentages unless it's simple to say (e.g., "most" instead of "70%").
- Use rupees symbol (₹) when mentioning typical daily wages, and round numbers to the nearest whole number if needed.
- Focus on: how many people got work, whether projects are finishing, how money was spent (like "land and water work"), and whether payments were on time.
- Be friendly and clear (tone: helpful local news).

Data:
${JSON.stringify(summaryData, null, 2)}
`;

  // Preferred models (try in order). These are stable 2.x models; adjust order if you prefer others.
  const models = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ];

  for (const m of models) {
    const result = await callGemini(m, prompt);
    if (result) return result; // success
    // brief delay before trying the next model to avoid rapid-fire requests
    await new Promise((res) => setTimeout(res, 700));
  }

  // Final safe fallback message for the frontend (short and helpful)
  return "AI could not generate the plain-language summary right now because the AI is busy. Please try again in a moment.";
}
