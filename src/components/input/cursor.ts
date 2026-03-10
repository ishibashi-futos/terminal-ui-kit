interface CursorLinePosition {
  currentLineIndex: number;
  currentColumn: number;
  lineStarts: number[];
  rawLines: string[];
}

interface VerticalMoveResult {
  cursorIndex: number;
  preferredColumn: number;
}

export type LineJumpDirection = "start" | "end";

export function getCursorLinePosition(
  buffer: string,
  cursorIndex: number,
): CursorLinePosition {
  const rawLines = buffer.split("\n");
  const lineStarts: number[] = [];

  let offset = 0;
  rawLines.forEach((line) => {
    lineStarts.push(offset);
    offset += line.length + 1;
  });

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    const lineStart = lineStarts[i]!;
    const lineEnd = lineStart + line.length;

    if (cursorIndex <= lineEnd) {
      return {
        currentLineIndex: i,
        currentColumn: cursorIndex - lineStart,
        lineStarts,
        rawLines,
      };
    }
  }

  const lastLineIndex = rawLines.length - 1;
  const lastLine = rawLines[lastLineIndex] ?? "";
  const lastLineStart = lineStarts[lastLineIndex] ?? 0;

  return {
    currentLineIndex: lastLineIndex,
    currentColumn: lastLine.length,
    lineStarts,
    rawLines,
  };
}

export function resolveVerticalCursorMove(
  buffer: string,
  cursorIndex: number,
  preferredColumn: number | null,
  direction: -1 | 1,
): VerticalMoveResult | null {
  const { currentLineIndex, currentColumn, lineStarts, rawLines } =
    getCursorLinePosition(buffer, cursorIndex);
  const targetLineIndex = currentLineIndex + direction;

  if (targetLineIndex < 0 || targetLineIndex >= rawLines.length) {
    return null;
  }

  const baseColumn = preferredColumn ?? currentColumn;
  const targetLine = rawLines[targetLineIndex] ?? "";
  const targetColumn = Math.min(baseColumn, targetLine.length);

  return {
    cursorIndex: (lineStarts[targetLineIndex] ?? 0) + targetColumn,
    preferredColumn: baseColumn,
  };
}

export function resolveLineJumpCursorIndex(
  buffer: string,
  cursorIndex: number,
  direction: LineJumpDirection,
): number {
  const { currentLineIndex, lineStarts, rawLines } = getCursorLinePosition(
    buffer,
    cursorIndex,
  );
  const lineStart = lineStarts[currentLineIndex] ?? 0;
  if (direction === "start") {
    return lineStart;
  }

  const lineLength = rawLines[currentLineIndex]?.length ?? 0;
  return lineStart + lineLength;
}
