async function readJson(kv, key) {
  if (!kv) return null;
  const raw = await kv.get(key);
  if (!raw) return null;
  return safeParse(raw);
}
__name(readJson, "readJson");
