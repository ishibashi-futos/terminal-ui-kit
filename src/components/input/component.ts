import { Terminal } from "../../core/terminal";
import { type HistoryManager } from "../../utils/history";
import { getDisplayWidth } from "../../utils/width";
import {
  buildMentionPathHintLines,
  buildSlashCommandHintLines,
  buildInputLines,
  completeMentionPath,
  completeSlashCommand,
  extractMentionedFilePaths,
  type InputCommand,
  normalizeInputChunk,
  resolveMentionPathHints,
  runSlashCommandCallback,
  resolveSlashCommandState,
  resolveVerticalCursorMove,
} from "./helpers";

export interface InputOptions {
  commands?: InputCommand[];
}

export interface InputResult {
  value: string;
  paths: string[];
}

export async function input(
  prompt: string,
  history: HistoryManager,
  options: InputOptions = {},
): Promise<InputResult> {
  const term = new Terminal();
  const promptWidth: number = getDisplayWidth(prompt);
  const commands = options.commands ?? [];
  let buffer: string = "";
  let cursorIndex = 0;
  let preferredColumn: number | null = null;

  return new Promise((resolve, reject) => {
    const render = () => {
      const layout = buildInputLines(
        buffer,
        cursorIndex,
        prompt,
        promptWidth,
        term.getWidth(),
      );
      const commandState = resolveSlashCommandState(
        buffer,
        cursorIndex,
        commands,
      );
      const mentionSuggestions = resolveMentionPathHints(buffer, cursorIndex);
      const hintLines =
        mentionSuggestions.length > 0
          ? buildMentionPathHintLines(mentionSuggestions)
          : commandState
            ? buildSlashCommandHintLines(commandState.suggestions)
            : [];
      const lines = [...layout.lines, ...hintLines];
      const totalRows = layout.totalRows + hintLines.length;
      term.update(lines, totalRows);
      term.setCursorPosition(layout.cursorRow, layout.cursorCol, totalRows);
    };

    const resetVerticalPreference = () => {
      preferredColumn = null;
    };

    const moveCursorVertical = (direction: -1 | 1): boolean => {
      const moved = resolveVerticalCursorMove(
        buffer,
        cursorIndex,
        preferredColumn,
        direction,
      );
      if (moved === null) {
        return false;
      }

      cursorIndex = moved.cursorIndex;
      preferredColumn = moved.preferredColumn;
      return true;
    };

    const applyHistoryBuffer = (nextBuffer: string) => {
      buffer = nextBuffer;
      cursorIndex = buffer.length;
      resetVerticalPreference();
      render();
    };

    const applyBufferEdit = (nextBuffer: string, nextCursorIndex: number) => {
      buffer = nextBuffer;
      cursorIndex = nextCursorIndex;
      history.reset(buffer);
      resetVerticalPreference();
      render();
    };

    const cleanup = term.bindActions(
      {
        SUBMIT: async () => {
          if (!buffer) {
            return;
          }

          const result = buffer;
          const paths = extractMentionedFilePaths(result);
          history.add(result);
          buffer = "";
          term.finalize();
          cleanup();
          try {
            await runSlashCommandCallback(result, commands);
          } catch (error) {
            reject(error);
            return;
          }
          resolve({ value: result, paths });
          return;
        },
        UP: () => {
          if (moveCursorVertical(-1)) {
            render();
            return;
          }

          const prev = history.prev(buffer);
          if (prev !== null) {
            applyHistoryBuffer(prev);
          }
          return;
        },
        DOWN: () => {
          if (moveCursorVertical(1)) {
            render();
            return;
          }

          const next = history.next();
          if (next !== null) {
            applyHistoryBuffer(next);
          }
          return;
        },
        LEFT: () => {
          if (cursorIndex > 0) {
            cursorIndex--;
            resetVerticalPreference();
            render();
          }
        },
        RIGHT: () => {
          if (cursorIndex < buffer.length) {
            cursorIndex++;
            resetVerticalPreference();
            render();
          }
        },
        BACKSPACE: () => {
          if (cursorIndex > 0) {
            const chars = Array.from(buffer);
            chars.splice(cursorIndex - 1, 1); // カーソルの前の文字を消す
            applyBufferEdit(chars.join(""), cursorIndex - 1);
          }
        },
        ENTER: () => {
          const chars = Array.from(buffer);
          chars.splice(cursorIndex, 0, "\n");
          applyBufferEdit(chars.join(""), cursorIndex + 1);
        },
        TAB: () => {
          const mentionResult = completeMentionPath(buffer, cursorIndex);
          if (mentionResult.completed) {
            applyBufferEdit(mentionResult.buffer, mentionResult.cursorIndex);
            return;
          }

          const slashResult = completeSlashCommand(
            buffer,
            cursorIndex,
            commands,
          );
          if (!slashResult.completed) {
            return;
          }

          applyBufferEdit(slashResult.buffer, slashResult.cursorIndex);
        },
      },
      (char) => {
        const normalized = normalizeInputChunk(char);
        if (!normalized) {
          return;
        }

        const chars = Array.from(buffer);
        chars.splice(cursorIndex, 0, normalized);
        applyBufferEdit(
          chars.join(""),
          cursorIndex + Array.from(normalized).length,
        );
        return;
      },
    );

    render();
  });
}
