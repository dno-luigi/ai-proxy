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
