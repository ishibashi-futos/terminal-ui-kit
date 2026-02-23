import { Terminal } from "../../core/terminal";
import { type HistoryManager } from "../../utils/history";
import { getDisplayWidth } from "../../utils/width";

export async function input(
  prompt: string,
  history: HistoryManager,
): Promise<string> {
  const term = new Terminal();
  const promptWidth: number = getDisplayWidth(prompt);
  let buffer: string = "";

  return new Promise((resolve) => {
    const render = () => {
      const indent = " ".repeat(promptWidth);

      const rawLines = buffer.split("\n");
      const displayLines: string[] = [];

      rawLines.forEach((line, index) => {
        const prefix = index === 0 ? prompt : indent;
        const currentLineText = prefix + line;

        displayLines.push(currentLineText);
      });

      term.update(displayLines);
    };

    const onSubmit = (chunk: string) => {
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
    };

    const cleanup = term.bindActions(
      {
        SUBMIT: onSubmit,
        UP: () => {
          const prev = history.prev(buffer);
          if (prev !== null) {
            buffer = prev;
            render();
          }
          return;
        },
        DOWN: () => {
          const next = history.next();
          if (next !== null) {
            buffer = next;
            render();
          }
          return;
        },
        BACKSPACE: () => {
          if (buffer.length > 0) {
            const chars = Array.from(buffer);
            chars.pop();
            buffer = chars.join("");
            render();
          }
        },
        ENTER: () => {
          buffer += "\n";
          render();
        },
      },
      (char) => {
        buffer += char;
        render();
        return;
      },
    );

    render();
  });
}
