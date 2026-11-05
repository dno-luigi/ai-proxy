async function learnFromAnswer(query, answer, source, env) {
  if (!answer || answer.length < 40) return null;
  try {
    const embedding = await embed(`${query}

${answer}`, env).catch(() => []);
    return await putKnowledge(
      {
        title: `[${source}] ${String(query).slice(0, 120)}`,
        content: String(answer).slice(0, CONFIG.MAX_TEXT),
        domains: ["legal"],
        confidence: 0.78,
        source: "auto",
        embedding
      },
      env
    );
  } catch (e) {
    console.error("[ai-proxy] learn failed:", e.message);
    return null;
  }
}
__name(learnFromAnswer, "learnFromAnswer");
