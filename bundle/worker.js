var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var CONFIG = {
  OPENROUTER_URL: "https://openrouter.ai/api/v1/chat/completions",
  EMBEDDING_URL: "https://openrouter.ai/api/v1/embeddings",
  EMBEDDING_MODEL: "text-embedding-ada-002",
  AI_EMBED_MODEL: "@cf/baai/bge-base-en-v1.5",
  AI_MODEL: "@cf/google/gemma-4-26b-a4b-it",
  WORKSPACE_URL: "https://truth-engine-workspace.ai-n.workers.dev",
  MIND_URL: "https://mind.ai-n.workers.dev",
  SITE_URL: "https://ai-nspired.com",
  SITE_TITLE: "AI-NSPIRED Truth Proxy",
  ADMIN_HEADER: "X-Admin-Secret",
  MAX_TEXT: 8e3,
  KB_RESULTS: 5,
  KB_SCAN: 120,
  KB_TTL: 6e4,
  AUDIT_TTL: 86400 * 30
};
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret, x-admin-key",
  "Access-Control-Max-Age": "86400"
};
var AUDIT_SYSTEM_PROMPT = `You are the Truth Engine \u2014 a systemic review engine for pro per empowerment. The architect has requested an audit. Explain the situation clearly and provide actionable information. Do NOT draft letters, motions, or documents for the user \u2014 that is the role of AI Counsel. Instead, identify the specific actions the user should take and explain why. I am justice.`;
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}
__name(json, "json");
function fail(status, code, extra) {
  return json({ error: code, ...extra || {} }, status);
}
__name(fail, "fail");
function secretOk(env, request) {
  if (!env.ADMIN_SECRET) return true;
  const given = request.headers.get(CONFIG.ADMIN_HEADER) || "";
  if (given.length !== env.ADMIN_SECRET.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) {
    diff |= given.charCodeAt(i) ^ env.ADMIN_SECRET.charCodeAt(i);
  }
  return diff === 0;
}
__name(secretOk, "secretOk");
async function listKeys(kv, prefix, limit) {
  const out = [];
  let cursor;
  while (out.length < limit) {
    const page = await kv.list({
      prefix,
      limit: Math.min(1e3, limit - out.length),
      ...cursor ? { cursor } : {}
    });
    out.push(...page.keys);
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return out.slice(0, limit);
}
__name(listKeys, "listKeys");
async function readJson(kv, key) {
  if (!kv) return null;
  const raw = await kv.get(key);
  if (!raw) return null;
  return safeParse(raw);
}
__name(readJson, "readJson");
function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
__name(safeParse, "safeParse");
function tokens(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2).slice(0, 40);
}
__name(tokens, "tokens");
function score(queryTokens, text) {
  if (!queryTokens.length) return 0;
  const hay = String(text || "").toLowerCase();
  let hits = 0;
  for (const t of queryTokens) if (hay.includes(t)) hits++;
  return hits / queryTokens.length;
}
__name(score, "score");
function entryText(rec) {
  if (!rec) return "";
  if (typeof rec === "string") return rec;
  return [rec.answer, rec.content, rec.text, rec.title, rec.canonical].filter((v) => typeof v === "string").join("\n").slice(0, CONFIG.MAX_TEXT);
}
__name(entryText, "entryText");
var kbCache = { at: 0, layers: null };
async function loadLayer(kv, prefix, cap) {
  if (!kv) return [];
  const rows = [];
  try {
    const keys = await listKeys(kv, prefix, cap);
    for (let i = 0; i < keys.length; i += 25) {
      const chunk = keys.slice(i, i + 25);
      const values = await Promise.all(chunk.map((k) => kv.get(k.name).catch(() => null)));
      chunk.forEach((k, j) => {
        const text = entryText(safeParse(values[j]));
        if (text) rows.push({ label: k.name.slice(prefix.length), text });
      });
    }
  } catch (e) {
    console.error("[ai-proxy] layer load failed", prefix, e.message);
  }
  return rows;
}
__name(loadLayer, "loadLayer");
async function knowledgeBase(env) {
  const now = Date.now();
  if (kbCache.layers && now - kbCache.at < CONFIG.KB_TTL) return kbCache.layers;
  const [master, memory, knowledge] = await Promise.all([
    loadLayer(env.MASTER_TRUTHS, "master:", CONFIG.KB_SCAN),
    loadLayer(env.MEM, "truth:", CONFIG.KB_SCAN),
    loadLayer(env.ORP, "elevated:", CONFIG.KB_SCAN)
  ]);
  kbCache = { at: now, layers: { master, memory, knowledge } };
  console.log("[ai-proxy] kb loaded", master.length, memory.length, knowledge.length);
  return kbCache.layers;
}
__name(knowledgeBase, "knowledgeBase");
async function retrieve(query, env, limit = CONFIG.KB_RESULTS) {
  const qt = tokens(query);
  if (!qt.length) return [];
  const layers = await knowledgeBase(env);
  const results = [];
  for (const [layer, rows] of Object.entries(layers)) {
    for (const row of rows) {
      const s = score(qt, `${row.label} ${row.text}`);
      if (s > 0.2) results.push({ layer, label: row.label, content: row.text, score: s });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
__name(retrieve, "retrieve");
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
async function aiText(messages, env, opts = {}) {
  if (!env.AI) throw new Error("AI binding missing");
  const out = await env.AI.run(opts.model && !opts.model.startsWith("@") ? opts.model : CONFIG.AI_MODEL, {
    messages,
    max_tokens: opts.max_tokens || 1024,
    temperature: opts.temperature ?? 0.3
  });
  const text = typeof out === "string" && out || out?.response || out?.choices?.[0]?.message?.content || out?.result?.response || "";
  if (!text) throw new Error("empty model response");
  return { text, model: CONFIG.AI_MODEL, route: "workers-ai" };
}
__name(aiText, "aiText");
async function orText(messages, env, opts = {}) {
  if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");
  const res = await fetch(CONFIG.OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.api_key || env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": CONFIG.SITE_URL,
      "X-Title": CONFIG.SITE_TITLE
    },
    body: JSON.stringify({
      model: opts.model || "@preset/truth",
      messages,
      stream: false,
      max_tokens: opts.max_tokens || 1024,
      temperature: opts.temperature ?? 0.3
    })
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("empty OpenRouter response");
  return { text, model: data?.model || opts.model || "@preset/truth", route: "openrouter" };
}
__name(orText, "orText");
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
function toOpenAISSE(stream, model) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.response ?? parsed.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ model, choices: [{ delta: { content: delta } }] })}

