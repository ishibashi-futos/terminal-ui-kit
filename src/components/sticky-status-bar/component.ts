import { ANSI } from "../../core/ansi";
import { getDisplayWidth } from "../../utils/width";

interface OutputWriter {
  columns?: number;
}

export interface StickyStatusBarOptions {
  label?: string;
  color?: string;
}

export interface StickyStatusBar {
  setText(text: string): void;
  renderLine(terminalWidth?: number): string | null;
  clear(): void;
}

const DEFAULT_LABEL = "status";
const PREFIX_WIDTH = 6;

function resolveLineWidth(
  terminalWidth: number | undefined,
  writer: OutputWriter,
): number | null {
  if (typeof terminalWidth === "number" && terminalWidth > 0) {
    return terminalWidth;
  }

  if (typeof writer.columns === "number" && writer.columns > 0) {
    return writer.columns;
  }

  return null;
}

function formatPrefix(label: string, color: string): string {
  return `${ANSI.COLOR.BG_BLACK}${color} ${label.padEnd(PREFIX_WIDTH, " ")}${ANSI.COLOR.FG_DEFAULT}`;
}

function padToFullLine(
  content: string,
  plainLine: string,
  width: number | null,
): string {
  if (width === null) {
    return content;
  }

  const displayWidth = getDisplayWidth(plainLine);
  const paddingWidth = Math.max(width - displayWidth, 0);
  return `${content}${" ".repeat(paddingWidth)}`;
}

class DefaultStickyStatusBar implements StickyStatusBar {
  private text = "";

  constructor(
    private readonly options: Required<StickyStatusBarOptions>,
    private readonly writer: OutputWriter,
  ) {}

  setText(text: string) {
    this.text = text;
  }

  renderLine(terminalWidth?: number): string | null {
    if (this.text.length === 0) {
      return null;
    }

    const lineContent = ` ${this.text}`;
    const plainPrefix = ` ${this.options.label.padEnd(PREFIX_WIDTH, " ")}`;
    const plainLine = `${plainPrefix}${lineContent}`;
    const width = resolveLineWidth(terminalWidth, this.writer);
    const prefix = formatPrefix(this.options.label, this.options.color);
    return `${prefix}${padToFullLine(lineContent, plainLine, width)}${ANSI.COLOR.RESET}`;
  }

  clear() {
    this.text = "";
  }
}

export function createStickyStatusBar(
  options: StickyStatusBarOptions = {},
): StickyStatusBar {
  return new DefaultStickyStatusBar(
    {
      label: options.label ?? DEFAULT_LABEL,
      color: options.color ?? ANSI.COLOR.CYAN,
    },
    process.stdout,
  );
}
