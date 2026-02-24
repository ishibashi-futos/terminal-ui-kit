import { getDisplayWidth } from "../../utils/width";

interface InputLayout {
  lines: string[]; // ターミナルに描画する行の配列
  cursorRow: number; // カーソルが位置すべき行（0オリジン）
  cursorCol: number; // カーソルが位置すべき列（0オリジン、表示幅ベース）
}

/**
 * 入力バッファから描画用のデータとカーソル位置を計算する
 */
export function buildInputLines(
  buffer: string,
  cursorIndex: number,
  prompt: string,
  promptWidth: number,
): InputLayout {
  const indent = " ".repeat(promptWidth);
  const rawLines = buffer.split("\n");
  const displayLines: string[] = [];

  let cursorRow = 0;
  let cursorCol = 0;
  let remainingIndex = cursorIndex;
  let foundCursor = false;

  rawLines.forEach((line, i) => {
    // 1. 表示文字列の構築
    const prefix = i === 0 ? prompt : indent;
    displayLines.push(prefix + line);

    // 2. カーソル位置の計算（まだ見つかっていない場合）
    if (!foundCursor) {
      // +1 は改行コード分。ただし最後の行に改行はないので調整
      const lineLengthWithSeparator = line.length + 1;

      if (remainingIndex <= line.length) {
        // この行の中にカーソルがある
        cursorRow = i;
        // 日本語（全角）を考慮して表示幅で列を計算
        const textBeforeCursor = line.slice(0, remainingIndex);
        cursorCol = promptWidth + getDisplayWidth(textBeforeCursor);
        foundCursor = true;
      } else {
        remainingIndex -= lineLengthWithSeparator;
      }
    }
  });

  // 万が一、インデックスが末尾を超えていた場合のフォールバック
  if (!foundCursor) {
    cursorRow = rawLines.length - 1;
    cursorCol = promptWidth + getDisplayWidth(rawLines[cursorRow]!);
  }

  return {
    lines: displayLines,
    cursorRow,
    cursorCol,
  };
}

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
