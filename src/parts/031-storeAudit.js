async function storeAudit(record, env) {
  await env.AUDITS.put(`audit:${record.id}`, JSON.stringify(record), {
    expirationTtl: CONFIG.AUDIT_TTL
  });
  if (env.TRUTH_BUCKET) {
    try {
      await env.TRUTH_BUCKET.put(`audits/${record.id}.json`, JSON.stringify(record), {
        httpMetadata: { contentType: "application/json" }
      });
    } catch (e) {
      console.error("[ai-proxy] r2 audit write failed:", e.message);
    }
  }
}
__name(storeAudit, "storeAudit");
