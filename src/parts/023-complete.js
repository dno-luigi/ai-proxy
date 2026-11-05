async function complete(messages, env, opts = {}) {
  const errors = [];
  for (const attempt of [aiText, orText, mindText]) {
    try {
      return await attempt(messages, env, opts);
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error(errors.join(" | "));
}
__name(complete, "complete");
