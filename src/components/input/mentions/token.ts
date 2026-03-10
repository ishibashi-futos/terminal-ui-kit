import { MAX_MENTION_DEFAULT_LINES } from "./constants";

export interface ParsedMentionToken {
  path: string;
  startLine: number;
  endLine: number;
  hasExplicitRange: boolean;
  hasInvalidRange: boolean;
}

export interface MentionTokenRange {
  replacementStart: number;
  replacementEnd: number;
  query: string;
}

export interface MentionPathQuery {
  dirInput: string;
  prefix: string;
}

function toUnixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function parseMentionToken(rawToken: string): ParsedMentionToken | null {
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

export function collectParsedMentionTokens(
  input: string,
): ParsedMentionToken[] {
  const matches = input.matchAll(/(?:^|[\s\n])@([^\s\n]+)/g);
  const tokens: ParsedMentionToken[] = [];

  for (const match of matches) {
    const rawToken = match[1];
    if (!rawToken) {
      continue;
    }

    const parsed = parseMentionToken(rawToken);
    if (parsed) {
      tokens.push(parsed);
    }
  }

  return tokens;
}

export function resolveMentionTokenRange(
  buffer: string,
  cursorIndex: number,
): MentionTokenRange | null {
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

  return {
    replacementStart,
    replacementEnd,
    query: buffer.slice(replacementStart, cursorIndex),
  };
}

export function parseMentionPathQuery(query: string): MentionPathQuery {
  const normalizedQuery = toUnixPath(query);
  const lastSeparatorIndex = normalizedQuery.lastIndexOf("/");
  const dirInput =
    lastSeparatorIndex === -1
      ? "."
      : normalizedQuery.endsWith("/")
        ? normalizedQuery.slice(0, -1) || "."
        : normalizedQuery.slice(0, lastSeparatorIndex) || ".";
  const prefix = normalizedQuery.endsWith("/")
    ? ""
    : lastSeparatorIndex === -1
      ? normalizedQuery
      : normalizedQuery.slice(lastSeparatorIndex + 1);

  return {
    dirInput,
    prefix,
  };
}
