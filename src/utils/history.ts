export class HistoryManager {
  private history: string[] = [];
  private index: number = -1;
  private tempBuffer = "";

  constructor() {}

  add(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    // 直近と同じ内容は保存しない（重複回避）
    if (this.history[0] !== trimmed) {
      this.history.unshift(trimmed);
    }
    // インデックスをリセット
    this.index = -1;
  }

  prev(currentBuffer: string): string | null {
    if (this.history.length === 0) return null;
    if (this.index === -1) {
      this.tempBuffer = currentBuffer;
    }

    if (this.index < this.history.length - 1) {
      this.index++;
      return this.history[this.index]!;
    }
    return null;
  }

  next(): string | null {
    if (this.index > 0) {
      this.index--;
      return this.history[this.index]!;
    } else if (this.index === 0) {
      this.index = -1;
      return this.tempBuffer;
    }
    return null;
  }
}
