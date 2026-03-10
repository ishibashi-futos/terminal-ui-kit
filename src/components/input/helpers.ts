import { getDisplayWidth } from "../../utils/width";
import { readFileSync, readdirSync, statSync, type Dirent } from "node:fs";
import { dirname, resolve } from "node:path";

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

interface MentionPathState {
  suggestions: string[];
  replacementStart: number;
  replacementEnd: number;
  query: string;
}

export type InputMentionError = "binary_file" | "invalid_range" | "too_large";

export interface InputMention {
  path: string;
  startLine: number;
  endLine: number;
  content: string | null;
  truncated: boolean;
  error?: InputMentionError;
}

interface ParsedMentionToken {
  path: string;
  startLine: number;
  endLine: number;
  hasExplicitRange: boolean;
  hasInvalidRange: boolean;
}

const MAX_MENTION_DEFAULT_LINES = 100;
const MAX_MENTION_FILE_SIZE_BYTES = 60348;

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

function toUnixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function parseMentionToken(rawToken: string): ParsedMentionToken | null {
  const normalized = toUnixPath(rawToken);
  const separatorIndex = normalized.indexOf(":");

  if (separatorIndex === -1) {
    if (!normalized) {
      return null;
    }

    return {
      path: normalized,
      startLine: 1,
      endLine: MAX_MENTION_DEFAULT_LINES,
      hasExplicitRange: false,
      hasInvalidRange: false,
    };
  }

  const path = normalized.slice(0, separatorIndex);
  const rawRange = normalized.slice(separatorIndex + 1);
  if (!path) {
    return null;
  }

  const singleLineMatch = rawRange.match(/^(\d+)$/);
  if (singleLineMatch) {
    const line = Number.parseInt(singleLineMatch[1]!, 10);
    return {
      path,
      startLine: line,
      endLine: line,
      hasExplicitRange: true,
      hasInvalidRange: line <= 0,
    };
  }

  const rangeMatch = rawRange.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const startLine = Number.parseInt(rangeMatch[1]!, 10);
    const endLine = Number.parseInt(rangeMatch[2]!, 10);
    return {
      path,
      startLine,
      endLine,
      hasExplicitRange: true,
      hasInvalidRange: startLine <= 0 || endLine <= 0 || startLine > endLine,
    };
  }

  return {
    path,
    startLine: 1,
    endLine: MAX_MENTION_DEFAULT_LINES,
    hasExplicitRange: true,
    hasInvalidRange: true,
  };
}

function buildMentionError(
  parsed: ParsedMentionToken,
  error: InputMentionError,
): InputMention {
  return {
    path: parsed.path,
    startLine: parsed.startLine,
    endLine: parsed.endLine,
    content: null,
    truncated: false,
    error,
  };
}

function resolveMentionContent(
  parsed: ParsedMentionToken,
  cwd: string,
): InputMention | null {
  const absolutePath = resolve(cwd, parsed.path);

  let stat;
  try {
    stat = statSync(absolutePath);
  } catch {
    return null;
  }

  if (!stat.isFile()) {
    return null;
  }

  if (parsed.hasInvalidRange) {
    return buildMentionError(parsed, "invalid_range");
  }

  if (stat.size > MAX_MENTION_FILE_SIZE_BYTES) {
    return buildMentionError(parsed, "too_large");
  }

  const buffer = readFileSync(absolutePath);
  if (buffer.includes(0)) {
    return buildMentionError(parsed, "binary_file");
  }

  const lines = buffer.toString("utf8").split(/\r?\n/);
  if (parsed.hasExplicitRange) {
    if (parsed.endLine > lines.length) {
      return buildMentionError(parsed, "invalid_range");
    }

    return {
      path: parsed.path,
      startLine: parsed.startLine,
      endLine: parsed.endLine,
      content: lines.slice(parsed.startLine - 1, parsed.endLine).join("\n"),
      truncated: false,
    };
  }

  const endLine = Math.min(lines.length, MAX_MENTION_DEFAULT_LINES);
  return {
    path: parsed.path,
    startLine: 1,
    endLine,
    content: lines.slice(0, endLine).join("\n"),
    truncated: lines.length > MAX_MENTION_DEFAULT_LINES,
  };
}

