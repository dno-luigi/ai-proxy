async function listKeys(kv, prefix, limit) {
  const out = [];
  let cursor;
  while (out.length < limit) {
    const page = await kv.list({
      prefix,
      limit: Math.min(1e3, limit - out.length),
      ...cursor ? { cursor } : {}
    });
    out.push(...page.keys);
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return out.slice(0, limit);
}
__name(listKeys, "listKeys");
