async function aiText(messages, env, opts = {}) {
  if (!env.AI) throw new Error("AI binding missing");
  const out = await env.AI.run(opts.model && !opts.model.startsWith("@") ? opts.model : CONFIG.AI_MODEL, {
    messages,
    max_tokens: opts.max_tokens || 1024,
    temperature: opts.temperature ?? 0.3
  });
  const text = typeof out === "string" && out || out?.response || out?.choices?.[0]?.message?.content || out?.result?.response || "";
  if (!text) throw new Error("empty model response");
  return { text, model: CONFIG.AI_MODEL, route: "workers-ai" };
}
__name(aiText, "aiText");
