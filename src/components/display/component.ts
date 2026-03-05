import { ANSI } from "../../core/ansi";
import { getDisplayWidth } from "../../utils/width";

interface OutputWriter {
  write: (chunk: string) => void;
  columns?: number;
}

interface PrintDependencies {
  stdout?: OutputWriter;
  stderr?: OutputWriter;
}

const PREFIX_WIDTH = 6;

function resolveLineWidth(writer: OutputWriter): number | null {
  if (typeof writer.columns === "number" && writer.columns > 0) {
    return writer.columns;
  }
  return null;
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

function formatPrefix(label: string, color: string): string {
  return `${ANSI.COLOR.BG_BLACK}${color} ${label.padEnd(PREFIX_WIDTH, " ")}${ANSI.COLOR.FG_DEFAULT}`;
}

function renderLine(
  writer: OutputWriter,
  label: string,
  color: string,
  content: string,
) {
  const prefix = formatPrefix(label, color);
  const plainPrefix = ` ${label.padEnd(PREFIX_WIDTH, " ")}`;
  const lineContent = ` ${content}`;
  const plainLine = `${plainPrefix}${lineContent}`;
  writer.write(
    `${prefix}${padToFullLine(lineContent, plainLine, resolveLineWidth(writer))}${ANSI.COLOR.RESET}\n`,
  );
}

function formatToolArgs(args: unknown): string {
  if (args === undefined) {
    return "";
  }

  if (typeof args === "string") {
    return args;
  }

  try {
    return JSON.stringify(args);
  } catch {
    return "[unserializable-args]";
  }
}

export function printStatus(
  message: string,
  dependencies: PrintDependencies = {},
) {
  const stdout = dependencies.stdout ?? process.stdout;
  renderLine(stdout, "status", ANSI.COLOR.CYAN, message);
}

export function printToolCall(
  name: string,
  args?: unknown,
  dependencies: PrintDependencies = {},
) {
  const stdout = dependencies.stdout ?? process.stdout;
  const formattedArgs = formatToolArgs(args);
  const suffix = formattedArgs.length > 0 ? ` ${formattedArgs}` : "";
  renderLine(stdout, "tool", ANSI.COLOR.YELLOW, `${name}${suffix}`);
}

export function printError(
  message: string,
  dependencies: PrintDependencies = {},
) {
  const stderr = dependencies.stderr ?? process.stderr;
  renderLine(stderr, "error", ANSI.COLOR.RED, message);
}
