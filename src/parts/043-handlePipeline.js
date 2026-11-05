async function handlePipeline(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const { audit_id, action, contact } = body;
  if (!audit_id || !action) return fail(400, "audit_id_and_action_required");
  const audit = await readJson(env.AUDITS, `audit:${audit_id}`);
  if (!audit) return fail(404, "audit_not_found");
  if (action === "speakeasy_review") {
    await pushAuditCard({ ...audit, status: "review_requested" }, env);
    return json({
      success: true,
      action,
      audit_id,
      message: "Audit has been sent to the Speakeasy Collective for expert peer review.",
      next_steps: [
        "Expert reviewers will analyze your audit findings",
        "You will be notified when review is complete"
      ]
    });
  }
  const payment = action === "counsel_doc_prep" ? PAYMENT_INFO.doc_prep : action === "counsel_consult" ? PAYMENT_INFO.consult : null;
  if (!payment) return fail(400, "invalid_action");
  return json({
    success: true,
    action,
    audit_id,
    payment: {
      ...payment,
      instructions: [
        `1. Send payment via Chime: ${payment.chime} or CashApp: ${payment.cashapp}`,
        `2. Include in memo: ${action === "counsel_doc_prep" ? "AUDIT" : "CONSULT"}-${audit_id}`,
        contact ? `3. Contact email: ${contact}` : "3. You will be contacted to confirm"
      ]
    },
    next_steps: action === "counsel_doc_prep" ? ["Payment confirmation triggers document generation", "Documents delivered within 24-48 hours"] : ["Payment confirmation triggers scheduling", "Scheduling link within 24 hours"]
  });
}
__name(handlePipeline, "handlePipeline");
