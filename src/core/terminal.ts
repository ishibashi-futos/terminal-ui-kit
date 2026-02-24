import { ANSI } from "./ansi";
import { KEYS, type KeyName } from "./keys";
type KeyHandler = (chunk: string) => unknown;
type stdin = typeof process.stdin;
type stdout = typeof process.stdout;

export class Terminal {
  private handlers: Map<string, KeyHandler> = new Map();
  private onAnyCharHandler?: (chunk: string) => unknown;
  private lastLines = 0;
  private currentCursorRow = 0;
  private handler = (chunk: string) => {
    if (chunk === KEYS.CTRL_C) {
      this.exit();
      return;
    }

    const handler = this.handlers.get(chunk);
    if (handler) {
      handler(chunk);
      return;
    }

    if (this.onAnyCharHandler && !chunk.startsWith("\u001b")) {
      this.onAnyCharHandler(chunk);
    }
  };

  constructor(
    private stdin: stdin = process.stdin,
    private stdout: stdout = process.stdout,
  ) {
    this.setupRawMode();
  }

  private setupRawMode() {
    this.stdin.setRawMode(true);
    this.stdin.resume();
    this.stdin.setEncoding("utf8");

    this.stdin.on("data", this.handler);
  }

  bindActions(
    keyMap: Partial<Record<KeyName, KeyHandler>>,
    onAnyChar?: (char: string) => void,
  ) {
    this.handlers.clear();
    this.onAnyCharHandler = onAnyChar;

    for (const [name, action] of Object.entries(keyMap)) {
      const code = KEYS[name as KeyName];
      if (code && action) {
        this.handlers.set(code, action);
      }
    }

    // cleanup
    return () => {
      this.handlers.clear();
      this.onAnyCharHandler = undefined;
      this.stdin.off("data", this.handler);
      this.stdin.setRawMode(false);
      this.stdin.pause();
    };
  }

  update(lines: string[], totalRows: number = lines.length) {
    if (this.lastLines > 0) {
      this.stdout.write("\r");

      if (this.currentCursorRow > 0) {
        this.stdout.write(ANSI.CURSOR_UP(this.currentCursorRow));
      }
    }

    this.stdout.write(ANSI.ERASE_DOWN);

    this.stdout.write(lines.join("\n"));

    this.lastLines = totalRows;
    this.currentCursorRow = Math.max(totalRows - 1, 0);
  }

  onKey(callback: (chunk: string) => void) {
    this.stdin.setRawMode(true);
    this.stdin.resume();
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", callback);
  }

  offKey(callback: (chunk: string) => void) {
    this.stdin.off("data", callback);
    this.stdin.setRawMode(false);
    this.stdin.pause();
  }

  moveCursor(dx: number, dy: number) {
    let sequence = "";
    if (dy < 0) sequence += `\u001b[${Math.abs(dy)}A`; // 上
    if (dy > 0) sequence += `\u001b[${dy}B`; // 下
    sequence += "\r"; // 行頭
    if (dx > 0) sequence += `\u001b[${dx}C`; // 右へ移動

    this.stdout.write(sequence);
  }

  setCursorPosition(targetRow: number, targetCol: number, totalLines: number) {
    // 現在は最終行の末尾にいるので、そこからの相対距離
    const dy = targetRow - (totalLines - 1);
    this.moveCursor(targetCol, dy);
    this.currentCursorRow = targetRow;
  }

  getWidth(): number {
    const columns = this.stdout.columns;
    if (typeof columns === "number" && columns > 0) {
      return columns;
    }

    return 80;
  }

  exit() {
    this.stdout.write(ANSI.COLOR.RESET + "\n");
    process.exit();
  }

  finalize() {
    this.stdout.write("\n");
    this.lastLines = 0;
    this.currentCursorRow = 0;
  }
}
