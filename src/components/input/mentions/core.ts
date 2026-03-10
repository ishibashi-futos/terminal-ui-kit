import { getSharedPrefix } from "../completion";
import { type InputMention, type InputMentionError } from "../types";
import {
  MAX_MENTION_DEFAULT_LINES,
  MAX_MENTION_FILE_SIZE_BYTES,
} from "./constants";
import { type ParsedMentionToken } from "./token";

export interface MentionDirectoryEntry {
  name: string;
  isDirectory: boolean;
}

interface MentionFileSource {
  size: number;
  buffer: Buffer;
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

export function buildMentionPathSuggestions(
  dirInput: string,
  prefix: string,
  entries: MentionDirectoryEntry[],
  maxSuggestions: number,
): string[] {
  const suggestions = entries
    .filter((entry) => entry.name.startsWith(prefix))
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) {
        return -1;
      }
      if (!a.isDirectory && b.isDirectory) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    })
    .map((entry) => {
      const relative =
        dirInput === "." ? entry.name : `${dirInput}/${entry.name}`;
      return entry.isDirectory ? `${relative}/` : relative;
    });

  return suggestions.slice(0, maxSuggestions);
}

export function resolveMentionReplacement(
  query: string,
  suggestions: string[],
): string | null {
  if (suggestions.length === 0) {
    return null;
  }

  const replacement =
    suggestions.length === 1
      ? (suggestions[0] ?? query)
      : getSharedPrefix(suggestions);

  if (replacement.length <= query.length) {
    return null;
  }

  return replacement;
}

export function resolveMentionContent(
  parsed: ParsedMentionToken,
  file: MentionFileSource,
): InputMention {
  if (parsed.hasInvalidRange) {
    return buildMentionError(parsed, "invalid_range");
  }

  if (file.size > MAX_MENTION_FILE_SIZE_BYTES) {
    return buildMentionError(parsed, "too_large");
  }

  if (file.buffer.includes(0)) {
    return buildMentionError(parsed, "binary_file");
  }

  const lines = file.buffer.toString("utf8").split(/\r?\n/);
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
