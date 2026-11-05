async function handleAdmin(request, env, url) {
  if (!env.ADMIN_SECRET) return fail(503, "admin_not_configured", { hint: "set the ADMIN_SECRET secret" });
  if (!secretOk(env, request)) return fail(401, "unauthorized");
  const path = url.pathname.replace("/api/admin", "");
  if (path === "/stats" || path === "" || path === "/") {
    const counts = {};
    for (const [label, kv, prefix] of [
      ["master", env.MASTER_TRUTHS, "master:"],
      ["memory", env.MEM, "truth:"],
      ["provisional", env.MEM, "provisional:"],
      ["knowledge", env.ORP, "elevated:"]
    ]) {
      try {
        counts[label] = (await listKeys(kv, prefix, 5e3)).length;
      } catch {
        counts[label] = null;
      }
    }
    return json({ counts, bindings: bindingReport(env) });
  }
  if (path === "/knowledge" && request.method === "GET") {
    return json({ entries: await elevatedIndex(env) });
  }
  if (path === "/knowledge" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !body.content) return fail(400, "content_required");
    const embedding = await embed(body.content, env).catch(() => []);
    const entry = await putKnowledge({ ...body, source: "admin", embedding }, env);
    return json({ success: true, entry });
  }
  if (path === "/knowledge/search" && request.method === "GET") {
    const q = url.searchParams.get("q");
    if (!q) return fail(400, "q_required");
    return json({ results: await retrieve(q, env, 10) });
  }
  if (path.startsWith("/knowledge/") && request.method === "GET") {
    const entry = await readJson(env.ORP, `elevated:${path.split("/").pop()}`);
    return entry ? json(entry) : fail(404, "not_found");
  }
  if (path.startsWith("/knowledge/") && request.method === "PUT") {
    const id = path.split("/").pop();
    const prior = await readJson(env.ORP, `elevated:${id}`);
    if (!prior) return fail(404, "not_found");
    const body = await request.json().catch(() => ({}));
    const embedding = body.content && body.content !== prior.content ? await embed(body.content, env).catch(() => prior.embedding) : prior.embedding;
    const entry = await putKnowledge({ ...prior, ...body, id, embedding }, env);
    return json({ success: true, entry });
  }
  if (path.startsWith("/knowledge/") && request.method === "DELETE") {
    const id = path.split("/").pop();
    await env.ORP.delete(`elevated:${id}`);
    const index = (await elevatedIndex(env)).filter((e) => e.id !== id);
    await env.ORP.put("elevated:index", JSON.stringify(index));
    return json({ success: true });
  }
  if (path === "/audits" && request.method === "GET") {
    const keys = await listKeys(env.AUDITS, "audit:", Number(url.searchParams.get("limit")) || 50);
    return json({ audits: keys.map((k) => ({ id: k.name.slice(6), ...k.metadata || {} })) });
  }
  return fail(404, "not_found");
}
__name(handleAdmin, "handleAdmin");
