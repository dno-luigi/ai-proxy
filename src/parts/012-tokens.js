function tokens(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2).slice(0, 40);
}
__name(tokens, "tokens");
