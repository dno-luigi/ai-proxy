async function handleCandidate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const query = body.query || body.input || body.prompt;
  const id = body.id || "";
  if (!query) return fail(400, "missing_query", { id });
  const hits = await retrieve(query, env);
  const ctx = contextBlock(hits);
  const instruction = body.instruction || "You are a backend JSON generator. Return ONLY a valid JSON array of candidate truths matching the provided JSON Schema. No prose, no markdown, no extra keys.";
  const messages = [];
  if (ctx) messages.push(ctx);
  messages.push({
    role: "system",
    content: instruction + '\nRespond with a JSON array like [{"answer":"...","model":"...","confidence":0.7,"citations":[]}]. No code fences. No commentary. One to three elements.'
  });
  messages.push({ role: "user", content: String(query) });
  let lastErr = "no_attempt";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await complete(messages, env, { model: body.model, temperature: 0.2, max_tokens: 700 });
      const arr = extractJsonArray(out.text);
      if (arr && arr.length) {
        const cleaned = arr.filter((c) => c && typeof c.answer === "string" && c.answer.trim()).map((c) => ({
          answer: c.answer.trim(),
          model: out.model,
          // the model's self-report is unreliable (it echoes context labels)
          confidence: typeof c.confidence === "number" ? c.confidence : 0.7,
          citations: Array.isArray(c.citations) ? c.citations : []
        })).slice(0, 3);
        if (cleaned.length) return json(cleaned);
      }
      lastErr = "NO_CANDIDATE";
      messages.push({ role: "user", content: "That was not a bare JSON array. Return only the array, nothing else." });
    } catch (e) {
      lastErr = e.message;
      break;
    }
  }
  return fail(502, "no_candidate", { message: lastErr, id, context: hits.length });
}
__name(handleCandidate, "handleCandidate");