`
                )
              );
            }
          } catch {
          }
        }
      },
      flush(controller) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      }
    })
  );
}
__name(toOpenAISSE, "toOpenAISSE");
async function streamChat(messages, env, opts = {}) {
  if (env.OPENROUTER_API_KEY && opts.model && !opts.model.startsWith("@") && opts.preferOpenRouter) {
    const res = await fetch(CONFIG.OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": CONFIG.SITE_URL,
        "X-Title": CONFIG.SITE_TITLE
      },
      body: JSON.stringify({ model: opts.model, messages, stream: true, temperature: opts.temperature ?? 0.3 })
    });
    if (res.ok && res.body) return res.body;
  }
  if (!env.AI) throw new Error("AI binding missing");
  const raw = await env.AI.run(CONFIG.AI_MODEL, {
    messages,
    stream: true,
    max_tokens: opts.max_tokens || 1024,
    temperature: opts.temperature ?? 0.3
  });
  return toOpenAISSE(raw, CONFIG.AI_MODEL);
}
__name(streamChat, "streamChat");
function sse(body) {
  return new Response(body, {
    headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
  });
}
__name(sse, "sse");
async function embed(text, env) {
  const input = String(text || "").slice(0, CONFIG.MAX_TEXT);
  if (!input) throw new Error("text required");
  if (env.OPENROUTER_API_KEY) {
    try {
      const res = await fetch(CONFIG.EMBEDDING_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: CONFIG.EMBEDDING_MODEL, input })
      });
      if (res.ok) {
        const data = await res.json();
        const vec = data?.data?.[0]?.embedding;
        if (Array.isArray(vec) && vec.length) return vec;
      }
    } catch (e) {
      console.error("[ai-proxy] openrouter embed failed:", e.message);
    }
  }
  if (env.AI) {
    const out = await env.AI.run(CONFIG.AI_EMBED_MODEL, { text: [input] });
    const vec = out?.data?.[0];
    if (Array.isArray(vec) && vec.length) return vec;
  }
  throw new Error("embedding unavailable");
}
__name(embed, "embed");
async function elevatedIndex(env) {
  return await readJson(env.ORP, "elevated:index") || [];
}
__name(elevatedIndex, "elevatedIndex");
async function putKnowledge(entry, env) {
  const id = entry.id || `elv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const prior = await readJson(env.ORP, `elevated:${id}`);
  const record = {
    id,
    title: entry.title || "Untitled",
    content: entry.content || "",
    domains: entry.domains || ["general"],
    confidence: Math.min(Number(entry.confidence) || 0.65, 0.8),
    source: entry.source || "auto",
    embedding: entry.embedding || prior && prior.embedding || [],
    createdAt: prior && prior.createdAt || now,
    updatedAt: now
  };
  await env.ORP.put(`elevated:${id}`, JSON.stringify(record));
  const index = await elevatedIndex(env);
  const summary = { id, title: record.title, domains: record.domains, confidence: record.confidence, createdAt: record.createdAt };
  const at = index.findIndex((e) => e.id === id);
  if (at >= 0) index[at] = summary;
  else index.push(summary);
  await env.ORP.put("elevated:index", JSON.stringify(index));
  kbCache = { at: 0, layers: null };
  return record;
}
__name(putKnowledge, "putKnowledge");
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
async function pushProvisional(query, answer, model, env) {
  if (!env.TRUTH || !answer || answer.length < 40) return null;
  try {
    const res = await env.TRUTH.fetch("https://truth/api/truth/provisional/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // truth's handler keys off `id` or `input`, and normalises the id from the
      // text itself. Sending `query` was silently rejected with 400 every time.
      body: JSON.stringify({
        input: String(query).slice(0, 500),
        answer: String(answer).slice(0, CONFIG.MAX_TEXT),
        meta: { model: model || CONFIG.AI_MODEL, confidence: 0.7, qc_passed: true }
      })
    });
    if (!res.ok) {
      console.error("[ai-proxy] provisional push rejected:", res.status);
      return null;
    }
    return await res.json().catch(() => null);
  } catch (e) {
    console.error("[ai-proxy] provisional push failed:", e.message);
    return null;
  }
}
__name(pushProvisional, "pushProvisional");
async function handleChat(request, env, runtime) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const text = typeof body.message === "string" ? body.message : "";
  let messages = Array.isArray(body.messages) ? body.messages.slice() : [];
  if (!messages.length && text) messages = [{ role: "user", content: text }];
  if (!messages.length) return fail(400, "missing_message", { hint: "send {message} or {messages:[{role,content}]}" });
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const hits = lastUser ? await retrieve(lastUser.content, env) : [];
  const ctx = contextBlock(hits);
  if (ctx) messages.unshift(ctx);
  const opts = {
    model: body.model || body.preset,
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    api_key: body.api_key,
    preferOpenRouter: body.provider === "openrouter"
  };
  if (body.stream) {
    try {
      return sse(await streamChat(messages, env, opts));
    } catch (e) {
      return fail(502, "model_failed", { message: e.message });
    }
  }
  try {
    const out = await complete(messages, env, opts);
    if (lastUser) runtime.waitUntil(learnFromAnswer(lastUser.content, out.text, "Chat", env).catch(() => {
    }));
    return json({ text: out.text, route: out.route, model: out.model, context: hits.length });
  } catch (e) {
    return fail(502, "model_failed", { message: e.message });
  }
}
__name(handleChat, "handleChat");
async function handleCandidate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const query = body.query || body.input || body.prompt;
  const id = body.id || "";
  if (!query) return fail(400, "missing_query", { id });
  const hits = await retrieve(query, env);
  const ctx = contextBlock(hits);
  const instruction = body.instruction || "You are a backend JSON generator. Return ONLY a valid JSON array of candidate truths matching the provided JSON Schema. No prose, no markdown, no extra keys.";
  const messages = [];
  if (ctx) messages.push(ctx);
  messages.push({
    role: "system",
    content: instruction + '\nRespond with a JSON array like [{"answer":"...","model":"...","confidence":0.7,"citations":[]}]. No code fences. No commentary. One to three elements.'
  });
  messages.push({ role: "user", content: String(query) });
  let lastErr = "no_attempt";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await complete(messages, env, { model: body.model, temperature: 0.2, max_tokens: 700 });
      const arr = extractJsonArray(out.text);
      if (arr && arr.length) {
        const cleaned = arr.filter((c) => c && typeof c.answer === "string" && c.answer.trim()).map((c) => ({
          answer: c.answer.trim(),
          model: out.model,
          // the model's self-report is unreliable (it echoes context labels)
          confidence: typeof c.confidence === "number" ? c.confidence : 0.7,
          citations: Array.isArray(c.citations) ? c.citations : []
        })).slice(0, 3);
        if (cleaned.length) return json(cleaned);
      }
      lastErr = "NO_CANDIDATE";
      messages.push({ role: "user", content: "That was not a bare JSON array. Return only the array, nothing else." });
    } catch (e) {
      lastErr = e.message;
      break;
    }
  }
  return fail(502, "no_candidate", { message: lastErr, id, context: hits.length });
}
__name(handleCandidate, "handleCandidate");
function extractJsonArray(text) {
  if (!text) return null;
  let t = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(t.slice(start, end + 1));
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}
__name(extractJsonArray, "extractJsonArray");
async function handleGenerate(request, env, runtime) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice() : [];
  const prompt = body.prompt || messages.filter((m) => m.role === "user").pop()?.content || "";
  if (!messages.length && !prompt) return fail(400, "missing_prompt");
  if (!messages.length) messages.push({ role: "user", content: prompt });
  const hits = prompt ? await retrieve(prompt, env) : [];
  const ctx = contextBlock(hits);
  if (ctx) messages.unshift(ctx);
  const opts = {
    model: body.model || body.preset,
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    api_key: body.api_key,
    preferOpenRouter: !!body.api_key
  };
  if (body.stream) {
    try {
      return sse(await streamChat(messages, env, opts));
    } catch (e) {
      return fail(502, "model_failed", { message: e.message });
    }
  }
  try {
    const out = await complete(messages, env, opts);
    if (prompt) runtime.waitUntil(learnFromAnswer(prompt, out.text, "Query", env).catch(() => {
    }));
    return json({
      choices: [{ message: { role: "assistant", content: out.text } }],
      text: out.text,
      model: out.model,
      route: out.route,
      context: hits.length
    });
  } catch (e) {
    return fail(502, "model_failed", { message: e.message });
  }
}
__name(handleGenerate, "handleGenerate");
async function handleCode(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const prompt = body.prompt || body.message || body.code;
  if (!prompt) return fail(400, "missing_prompt");
  const messages = [
    { role: "system", content: "You are a precise coding assistant. Return code first, then a short explanation. No filler." },
    { role: "user", content: String(prompt) }
  ];
  try {
    const out = await complete(messages, env, { model: body.model, temperature: 0.2, max_tokens: body.max_tokens || 1200 });
    return json({ text: out.text, model: out.model, route: out.route });
  } catch (e) {
    return fail(502, "model_failed", { message: e.message });
  }
}
__name(handleCode, "handleCode");
async function handleAudit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const { content, messages, type = "docket", audit_id, stream = true } = body;
  let chat = Array.isArray(messages) && messages.length ? messages.slice() : [];
  if (audit_id && !chat.length) {
    const prior = await readJson(env.AUDITS, `audit:${audit_id}`);
    if (prior && Array.isArray(prior.messages)) chat = prior.messages.slice();
  }
  if (!chat.length) {
    if (!content) return fail(400, "content_required");
    chat = [
      { role: "system", content: AUDIT_SYSTEM_PROMPT },
      { role: "user", content: String(content) }
    ];
  }
  const lastUser = [...chat].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const hits = await retrieve(lastUser.content, env);
    const ctx = contextBlock(hits);
    if (ctx) chat.splice(chat.length - 1, 0, ctx);
  }
  if (stream) {
    try {
      return sse(await streamChat(chat, env, { temperature: 0.35, max_tokens: 1200 }));
    } catch (e) {
      return fail(502, "model_failed", { message: e.message });
    }
  }
  try {
    const out = await complete(chat, env, { temperature: 0.35, max_tokens: 1200 });
    return json({ choices: [{ message: { role: "assistant", content: out.text } }], text: out.text, model: out.model, type });
  } catch (e) {
    return fail(502, "model_failed", { message: e.message });
  }
}
__name(handleAudit, "handleAudit");
async function handleAuditStore(request, env, runtime) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json");
  }
  const { content, type = "docket", fullText, messages, audit_id } = body;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (audit_id) {
    const existing = await readJson(env.AUDITS, `audit:${audit_id}`);
    if (existing) {
      existing.messages = messages || existing.messages;
      existing.lastResponse = fullText || existing.lastResponse;
      existing.updatedAt = now;
      await storeAudit(existing, env);
      runtime.waitUntil(pushAuditCard({ ...existing, status: existing.status || "updated" }, env).catch(() => {
      }));
      const query = (messages || []).filter((m) => m.role === "user").pop()?.content || content || "";
      if (query && fullText) {
        runtime.waitUntil(learnFromAnswer(query, fullText, "Audit", env).catch(() => {
        }));
        runtime.waitUntil(pushProvisional(query, fullText, null, env).catch(() => {
        }));
      }
      return json({ audit_id });
    }
  }
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    type,
    messages: messages || [
      { role: "system", content: AUDIT_SYSTEM_PROMPT },
      { role: "user", content: content || "" }
    ],
    lastResponse: fullText || "",
    rawText: fullText || content || "",
    status: "completed",
    overallConfidence: 0.65,
    createdAt: now
  };
  await storeAudit(record, env);
  runtime.waitUntil(pushAuditCard(record, env).catch(() => {
  }));
  if (content && fullText) {
    runtime.waitUntil(learnFromAnswer(content, fullText, "Audit", env).catch(() => {
    }));
    runtime.waitUntil(pushProvisional(content, fullText, null, env).catch(() => {
    }));
  }
  return json({ audit_id: id });
}
__name(handleAuditStore, "handleAuditStore");
var PAYMENT_INFO = {
  doc_prep: {
    label: "Document Preparation",
    range: "$50-100",
    chime: "chime.me/@ai-nspired",
    cashapp: "$AINspired",
    description: "Automated generation of motions, pleadings, and responses based on your audit findings."
  },
  consult: {
    label: "Private Consultation",
    range: "$500-750",
    chime: "chime.me/@ai-nspired",
    cashapp: "$AINspired",
    description: "Personal review session with expert legal counsel to discuss your audit results and strategy."
  }
};
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
async function handleAdmin(request, env, url) {
  if (!env.ADMIN_SECRET) return fail(503, "admin_not_configured", { hint: "set the ADMIN_SECRET secret" });
  if (!secretOk(env, request)) return fail(401, "unauthorized");
  const path = url.pathname.replace("/api/admin", "");
  if (path === "/stats" || path === "" || path === "/") {
    const counts = {};
    for (const [label, kv, prefix] of [
      ["master", env.MASTER_TRUTHS, "master:"],
      ["memory", env.MEM, "truth:"],
      ["provisional", env.MEM, "provisional:"],
      ["knowledge", env.ORP, "elevated:"]
    ]) {
      try {
        counts[label] = (await listKeys(kv, prefix, 5e3)).length;
      } catch {
        counts[label] = null;
      }
    }
    return json({ counts, bindings: bindingReport(env) });
  }
  if (path === "/knowledge" && request.method === "GET") {
    return json({ entries: await elevatedIndex(env) });
  }
  if (path === "/knowledge" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !body.content) return fail(400, "content_required");
    const embedding = await embed(body.content, env).catch(() => []);
    const entry = await putKnowledge({ ...body, source: "admin", embedding }, env);
    return json({ success: true, entry });
  }
  if (path === "/knowledge/search" && request.method === "GET") {
    const q = url.searchParams.get("q");
    if (!q) return fail(400, "q_required");
    return json({ results: await retrieve(q, env, 10) });
  }
  if (path.startsWith("/knowledge/") && request.method === "GET") {
    const entry = await readJson(env.ORP, `elevated:${path.split("/").pop()}`);
    return entry ? json(entry) : fail(404, "not_found");
  }
  if (path.startsWith("/knowledge/") && request.method === "PUT") {
    const id = path.split("/").pop();
    const prior = await readJson(env.ORP, `elevated:${id}`);
    if (!prior) return fail(404, "not_found");
    const body = await request.json().catch(() => ({}));
    const embedding = body.content && body.content !== prior.content ? await embed(body.content, env).catch(() => prior.embedding) : prior.embedding;
    const entry = await putKnowledge({ ...prior, ...body, id, embedding }, env);
    return json({ success: true, entry });
  }
  if (path.startsWith("/knowledge/") && request.method === "DELETE") {
    const id = path.split("/").pop();
    await env.ORP.delete(`elevated:${id}`);
    const index = (await elevatedIndex(env)).filter((e) => e.id !== id);
    await env.ORP.put("elevated:index", JSON.stringify(index));
    return json({ success: true });
  }
  if (path === "/audits" && request.method === "GET") {
    const keys = await listKeys(env.AUDITS, "audit:", Number(url.searchParams.get("limit")) || 50);
    return json({ audits: keys.map((k) => ({ id: k.name.slice(6), ...k.metadata || {} })) });
  }
  return fail(404, "not_found");
}
__name(handleAdmin, "handleAdmin");
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
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (p === "/" || p === "") {
      return new Response(
        `AI Proxy Service \u2014 single entry point

Endpoints:
  GET  /health
  POST /api/chat          {message|messages, stream}
  POST /api/generate      {prompt|messages, stream}
  POST /api/code          {prompt}
  POST /candidate         {id, query, model, instruction, schema} -> JSON array
  POST /api/embed         {text}
  POST /api/context       {context_id, message}
  POST /api/context/clear {context_id}
  GET  /api/elevated
  POST /v1/audit          {content|messages, type, stream}
  POST /v1/audit/store    {content, fullText, messages, audit_id} -> {audit_id}
  GET  /v1/audit/:id
  POST /v1/pipeline       {audit_id, action, contact}
  ANY  /api/admin/*       X-Admin-Secret

Knowledge stores: master truths + Memoria. Audits land in the curation queue.
`,
        { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
    try {
      if (p === "/health") {
        return json({
          status: "healthy",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          service: "ai-proxy",
          bindings: bindingReport(env),
          retrieval: {
            masterTruths: env.MASTER_TRUTHS ? "904eff3a master truths" : null,
            memoria: env.MEM ? "4a9bfbff Memoria" : null,
            knowledge: env.ORP ? "145a30ed ORP" : null
          }
        });
      }
      if (p === "/api/chat" && request.method === "POST") return handleChat(request, env, ctx);
      if ((p === "/candidate" || p === "/api/candidate") && request.method === "POST") return handleCandidate(request, env);
      if (p === "/api/generate" && request.method === "POST") return handleGenerate(request, env, ctx);
      if (p === "/api/code" && request.method === "POST") return handleCode(request, env);
      if (p === "/api/mcp") {
        return fail(501, "mcp_not_implemented", {
          message: "The old dashboard build exposed MCP here and this repo build does not. Tell me what it needs and it comes back on this route."
        });
      }
      if (p === "/api/embed" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !body.text) return fail(400, "text_required");
        try {
          return json({ embedding: await embed(body.text, env) });
        } catch (e) {
          return fail(502, "embed_failed", { message: e.message });
        }
      }
      if (p === "/api/context" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!body || !body.message) return fail(400, "message_required");
        const id = body.context_id || "default";
        const key = `ctx:${id}:data`;
        const prior = await readJson(env.CONTEXT_STORE, key) || [];
        const embedding = await embed(body.message, env).catch(() => []);
        prior.push({ role: body.role || "user", content: String(body.message).slice(0, CONFIG.MAX_TEXT), embedding, at: Date.now() });
        const trimmed = prior.slice(-100);
        await env.CONTEXT_STORE.put(key, JSON.stringify(trimmed));
        return json({ success: true, context_id: id, messages: trimmed.length });
      }
      if (p === "/api/context/clear" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        await env.CONTEXT_STORE.delete(`ctx:${body.context_id || "default"}:data`);
        return json({ success: true });
      }
      if (p === "/api/elevated" && request.method === "GET") {
        return json({ entries: await elevatedIndex(env) });
      }
      if (p === "/api/elevated/search" && request.method === "GET") {
        const q = url.searchParams.get("q");
        if (!q) return fail(400, "q_required");
        return json({ results: await retrieve(q, env, 10) });
      }
      if (p.startsWith("/api/admin/")) return handleAdmin(request, env, url);
      if (p === "/v1/audit" && request.method === "POST") return handleAudit(request, env);
      if (p === "/v1/audit/store" && request.method === "POST") return handleAuditStore(request, env, ctx);
      if (/^\/v1\/audit\/[^/]+$/.test(p) && request.method === "GET") {
        const id = p.split("/").pop();
        const audit = await readJson(env.AUDITS, `audit:${id}`);
        return audit ? json(audit) : fail(404, "audit_not_found");
      }
      if (p === "/v1/pipeline" && request.method === "POST") return handlePipeline(request, env);
      return fail(404, "not_found", {
        available_endpoints: ["/api/chat", "/api/code", "/api/generate", "/candidate", "/api/mcp", "/api/embed", "/api/context", "/api/elevated", "/api/admin/*", "/v1/audit", "/v1/audit/store", "/v1/pipeline", "/health", "/"]
      });
    } catch (e) {
      console.error("[ai-proxy] unhandled", p, e.stack || e.message);
      return fail(500, "internal_error", { message: e.message });
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map