import { ANSI } from "./ansi";
import { KEYS, type KeyName } from "./keys";
type KeyHandler = (chunk: string) => unknown;
type stdin = typeof process.stdin;
type stdout = typeof process.stdout;

export class Terminal {
  private handlers: Map<string, KeyHandler> = new Map();
  private onAnyCharHandler?: (chunk: string) => unknown;
  private lastLines = 0;
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

  update(lines: string[]) {
    if (this.lastLines > 1) {
      this.stdout.write(ANSI.CURSOR_UP(this.lastLines - 1));
    }

    this.stdout.write("\r" + ANSI.ERASE_DOWN);

    this.stdout.write(lines.join("\n"));

    this.lastLines = lines.length;
  }

  // 入力系：生の入力をイベントとして扱う
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

  // 終了系：直接 exit せず、クリーンアップの機会を与える
  exit() {
    this.stdout.write(ANSI.COLOR.RESET + "\n");
    process.exit();
  }

  finalize() {
    this.stdout.write("\n");
    this.lastLines = 0;
  }
}
