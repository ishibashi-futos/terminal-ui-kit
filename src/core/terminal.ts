import { ANSI } from "./ansi";
import { KEYS, type KeyName } from "./keys";
type KeyHandler = (chunk: string) => unknown;
type stdin = typeof process.stdin;
type stdout = typeof process.stdout;
type Cleanup = () => void;

export class Terminal {
  private handlers: Map<string, KeyHandler> = new Map();
  private lastLines = 0;

  constructor(
    private stdin: stdin = process.stdin,
    private stdout: stdout = process.stdout,
  ) {}

  onAction(
    keyMap: Partial<Record<KeyName, KeyHandler>>,
    onAnyChar?: (chunk: string) => Promise<void>,
  ): Cleanup {
    const handler = (chunk: string) => {
      // 1. 登録された特殊キー（同時押し含む）を完全一致でチェック
      for (const [name, code] of Object.entries(KEYS)) {
        if (chunk === code && keyMap[name as KeyName]) {
          keyMap[name as KeyName]!(chunk);
          return;
        }
      }

      // 2. エスケープシーケンス (\u001b) で始まるが KEYS にないものは、未知の同時押しや特殊キー
      if (chunk.startsWith("\u001b")) {
        // 必要ならここでログを出して、未知のキーコードを特定できるようにする
        return;
      }

      // 3. それ以外は通常の文字入力
      if (onAnyChar) {
        onAnyChar(chunk);
      }
    };

    this.stdin.setRawMode(true);
    this.stdin.resume();
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", handler);

    return () => {
      // 戻り値でクリーンアップ関数を返す（便利！）
      this.stdin.off("data", handler);
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
