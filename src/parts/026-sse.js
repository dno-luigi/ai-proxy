function sse(body) {
  return new Response(body, {
    headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
  });
}
__name(sse, "sse");
