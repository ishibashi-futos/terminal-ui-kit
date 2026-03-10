import { getDisplayWidth } from "../../utils/width";

export interface InputLayout {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  totalRows: number;
}

export function buildInputLines(
  buffer: string,
  cursorIndex: number,
  prompt: string,
  promptWidth: number,
  terminalWidth?: number,
): InputLayout {
  const indent = " ".repeat(promptWidth);
  const rawLines = buffer.split("\n");
  const displayLines: string[] = [];

  let cursorRow = 0;
  let cursorCol = 0;
  let remainingIndex = cursorIndex;
  let foundCursor = false;
  let visualRowOffset = 0;
  const hasWrap = typeof terminalWidth === "number" && terminalWidth > 0;

  const getWrappedRowOffset = (displayWidth: number) => {
    if (!hasWrap) {
      return 0;
    }

    return Math.floor(displayWidth / terminalWidth);
  };

  rawLines.forEach((line, index) => {
    const prefix = index === 0 ? prompt : indent;
    const displayLine = prefix + line;
    const displayLineWidth = getDisplayWidth(displayLine);
    displayLines.push(displayLine);

    if (!foundCursor) {
      const lineLengthWithSeparator = line.length + 1;

      if (remainingIndex <= line.length) {
        const textBeforeCursor = line.slice(0, remainingIndex);
        const rawCursorCol = promptWidth + getDisplayWidth(textBeforeCursor);
        const wrappedCursorRowOffset = getWrappedRowOffset(rawCursorCol);
        cursorRow = visualRowOffset + wrappedCursorRowOffset;
        cursorCol = hasWrap ? rawCursorCol % terminalWidth : rawCursorCol;
        foundCursor = true;
      } else {
        remainingIndex -= lineLengthWithSeparator;
      }
    }

    if (index < rawLines.length - 1) {
      visualRowOffset += getWrappedRowOffset(displayLineWidth) + 1;
    }
  });

  if (!foundCursor) {
    const fallbackLineIndex = rawLines.length - 1;
    const rawCursorCol =
      promptWidth + getDisplayWidth(rawLines[fallbackLineIndex]!);
    const wrappedCursorRowOffset = getWrappedRowOffset(rawCursorCol);
    cursorRow = visualRowOffset + wrappedCursorRowOffset;
    cursorCol = hasWrap ? rawCursorCol % terminalWidth : rawCursorCol;
  }

  const lastDisplayLine = displayLines[displayLines.length - 1] ?? "";
  const totalRows =
    visualRowOffset + getWrappedRowOffset(getDisplayWidth(lastDisplayLine)) + 1;

  return {
    lines: displayLines,
    cursorRow,
    cursorCol,
    totalRows,
  };
}
