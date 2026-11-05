async function embed(text, env) {
  const input = String(text || "").slice(0, CONFIG.MAX_TEXT);
  if (!input) throw new Error("text required");
  if (env.OPENROUTER_API_KEY) {
    try {
      const res = await fetch(CONFIG.EMBEDDING_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: CONFIG.EMBEDDING_MODEL, input })
      });
      if (res.ok) {
        const data = await res.json();
        const vec = data?.data?.[0]?.embedding;
        if (Array.isArray(vec) && vec.length) return vec;
      }
    } catch (e) {
      console.error("[ai-proxy] openrouter embed failed:", e.message);
    }
  }
  if (env.AI) {
    const out = await env.AI.run(CONFIG.AI_EMBED_MODEL, { text: [input] });
    const vec = out?.data?.[0];
    if (Array.isArray(vec) && vec.length) return vec;
  }
  throw new Error("embedding unavailable");
}
__name(embed, "embed");
