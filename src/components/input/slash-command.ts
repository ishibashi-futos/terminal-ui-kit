import { getSharedPrefix, type CompletionResult } from "./completion";
import { type InputCommand } from "./types";

export interface SlashCommandState {
  suggestions: InputCommand[];
  replacementStart: number;
  replacementEnd: number;
  query: string;
}

interface ResolvedSubmittedCommand {
  command: InputCommand;
  args: string[];
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

  const callback =
    typeof resolved.command.bind !== "undefined"
      ? resolved.command.callback.bind(resolved.command.bind)
      : resolved.command.callback;

  await callback(resolved.args, input);
  return true;
}
