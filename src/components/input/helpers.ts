import { getDisplayWidth } from "../../utils/width";

interface InputLayout {
  lines: string[]; // ターミナルに描画する行の配列
  cursorRow: number; // カーソルが位置すべき行（0オリジン）
  cursorCol: number; // カーソルが位置すべき列（0オリジン、表示幅ベース）
  totalRows: number; // 自動折り返し後を含む全表示行数
}

export interface InputCommand {
  name: string;
  description?: string;
  callback?: (
    this: any,
    args: string[],
    rawInput: string,
  ) => void | Promise<void>;
  bind?: unknown;
}

export interface SlashCommandState {
  suggestions: InputCommand[];
  replacementStart: number;
  replacementEnd: number;
  query: string;
}

/**
 * 入力バッファから描画用のデータとカーソル位置を計算する
 */
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

  rawLines.forEach((line, i) => {
    // 1. 表示文字列の構築
    const prefix = i === 0 ? prompt : indent;
    const displayLine = prefix + line;
    const displayLineWidth = getDisplayWidth(displayLine);
    displayLines.push(displayLine);

    // 2. カーソル位置の計算（まだ見つかっていない場合）
    if (!foundCursor) {
      // +1 は改行コード分。ただし最後の行に改行はないので調整
      const lineLengthWithSeparator = line.length + 1;

      if (remainingIndex <= line.length) {
        // この行の中にカーソルがある
        // 日本語（全角）を考慮して表示幅で列を計算
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

    if (i < rawLines.length - 1) {
      // 改行文字のぶん 1 行進む + 行内の自動折り返しぶん進む
      visualRowOffset += getWrappedRowOffset(displayLineWidth) + 1;
    }
  });

  // 万が一、インデックスが末尾を超えていた場合のフォールバック
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

export function normalizeInputChunk(chunk: string): string {
  return chunk
    .replace(/\u001b\[200~/g, "")
    .replace(/\u001b\[201~/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function getLineRange(buffer: string, cursorIndex: number) {
  const beforeCursor = buffer.slice(0, cursorIndex);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const lineEndIndex = buffer.indexOf("\n", cursorIndex);
  const lineEnd = lineEndIndex === -1 ? buffer.length : lineEndIndex;
  const line = buffer.slice(lineStart, lineEnd);

  return {
    lineStart,
    line,
  };
}

export function resolveSlashCommandState(
  buffer: string,
  cursorIndex: number,
  commands: InputCommand[],
  maxSuggestions: number = 5,
): SlashCommandState | null {
  if (commands.length === 0) {
    return null;
  }

  const { lineStart, line } = getLineRange(buffer, cursorIndex);
  if (!line.startsWith("/")) {
    return null;
  }

  const commandPart = line.slice(1);
  const separatorIndex = commandPart.search(/\s/);
  const commandEndInLine =
    separatorIndex === -1 ? line.length : separatorIndex + 1;
  const replacementStart = lineStart + 1;
  const replacementEnd = lineStart + commandEndInLine;

  if (cursorIndex < replacementStart || cursorIndex > replacementEnd) {
    return null;
  }

  const query = buffer.slice(replacementStart, cursorIndex);
  const suggestions = commands
    .filter((command) => command.name.startsWith(query))
    .slice(0, maxSuggestions);

  if (suggestions.length === 0) {
    return null;
  }

  return {
    suggestions,
    replacementStart,
    replacementEnd,
    query,
  };
}

function getSharedPrefix(values: string[]): string {
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

interface CompletionResult {
  buffer: string;
  cursorIndex: number;
  completed: boolean;
}

export function completeSlashCommand(
  buffer: string,
  cursorIndex: number,
  commands: InputCommand[],
): CompletionResult {
  const state = resolveSlashCommandState(buffer, cursorIndex, commands);
  if (!state) {
    return {
      buffer,
      cursorIndex,
      completed: false,
    };
  }

  const suggestionNames = state.suggestions.map(
    (suggestion) => suggestion.name,
  );
  const replacement =
    suggestionNames.length === 1
      ? (suggestionNames[0] ?? state.query)
      : getSharedPrefix(suggestionNames);

  if (replacement.length <= state.query.length) {
    return {
      buffer,
      cursorIndex,
      completed: false,
    };
  }

  const nextBuffer =
    buffer.slice(0, state.replacementStart) +
    replacement +
    buffer.slice(state.replacementEnd);
  const nextCursorIndex = state.replacementStart + replacement.length;

  return {
    buffer: nextBuffer,
    cursorIndex: nextCursorIndex,
    completed: true,
  };
}

export function buildSlashCommandHintLines(commands: InputCommand[]): string[] {
  return commands.map((command) => {
    if (!command.description) {
      return `  /${command.name}`;
    }

    return `  /${command.name} - ${command.description}`;
  });
}

interface ResolvedSubmittedCommand {
  command: InputCommand;
  args: string[];
}

function resolveSubmittedSlashCommand(
  input: string,
  commands: InputCommand[],
): ResolvedSubmittedCommand | null {
  const normalized = input.trim();
  if (!normalized.startsWith("/")) {
    return null;
  }

  const [rawCommandName, ...args] = normalized.slice(1).split(/\s+/);
  const commandName = rawCommandName ?? "";
  if (!commandName) {
    return null;
  }

  const command = commands.find((candidate) => candidate.name === commandName);
  if (!command) {
    return null;
  }

  return {
    command,
    args,
  };
}

export async function runSlashCommandCallback(
  input: string,
  commands: InputCommand[],
): Promise<boolean> {
  const resolved = resolveSubmittedSlashCommand(input, commands);
  if (!resolved?.command.callback) {
    return false;
  }

  // bind 指定がある場合は this を固定して callback を実行する
  const callback =
    typeof resolved.command.bind !== "undefined"
      ? resolved.command.callback.bind(resolved.command.bind)
      : resolved.command.callback;

  await callback(resolved.args, input);
  return true;
}
