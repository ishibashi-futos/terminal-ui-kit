import { ANSI } from "../../core/ansi";
import { Terminal } from "../../core/terminal";

interface Choice<T = string> {
  label: string;
  value: T;
}

export async function select<T>(
  prompt: string,
  choices: Choice<T>[],
): Promise<T> {
  const term = new Terminal();
  let selectedIndex = 0;

  return new Promise((resolve) => {
    const render = () => {
      const lines = buildSelectLines(prompt, choices, selectedIndex);
      term.update(lines);
    };

    const cleanup = term.bindActions({
      UP: () => {
        selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
        render();
      },
      DOWN: () => {
        selectedIndex = (selectedIndex + 1) % choices.length;
        render();
      },
      ENTER: () => {
        cleanup();
        term.finalize();
        resolve(choices[selectedIndex]!.value);
      },
      CTRL_C: () => term.exit(),
    });

    render();
  });
}

/**
 * 選択UIの表示用テキスト配列を生成する
 */
function buildSelectLines<T>(
  prompt: string,
  choices: Choice<T>[],
  selectedIndex: number,
): string[] {
  const lines = [prompt];

  choices.forEach((choice, i) => {
    const isSelected = i === selectedIndex;

    // 以前の絵文字ズレ対策を含めた実装
    const marker = isSelected ? `${ANSI.COLOR.CYAN}  > ` : "    ";
    const suffix = isSelected ? ANSI.COLOR.RESET : "";

    lines.push(`${marker}${choice.label}${suffix}`);
  });

  return lines;
}
