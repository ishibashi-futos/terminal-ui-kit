export interface CompletionResult {
  buffer: string;
  cursorIndex: number;
  completed: boolean;
}

export function getSharedPrefix(values: string[]): string {
  if (values.length === 0) {
    return "";
  }

  let prefix = values[0] ?? "";
  for (let i = 1; i < values.length; i++) {
    const value = values[i] ?? "";
    let nextIndex = 0;
    while (
      nextIndex < prefix.length &&
      prefix[nextIndex] === value[nextIndex]
    ) {
      nextIndex++;
    }
    prefix = prefix.slice(0, nextIndex);
    if (!prefix) {
      break;
    }
  }

  return prefix;
}
