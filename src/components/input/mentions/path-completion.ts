import { type CompletionResult } from "../completion";
import { buildMentionPathSuggestions, resolveMentionReplacement } from "./core";
import { listMentionDirectoryEntries } from "./fs";
import { parseMentionPathQuery, resolveMentionTokenRange } from "./token";

interface MentionPathState {
  suggestions: string[];
  replacementStart: number;
  replacementEnd: number;
  query: string;
}

function resolveMentionPathState(
  buffer: string,
  cursorIndex: number,
  maxSuggestions: number,
  cwd: string,
): MentionPathState | null {
  const tokenRange = resolveMentionTokenRange(buffer, cursorIndex);
  if (!tokenRange) {
    return null;
  }

  const { dirInput, prefix } = parseMentionPathQuery(tokenRange.query);
  const entries = listMentionDirectoryEntries(cwd, dirInput);
  if (!entries) {
    return null;
  }

  const suggestions = buildMentionPathSuggestions(
    dirInput,
    prefix,
    entries,
    maxSuggestions,
  );
  if (suggestions.length === 0) {
    return null;
  }

  return {
    suggestions,
    replacementStart: tokenRange.replacementStart,
    replacementEnd: tokenRange.replacementEnd,
    query: tokenRange.query,
  };
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

  const replacement = resolveMentionReplacement(state.query, state.suggestions);
  if (!replacement) {
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
