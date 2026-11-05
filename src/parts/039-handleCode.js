async function handleCode(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const prompt = body.prompt || body.message || body.code;
  if (!prompt) return fail(400, "missing_prompt");
  const messages = [
    { role: "system", content: "You are a precise coding assistant. Return code first, then a short explanation. No filler." },
    { role: "user", content: String(prompt) }
  ];
  try {
    const out = await complete(messages, env, { model: body.model, temperature: 0.2, max_tokens: body.max_tokens || 1200 });
    return json({ text: out.text, model: out.model, route: out.route });
  } catch (e) {
    return fail(502, "model_failed", { message: e.message });
  }
}
__name(handleCode, "handleCode");
