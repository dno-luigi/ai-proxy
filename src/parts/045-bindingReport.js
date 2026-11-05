function bindingReport(env) {
  return {
    master: !!env.MASTER_TRUTHS,
    memoria: !!env.MEM,
    audits: !!env.AUDITS,
    context: !!env.CONTEXT_STORE,
    knowledge: !!env.ORP,
    r2: !!env.TRUTH_BUCKET,
    d1: !!env.CHAT_DB,
    truth: !!env.TRUTH,
    ai: !!env.AI,
    openrouter: !!env.OPENROUTER_API_KEY,
    adminSecret: !!env.ADMIN_SECRET
  };
}
__name(bindingReport, "bindingReport");
