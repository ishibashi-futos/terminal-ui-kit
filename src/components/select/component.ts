import { Terminal } from "../../core/terminal";
import {
  buildSelectItems,
  buildSelectLines,
  normalizeSelectInputChunk,
  type Choice,
  type SelectOptions,
} from "./helpers";

export type { Choice, SelectOptions };

export function select<T>(prompt: string, choices: Choice<T>[]): Promise<T>;
export function select<T>(
  prompt: string,
  choices: Choice<T>[],
  options: SelectOptions & { allowCustomInput: true },
): Promise<T | string>;
export function select<T>(
  prompt: string,
  choices: Choice<T>[],
  options: SelectOptions = {},
): Promise<T | string> {
  const term = new Terminal();
  const items = buildSelectItems(choices, options);
  let selectedIndex = 0;
  let customInput = "";

  return new Promise((resolve) => {
    const isCustomSelected = () => items[selectedIndex]?.type === "custom";

    const render = () => {
      const terminalWidth = term.getWidth();
      const layout = buildSelectLines(
        prompt,
        items,
        selectedIndex,
        terminalWidth,
        customInput,
      );
      term.update(layout.lines, layout.totalRows);
    };

    const cleanup = term.bindActions(
      {
        UP: () => {
          selectedIndex = (selectedIndex - 1 + items.length) % items.length;
          render();
        },
        DOWN: () => {
          selectedIndex = (selectedIndex + 1) % items.length;
          render();
        },
        BACKSPACE: () => {
          if (!isCustomSelected() || customInput.length === 0) {
            return;
          }

          customInput = customInput.slice(0, -1);
          render();
        },
        ENTER: () => {
          const selectedItem = items[selectedIndex];
          if (!selectedItem) {
            return;
          }

          if (selectedItem.type === "custom") {
            cleanup();
            term.finalize();
            resolve(customInput.trim());
            return;
          }

          cleanup();
          term.finalize();
          resolve(selectedItem.choice.value);
        },
        CTRL_C: () => term.exit(),
      },
      (chunk) => {
        if (!isCustomSelected()) {
          return;
        }

        const normalized = normalizeSelectInputChunk(chunk);
        if (!normalized) {
          return;
        }

        customInput += normalized;
        render();
      },
    );

    render();
  });
}
