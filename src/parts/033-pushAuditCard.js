async function pushAuditCard(audit, env) {
  try {
    await fetch(`${CONFIG.WORKSPACE_URL}/api/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "Audit",
        title: `Audit: ${audit.id}`,
        content: auditMarkdown(audit),
        domains: ["legal"],
        confidence: audit.overallConfidence || 0.65,
        status: audit.status || "completed",
        auditScope: audit.type || "structural"
      })
    });
  } catch (e) {
    console.error("[ai-proxy] workspace push failed:", e.message);
  }
}
__name(pushAuditCard, "pushAuditCard");