function resolveMentionCandidates(
  query: string,
  cwd: string,
  maxSuggestions: number,
): string[] {
  const normalizedQuery = toUnixPath(query);
  const resolvedDirInput = normalizedQuery.endsWith("/")
    ? normalizedQuery.slice(0, -1)
    : dirname(normalizedQuery);
  const dirInput = normalizedQuery.includes("/")
    ? resolvedDirInput || "."
    : ".";
  const prefix = normalizedQuery.endsWith("/")
    ? ""
    : normalizedQuery.includes("/")
      ? normalizedQuery.slice(normalizedQuery.lastIndexOf("/") + 1)
      : normalizedQuery;

  const baseDir = resolve(cwd, dirInput);
  let entries: Dirent<string>[];
  try {
    entries = readdirSync(baseDir, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return [];
  }

  const suggestions = entries
    .filter((entry) => entry.name.startsWith(prefix))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) {
        return -1;
      }
      if (!a.isDirectory() && b.isDirectory()) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    })
    .map((entry) => {
      const relative =
        dirInput === "." ? entry.name : `${dirInput}/${entry.name}`;
      return entry.isDirectory() ? `${relative}/` : relative;
    });

  return suggestions.slice(0, maxSuggestions);
}

function resolveMentionPathState(
  buffer: string,
  cursorIndex: number,
  maxSuggestions: number = 5,
  cwd: string = process.cwd(),
): MentionPathState | null {
  const beforeCursor = buffer.slice(0, cursorIndex);
  const tokenStart =
    Math.max(beforeCursor.lastIndexOf(" "), beforeCursor.lastIndexOf("\n")) + 1;
  const tokenEndMatch = buffer.slice(cursorIndex).match(/[ \n]/);
  const tokenEnd =
    tokenEndMatch === null ? buffer.length : cursorIndex + tokenEndMatch.index!;
  const token = buffer.slice(tokenStart, tokenEnd);

  if (!token.startsWith("@")) {
    return null;
  }

  const replacementStart = tokenStart + 1;
  const rawQuery = token.slice(1);
  const rangeSeparatorIndex = rawQuery.indexOf(":");
  const replacementEnd =
    rangeSeparatorIndex === -1
      ? tokenEnd
      : replacementStart + rangeSeparatorIndex;
  if (cursorIndex < replacementStart || cursorIndex > replacementEnd) {
    return null;
  }

  const query = buffer.slice(replacementStart, cursorIndex);
  const suggestions = resolveMentionCandidates(query, cwd, maxSuggestions);
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

export function completeMentionPath(
  buffer: string,
  cursorIndex: number,
  cwd: string = process.cwd(),
): CompletionResult {
  const state = resolveMentionPathState(buffer, cursorIndex, 5, cwd);
  if (!state) {
    return {
      buffer,
      cursorIndex,
      completed: false,
    };
  }

  const replacement =
    state.suggestions.length === 1
      ? (state.suggestions[0] ?? state.query)
      : getSharedPrefix(state.suggestions);
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

export function buildMentionPathHintLines(suggestions: string[]): string[] {
  return suggestions.map((suggestion) => `  @${suggestion}`);
}

export function resolveMentionPathHints(
  buffer: string,
  cursorIndex: number,
  maxSuggestions: number = 5,
  cwd: string = process.cwd(),
): string[] {
  const state = resolveMentionPathState(
    buffer,
    cursorIndex,
    maxSuggestions,
    cwd,
  );
  if (!state) {
    return [];
  }

  return state.suggestions;
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

export function extractMentionedFilePaths(
  input: string,
  cwd: string = process.cwd(),
): string[] {
  const matches = input.matchAll(/(?:^|[\s\n])@([^\s\n]+)/g);
  const unique = new Set<string>();

  for (const match of matches) {
    const rawToken = match[1];
    if (!rawToken) {
      continue;
    }

    const parsed = parseMentionToken(rawToken);
    if (!parsed) {
      continue;
    }

    const filePath = parsed.path;
    try {
      const absolutePath = resolve(cwd, filePath);
      const stat = statSync(absolutePath);
      if (stat.isFile()) {
        unique.add(filePath);
      }
    } catch {
      // 存在しないパスは入力候補として無視する
    }
  }

  return Array.from(unique);
}

export function extractMentionedFiles(
  input: string,
  cwd: string = process.cwd(),
): InputMention[] {
  const matches = input.matchAll(/(?:^|[\s\n])@([^\s\n]+)/g);
  const mentions: InputMention[] = [];

  for (const match of matches) {
    const rawToken = match[1];
    if (!rawToken) {
      continue;
    }

    const parsed = parseMentionToken(rawToken);
    if (!parsed) {
      continue;
    }

    const mention = resolveMentionContent(parsed, cwd);
    if (mention !== null) {
      mentions.push(mention);
    }
  }

  return mentions;
}
