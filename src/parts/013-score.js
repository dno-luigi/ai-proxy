function score(queryTokens, text) {
  if (!queryTokens.length) return 0;
  const hay = String(text || "").toLowerCase();
  let hits = 0;
  for (const t of queryTokens) if (hay.includes(t)) hits++;
  return hits / queryTokens.length;
}
__name(score, "score");
