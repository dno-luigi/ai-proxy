async function pushProvisional(query, answer, model, env) {
  if (!env.TRUTH || !answer || answer.length < 40) return null;
  try {
    const res = await env.TRUTH.fetch("https://truth/api/truth/provisional/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // truth's handler keys off `id` or `input`, and normalises the id from the
      // text itself. Sending `query` was silently rejected with 400 every time.
      body: JSON.stringify({
        input: String(query).slice(0, 500),
        answer: String(answer).slice(0, CONFIG.MAX_TEXT),
        meta: { model: model || CONFIG.AI_MODEL, confidence: 0.7, qc_passed: true }
      })
    });
    if (!res.ok) {
      console.error("[ai-proxy] provisional push rejected:", res.status);
      return null;
    }
    return await res.json().catch(() => null);
  } catch (e) {
    console.error("[ai-proxy] provisional push failed:", e.message);
    return null;
  }
}
__name(pushProvisional, "pushProvisional");
