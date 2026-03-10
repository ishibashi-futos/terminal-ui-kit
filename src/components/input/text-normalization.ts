export function normalizeInputChunk(chunk: string): string {
  return chunk
    .replace(/\u001b\[200~/g, "")
    .replace(/\u001b\[201~/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}
