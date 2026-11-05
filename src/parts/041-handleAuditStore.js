async function handleAuditStore(request, env, runtime) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const { content, type = "docket", fullText, messages, audit_id } = body;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (audit_id) {
    const existing = await readJson(env.AUDITS, `audit:${audit_id}`);
    if (existing) {
      existing.messages = messages || existing.messages;
      existing.lastResponse = fullText || existing.lastResponse;
      existing.updatedAt = now;
      await storeAudit(existing, env);
      runtime.waitUntil(pushAuditCard({ ...existing, status: existing.status || "updated" }, env).catch(() => {
      }));
      const query = (messages || []).filter((m) => m.role === "user").pop()?.content || content || "";
      if (query && fullText) {
        runtime.waitUntil(learnFromAnswer(query, fullText, "Audit", env).catch(() => {
        }));
        runtime.waitUntil(pushProvisional(query, fullText, null, env).catch(() => {
        }));
      }
      return json({ audit_id });
    }
  }
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    type,
    messages: messages || [
      { role: "system", content: AUDIT_SYSTEM_PROMPT },
      { role: "user", content: content || "" }
    ],
    lastResponse: fullText || "",
    rawText: fullText || content || "",
    status: "completed",
    overallConfidence: 0.65,
    createdAt: now
  };
  await storeAudit(record, env);
  runtime.waitUntil(pushAuditCard(record, env).catch(() => {
  }));
  if (content && fullText) {
    runtime.waitUntil(learnFromAnswer(content, fullText, "Audit", env).catch(() => {
    }));
    runtime.waitUntil(pushProvisional(content, fullText, null, env).catch(() => {
    }));
  }
  return json({ audit_id: id });
}
__name(handleAuditStore, "handleAuditStore");
