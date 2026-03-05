import { ANSI } from "../../core/ansi";
import { getDisplayWidth } from "../../utils/width";

export interface Choice<T = string> {
  label: string;
  value: T;
}

export interface SelectOptions {
  allowCustomInput?: boolean;
  customInputLabel?: string;
}

export interface RenderLayout {
  lines: string[];
  totalRows: number;
}

const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/g;

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, "");
}

function countWrappedRows(line: string, terminalWidth: number): number {
  const width = getDisplayWidth(stripAnsi(line));
  return Math.floor(width / terminalWidth) + 1;
}

interface SelectItemChoice<T> {
  type: "choice";
  choice: Choice<T>;
}

interface SelectItemCustom {
  type: "custom";
  label: string;
}

export type SelectItem<T> = SelectItemChoice<T> | SelectItemCustom;

export function buildSelectItems<T>(
  choices: Choice<T>[],
  options: SelectOptions,
): SelectItem<T>[] {
  const items: SelectItem<T>[] = choices.map((choice) => ({
    type: "choice",
    choice,
  }));

  if (options.allowCustomInput) {
    items.push({
      type: "custom",
      label: options.customInputLabel ?? "✍️ Custom input",
    });
  }

  return items;
}

/**
 * 選択UIの表示用テキスト配列を生成する
 */
export function buildSelectLines<T>(
  prompt: string,
  items: SelectItem<T>[],
  selectedIndex: number,
  terminalWidth: number,
  customInputValue: string = "",
): RenderLayout {
  const lines = [prompt];
  let totalRows = countWrappedRows(prompt, terminalWidth);

  items.forEach((item, i) => {
    const isSelected = i === selectedIndex;
    const marker = isSelected ? "  > " : "    ";
    const suffix = isSelected ? ANSI.COLOR.RESET : "";
    const label =
      item.type === "choice"
        ? item.choice.label
        : isSelected
          ? `${item.label}: ${customInputValue}`
          : item.label;
    const plainLine = `${marker}${label}`;

    lines.push(
      isSelected ? `${ANSI.COLOR.CYAN}${plainLine}${suffix}` : plainLine,
    );

    totalRows += countWrappedRows(plainLine, terminalWidth);
  });

  return {
    lines,
    totalRows,
  };
}

/**
 * 貼り付けチャンクの制御シーケンスと改行コードを正規化する
 */
export function normalizeSelectInputChunk(chunk: string): string {
  return chunk
    .replaceAll("\u001b[200~", "")
    .replaceAll("\u001b[201~", "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", " ");
}
