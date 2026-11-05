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
