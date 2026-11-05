async function loadLayer(kv, prefix, cap) {
  if (!kv) return [];
  const rows = [];
  try {
    const keys = await listKeys(kv, prefix, cap);
    for (let i = 0; i < keys.length; i += 25) {
      const chunk = keys.slice(i, i + 25);
      const values = await Promise.all(chunk.map((k) => kv.get(k.name).catch(() => null)));
      chunk.forEach((k, j) => {
        const text = entryText(safeParse(values[j]));
        if (text) rows.push({ label: k.name.slice(prefix.length), text });
      });
    }
  } catch (e) {
    console.error("[ai-proxy] layer load failed", prefix, e.message);
  }
  return rows;
}
__name(loadLayer, "loadLayer");
