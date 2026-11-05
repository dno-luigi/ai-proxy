async function handleGenerate(request, env, runtime) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice() : [];
  const prompt = body.prompt || messages.filter((m) => m.role === "user").pop()?.content || "";
  if (!messages.length && !prompt) return fail(400, "missing_prompt");
  if (!messages.length) messages.push({ role: "user", content: prompt });
  const hits = prompt ? await retrieve(prompt, env) : [];
  const ctx = contextBlock(hits);
  if (ctx) messages.unshift(ctx);
  const opts = {
    model: body.model || body.preset,
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    api_key: body.api_key,
    preferOpenRouter: !!body.api_key
  };
  if (body.stream) {
    try {
      return sse(await streamChat(messages, env, opts));
    } catch (e) {
      return fail(502, "model_failed", { message: e.message });
    }
  }
  try {
    const out = await complete(messages, env, opts);
    if (prompt) runtime.waitUntil(learnFromAnswer(prompt, out.text, "Query", env).catch(() => {
    }));
    return json({
      choices: [{ message: { role: "assistant", content: out.text } }],
      text: out.text,
      model: out.model,
      route: out.route,
      context: hits.length
    });
  } catch (e) {
    return fail(502, "model_failed", { message: e.message });
  }
}
__name(handleGenerate, "handleGenerate");
