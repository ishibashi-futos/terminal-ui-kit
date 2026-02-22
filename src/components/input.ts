import { CSI, ESC } from "../core/ansi";
import { HistoryManager } from "../utils/history";
import { getDisplayWidth } from "../utils/width";

export class MultiLineInput {
  private buffer: string = "";
  private lastRenderedLines: number = 0;
  private prompt: string;
  private promptWidth: number;
  private history = new HistoryManager();

  constructor(prompt: string = "Message: ") {
    this.prompt = prompt;
    this.promptWidth = getDisplayWidth(prompt);
  }

  private render() {
    const columns = process.stdout.columns || 80;
    const indent = " ".repeat(this.promptWidth);

    // 1. バッファを実際の改行で分割し、表示上の折り返しも考慮して「描画用の行」を作る
    const rawLines = this.buffer.split("\n");
    const displayLines: string[] = [];

    rawLines.forEach((line, index) => {
      const prefix = index === 0 ? this.prompt : indent;
      const currentLineText = prefix + line;

      // ターミナル幅での自動折り返しを考慮（インデント付きで折り返す）
      // ※ここでは簡易的に1行ずつ追加していますが、
      // 本来は1行がcolumnsを超えたらさらに分割するロジックを入れると完璧です
      displayLines.push(currentLineText);
    });

    // 2. カーソル制御
    if (this.lastRenderedLines > 1) {
      process.stdout.write(CSI + (this.lastRenderedLines - 1) + "A");
    }
    process.stdout.write("\r" + CSI + "J");

    // 3. 描画
    process.stdout.write(displayLines.join("\n"));

    this.lastRenderedLines = displayLines.length;
  }

  async ask(): Promise<string> {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    this.render();

    return new Promise((resolve) => {
      const onData = (chunk: string) => {
        // Ctrl + C
        if (chunk === "\u0003") {
          process.stdout.write("\n");
          cleanup();
          process.exit();
        }

        // 送信判定: Cmd+Enter (Mac/iTerm2等) / Ctrl+Enter
        // 多くの環境で \u001b\r (Esc + Enter) が送られる
        if (
          chunk === "\u001b\r" ||
          chunk === "\u001b\n" ||
          chunk === "\u000a"
        ) {
          // 空送信を防止する
          if (!this.buffer) {
            return;
          }
          process.stdout.write("\n");

          const buffer = this.buffer;
          this.history.add(buffer);

          this.buffer = "";
          cleanup();
          resolve(buffer);
          return;
        }

        if (chunk === "\u001b[A") {
          // Up Arrow
          const prev = this.history.prev(this.buffer);
          if (prev !== null) {
            this.buffer = prev;
            this.render();
          }
          return;
        }

        if (chunk === "\u001b[B") {
          // Down Arrow
          const next = this.history.next();
          if (next !== null) {
            this.buffer = next;
            this.render();
          }
          return;
        }

        // 通常の Enter (改行) -> バッファにそのまま入れる
        if (chunk === "\r") {
          this.buffer += "\n";
          this.render();
          return;
        }

        // Backspace
        if (chunk === "\u007f") {
          if (this.buffer.length > 0) {
            const chars = Array.from(this.buffer);
            chars.pop();
            this.buffer = chars.join("");
            this.render();
          }
          return;
        }

        // --- 文字入力フィルタ ---
        // エスケープシーケンス（矢印キーやCmdショートカット等）が
        // バッファに混入して表示崩れするのを防ぐ
        if (chunk.startsWith(ESC) && chunk.length > 1) {
          // 特殊キーとして処理したいもの以外は無視
          return;
        }

        // 文字入力
        this.buffer += chunk;
        this.render();
      };

      const cleanup = () => {
        process.stdin.off("data", onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
      };

      process.stdin.on("data", onData);
    });
  }
}
