import { Terminal } from "../../core/terminal";
import { type HistoryManager } from "../../utils/history";
import { getDisplayWidth } from "../../utils/width";
import { buildInputLines, resolveVerticalCursorMove } from "./helpers";

export async function input(
  prompt: string,
  history: HistoryManager,
): Promise<string> {
  const term = new Terminal();
  const promptWidth: number = getDisplayWidth(prompt);
  let buffer: string = "";
  let cursorIndex = 0;
  let preferredColumn: number | null = null;

  return new Promise((resolve) => {
    const render = () => {
      const { lines, cursorRow, cursorCol, totalRows } = buildInputLines(
        buffer,
        cursorIndex,
        prompt,
        promptWidth,
        term.getWidth(),
      );
      term.update(lines, totalRows);
      term.setCursorPosition(cursorRow, cursorCol, totalRows);
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
        SUBMIT: () => {
          if (!buffer) {
            return;
          }

          const result = buffer;
          history.add(result);
          buffer = "";
          term.finalize();
          cleanup();
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
      },
      (char) => {
        const chars = Array.from(buffer);
        chars.splice(cursorIndex, 0, char);
        applyBufferEdit(chars.join(""), cursorIndex + char.length);
        return;
      },
    );

    render();
  });
}
