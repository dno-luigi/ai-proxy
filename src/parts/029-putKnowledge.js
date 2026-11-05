async function putKnowledge(entry, env) {
  const id = entry.id || `elv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const prior = await readJson(env.ORP, `elevated:${id}`);
  const record = {
    id,
    title: entry.title || "Untitled",
    content: entry.content || "",
    domains: entry.domains || ["general"],
    confidence: Math.min(Number(entry.confidence) || 0.65, 0.8),
    source: entry.source || "auto",
    embedding: entry.embedding || prior && prior.embedding || [],
    createdAt: prior && prior.createdAt || now,
    updatedAt: now
  };
  await env.ORP.put(`elevated:${id}`, JSON.stringify(record));
  const index = await elevatedIndex(env);
  const summary = { id, title: record.title, domains: record.domains, confidence: record.confidence, createdAt: record.createdAt };
  const at = index.findIndex((e) => e.id === id);
  if (at >= 0) index[at] = summary;
  else index.push(summary);
  await env.ORP.put("elevated:index", JSON.stringify(index));
  kbCache = { at: 0, layers: null };
  return record;
}
__name(putKnowledge, "putKnowledge");
