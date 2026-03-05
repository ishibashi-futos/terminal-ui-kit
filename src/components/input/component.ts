import { Terminal } from "../../core/terminal";
import { type HistoryManager } from "../../utils/history";
import { getDisplayWidth } from "../../utils/width";
import {
  buildSlashCommandHintLines,
  buildInputLines,
  completeSlashCommand,
  type InputCommand,
  normalizeInputChunk,
  runSlashCommandCallback,
  resolveSlashCommandState,
  resolveVerticalCursorMove,
} from "./helpers";

export interface InputOptions {
  commands?: InputCommand[];
}

export async function input(
  prompt: string,
  history: HistoryManager,
  options: InputOptions = {},
): Promise<string> {
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
      const hintLines = commandState
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
          resolve(result);
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
          const result = completeSlashCommand(buffer, cursorIndex, commands);
          if (!result.completed) {
            return;
          }

          applyBufferEdit(result.buffer, result.cursorIndex);
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
