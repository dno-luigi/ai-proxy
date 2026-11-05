function auditMarkdown(audit) {
  let out = `# Truth Engine Audit

**Audit ID:** ${audit.id}
**Type:** ${audit.type || "docket"}
**Created:** ${audit.createdAt}

`;
  if (audit.lastResponse) out += `${audit.lastResponse}
`;
  return out;
}
__name(auditMarkdown, "auditMarkdown");
