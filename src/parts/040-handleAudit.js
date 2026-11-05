async function handleAudit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const { content, messages, type = "docket", audit_id, stream = true } = body;
  let chat = Array.isArray(messages) && messages.length ? messages.slice() : [];
  if (audit_id && !chat.length) {
    const prior = await readJson(env.AUDITS, `audit:${audit_id}`);
    if (prior && Array.isArray(prior.messages)) chat = prior.messages.slice();
  }
  if (!chat.length) {
    if (!content) return fail(400, "content_required");
    chat = [
      { role: "system", content: AUDIT_SYSTEM_PROMPT },
      { role: "user", content: String(content) }
    ];
  }
  const lastUser = [...chat].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const hits = await retrieve(lastUser.content, env);
    const ctx = contextBlock(hits);
    if (ctx) chat.splice(chat.length - 1, 0, ctx);
  }
  if (stream) {
    try {
      return sse(await streamChat(chat, env, { temperature: 0.35, max_tokens: 1200 }));
    } catch (e) {
      return fail(502, "model_failed", { message: e.message });
    }
  }
  try {
    const out = await complete(chat, env, { temperature: 0.35, max_tokens: 1200 });
    return json({ choices: [{ message: { role: "assistant", content: out.text } }], text: out.text, model: out.model, type });
  } catch (e) {
    return fail(502, "model_failed", { message: e.message });
  }
}
__name(handleAudit, "handleAudit");
