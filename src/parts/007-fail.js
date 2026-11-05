function fail(status, code, extra) {
  return json({ error: code, ...extra || {} }, status);
}
__name(fail, "fail");
