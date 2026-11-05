async function knowledgeBase(env) {
  const now = Date.now();
  if (kbCache.layers && now - kbCache.at < CONFIG.KB_TTL) return kbCache.layers;
  const [master, memory, knowledge] = await Promise.all([
    loadLayer(env.MASTER_TRUTHS, "master:", CONFIG.KB_SCAN),
    loadLayer(env.MEM, "truth:", CONFIG.KB_SCAN),
    loadLayer(env.ORP, "elevated:", CONFIG.KB_SCAN)
  ]);
  kbCache = { at: now, layers: { master, memory, knowledge } };
  console.log("[ai-proxy] kb loaded", master.length, memory.length, knowledge.length);
  return kbCache.layers;
}
__name(knowledgeBase, "knowledgeBase");
