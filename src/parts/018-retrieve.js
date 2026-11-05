async function retrieve(query, env, limit = CONFIG.KB_RESULTS) {
  const qt = tokens(query);
  if (!qt.length) return [];
  const layers = await knowledgeBase(env);
  const results = [];
  for (const [layer, rows] of Object.entries(layers)) {
    for (const row of rows) {
      const s = score(qt, `${row.label} ${row.text}`);
      if (s > 0.2) results.push({ layer, label: row.label, content: row.text, score: s });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
__name(retrieve, "retrieve");
