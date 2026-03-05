import { Terminal } from "../../core/terminal";
import {
  buildSelectItems,
  buildSelectLines,
  normalizeSelectInputChunk,
  type Choice,
  type SelectOptions,
  type SelectStickyStatusState,
} from "./helpers";

export type { Choice, SelectOptions, SelectStickyStatusState };

export function select<T>(prompt: string, choices: Choice<T>[]): Promise<T>;
export function select<T>(
  prompt: string,
  choices: Choice<T>[],
  options: SelectOptions,
): Promise<T | string>;
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

    const render = (withStickyBar = true) => {
      const terminalWidth = term.getWidth();
      const layout = buildSelectLines(
        prompt,
        items,
        selectedIndex,
        terminalWidth,
        customInput,
      );
      const lines = [...layout.lines];
      let stickyRows = 0;
      const stickyStatusBar = options.stickyStatusBar;
      if (withStickyBar && stickyStatusBar) {
        const selectedItem = items[selectedIndex];
        const selectedLabel =
          selectedItem?.type === "choice"
            ? selectedItem.choice.label
            : (selectedItem?.label ?? "");
        stickyStatusBar.bar.setText(
          stickyStatusBar.render({
            selectedIndex,
            selectedLabel,
            isCustomInputSelected: isCustomSelected(),
            customInput,
            terminalWidth,
          }),
        );
        const stickyLine = stickyStatusBar.bar.renderLine(terminalWidth);
        lines.push(stickyLine ?? "");
        stickyRows = 1;
      }
      term.update(lines, layout.totalRows + stickyRows);
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
            options.stickyStatusBar?.bar.clear();
            render(false);
            cleanup();
            term.finalize();
            resolve(customInput.trim());
            return;
          }

          options.stickyStatusBar?.bar.clear();
          render(false);
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
