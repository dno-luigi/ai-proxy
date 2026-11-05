async function orText(messages, env, opts = {}) {
  if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");
  const res = await fetch(CONFIG.OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.api_key || env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": CONFIG.SITE_URL,
      "X-Title": CONFIG.SITE_TITLE
    },
    body: JSON.stringify({
      model: opts.model || "@preset/truth",
      messages,
      stream: false,
      max_tokens: opts.max_tokens || 1024,
      temperature: opts.temperature ?? 0.3
    })
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("empty OpenRouter response");
  return { text, model: data?.model || opts.model || "@preset/truth", route: "openrouter" };
}
__name(orText, "orText");
