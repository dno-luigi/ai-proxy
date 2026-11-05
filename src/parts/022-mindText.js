async function mindText(messages, env) {
  const res = await fetch(`${CONFIG.MIND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, stream: false }),
    signal: AbortSignal.timeout(45e3)
  });
  if (!res.ok) throw new Error(`mind error: ${res.status}`);
  const data = await res.json();
  const text = data.text || data.response || data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("empty mind response");
  return { text, model: data.model || "mind", route: "mind" };
}
__name(mindText, "mindText");
