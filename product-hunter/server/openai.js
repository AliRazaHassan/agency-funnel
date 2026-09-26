/**
 * Optional OpenAI JSON helper. Falls back to null if no key / failure.
 */
export async function chatJson(system, user, { model = "gpt-4o-mini" } = {}) {
  const key = String(process.env.OPENAI_API_KEY || "").trim();
  if (!key || key === "YOUR_KEY" || key === "YOUR_OPENAI_API_KEY") {
    return null;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      const safeMessage = res.status === 401
        ? "API key missing/invalid. Check OPENAI_API_KEY in Render Environment."
        : text.slice(0, 200);
      console.warn("OpenAI error:", res.status, safeMessage);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (err) {
    console.warn("OpenAI failed:", err.message);
    return null;
  }
}
