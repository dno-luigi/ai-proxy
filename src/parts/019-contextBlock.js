function contextBlock(hits) {
  if (!hits.length) return null;
  const body = hits.map((h) => `[${h.layer.toUpperCase()}: ${h.label}]
${h.content.slice(0, 900)}`).join("\n\n---\n\n");
  return {
    role: "system",
    content: `Ground your answer in the following knowledge from this system's stores. Prefer verified master truths over memory. If they do not cover the question, say so and answer generally.

${body}`
  };
}
__name(contextBlock, "contextBlock");
