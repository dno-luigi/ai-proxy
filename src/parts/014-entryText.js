function entryText(rec) {
  if (!rec) return "";
  if (typeof rec === "string") return rec;
  return [rec.answer, rec.content, rec.text, rec.title, rec.canonical].filter((v) => typeof v === "string").join("\n").slice(0, CONFIG.MAX_TEXT);
}
__name(entryText, "entryText");
