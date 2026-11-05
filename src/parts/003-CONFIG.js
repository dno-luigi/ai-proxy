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
