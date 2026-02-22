// core/renderer.ts
import { ANSI } from "./ansi";

export class Renderer {
  private lastLines = 0;

  update(lines: string[]) {
    // 1. 戻る
    if (this.lastLines > 1) {
      process.stdout.write(ANSI.CURSOR_UP(this.lastLines - 1));
    }
    // 2. 消す
    process.stdout.write(ANSI.CURSOR_LEFT + ANSI.ERASE_DOWN);
    // 3. 書く
    process.stdout.write(lines.join("\n"));

    this.lastLines = lines.length;
  }

  clear() {
    if (this.lastLines > 1) {
      process.stdout.write(ANSI.CURSOR_UP(this.lastLines - 1));
    }
    process.stdout.write(ANSI.CURSOR_LEFT + ANSI.ERASE_DOWN);
    this.lastLines = 0;
  }
}
