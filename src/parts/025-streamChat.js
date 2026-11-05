async function streamChat(messages, env, opts = {}) {
  if (env.OPENROUTER_API_KEY && opts.model && !opts.model.startsWith("@") && opts.preferOpenRouter) {
    const res = await fetch(CONFIG.OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": CONFIG.SITE_URL,
        "X-Title": CONFIG.SITE_TITLE
      },
      body: JSON.stringify({ model: opts.model, messages, stream: true, temperature: opts.temperature ?? 0.3 })
    });
    if (res.ok && res.body) return res.body;
  }
  if (!env.AI) throw new Error("AI binding missing");
  const raw = await env.AI.run(CONFIG.AI_MODEL, {
    messages,
    stream: true,
    max_tokens: opts.max_tokens || 1024,
    temperature: opts.temperature ?? 0.3
  });
  return toOpenAISSE(raw, CONFIG.AI_MODEL);
}
__name(streamChat, "streamChat");
