var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (p === "/" || p === "") {
      return new Response(
        `AI Proxy Service \u2014 single entry point

Endpoints:
  GET  /health
  POST /api/chat          {message|messages, stream}
  POST /api/generate      {prompt|messages, stream}
  POST /api/code          {prompt}
  POST /candidate         {id, query, model, instruction, schema} -> JSON array
  POST /api/embed         {text}
  POST /api/context       {context_id, message}
  POST /api/context/clear {context_id}
  GET  /api/elevated
  POST /v1/audit          {content|messages, type, stream}
  POST /v1/audit/store    {content, fullText, messages, audit_id} -> {audit_id}
  GET  /v1/audit/:id
  POST /v1/pipeline       {audit_id, action, contact}
  ANY  /api/admin/*       X-Admin-Secret

Knowledge stores: master truths + Memoria. Audits land in the curation queue.
`,
        { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
    try {
      if (p === "/health") {
        return json({
          status: "healthy",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          service: "ai-proxy",
          bindings: bindingReport(env),
          retrieval: {
            masterTruths: env.MASTER_TRUTHS ? "904eff3a master truths" : null,
            memoria: env.MEM ? "4a9bfbff Memoria" : null,
            knowledge: env.ORP ? "145a30ed ORP" : null
          }
        });
      }
      if (p === "/api/chat" && request.method === "POST") return handleChat(request, env, ctx);
      if ((p === "/candidate" || p === "/api/candidate") && request.method === "POST") return handleCandidate(request, env);
      if (p === "/api/generate" && request.method === "POST") return handleGenerate(request, env, ctx);
      if (p === "/api/code" && request.method === "POST") return handleCode(request, env);
      if (p === "/api/mcp") {
        return fail(501, "mcp_not_implemented", {
          message: "The old dashboard build exposed MCP here and this repo build does not. Tell me what it needs and it comes back on this route."
        });
      }
      if (p === "/api/embed" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !body.text) return fail(400, "text_required");
        try {
          return json({ embedding: await embed(body.text, env) });
        } catch (e) {
          return fail(502, "embed_failed", { message: e.message });
        }
      }
      if (p === "/api/context" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !body.message) return fail(400, "message_required");
        const id = body.context_id || "default";
        const key = `ctx:${id}:data`;
        const prior = await readJson(env.CONTEXT_STORE, key) || [];
        const embedding = await embed(body.message, env).catch(() => []);
        prior.push({ role: body.role || "user", content: String(body.message).slice(0, CONFIG.MAX_TEXT), embedding, at: Date.now() });
        const trimmed = prior.slice(-100);
        await env.CONTEXT_STORE.put(key, JSON.stringify(trimmed));
        return json({ success: true, context_id: id, messages: trimmed.length });
      }
      if (p === "/api/context/clear" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        await env.CONTEXT_STORE.delete(`ctx:${body.context_id || "default"}:data`);
        return json({ success: true });
      }
      if (p === "/api/elevated" && request.method === "GET") {
        return json({ entries: await elevatedIndex(env) });
      }
      if (p === "/api/elevated/search" && request.method === "GET") {
        const q = url.searchParams.get("q");
        if (!q) return fail(400, "q_required");
        return json({ results: await retrieve(q, env, 10) });
      }
      if (p.startsWith("/api/admin/")) return handleAdmin(request, env, url);
      if (p === "/v1/audit" && request.method === "POST") return handleAudit(request, env);
      if (p === "/v1/audit/store" && request.method === "POST") return handleAuditStore(request, env, ctx);
      if (/^\/v1\/audit\/[^/]+$/.test(p) && request.method === "GET") {
        const id = p.split("/").pop();
        const audit = await readJson(env.AUDITS, `audit:${id}`);
        return audit ? json(audit) : fail(404, "audit_not_found");
      }
      if (p === "/v1/pipeline" && request.method === "POST") return handlePipeline(request, env);
      return fail(404, "not_found", {
        available_endpoints: ["/api/chat", "/api/code", "/api/generate", "/candidate", "/api/mcp", "/api/embed", "/api/context", "/api/elevated", "/api/admin/*", "/v1/audit", "/v1/audit/store", "/v1/pipeline", "/health", "/"]
      });
    } catch (e) {
      console.error("[ai-proxy] unhandled", p, e.stack || e.message);
      return fail(500, "internal_error", { message: e.message });
    }
  }
};
