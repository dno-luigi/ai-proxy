async function handleChat(request, env, runtime) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const text = typeof body.message === "string" ? body.message : "";
  let messages = Array.isArray(body.messages) ? body.messages.slice() : [];
  if (!messages.length && text) messages = [{ role: "user", content: text }];
  if (!messages.length) return fail(400, "missing_message", { hint: "send {message} or {messages:[{role,content}]}" });
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const hits = lastUser ? await retrieve(lastUser.content, env) : [];
  const ctx = contextBlock(hits);
  if (ctx) messages.unshift(ctx);
  const opts = {
    model: body.model || body.preset,
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    api_key: body.api_key,
    preferOpenRouter: body.provider === "openrouter"
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
    if (lastUser) runtime.waitUntil(learnFromAnswer(lastUser.content, out.text, "Chat", env).catch(() => {
    }));
    return json({ text: out.text, route: out.route, model: out.model, context: hits.length });
  } catch (e) {
    return fail(502, "model_failed", { message: e.message });
  }
}
__name(handleChat, "handleChat");
