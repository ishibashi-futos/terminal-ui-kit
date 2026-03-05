export type HistorySnapshotEntry = {
  seq: number;
  text: string;
};

export type HistorySnapshot = {
  version: 1;
  entries: HistorySnapshotEntry[];
};

export type HistoryManagerOptions = {
  maxEntries?: number;
};

export class HistoryManager {
  private history: HistorySnapshotEntry[] = [];
  private head = 0;
  private index: number = -1;
  private tempBuffer = "";
  private nextSeq = 1;
  private readonly maxEntries: number;

  constructor(options: HistoryManagerOptions = {}) {
    const { maxEntries = Number.POSITIVE_INFINITY } = options;

    if (
      !Number.isInteger(maxEntries) &&
      maxEntries !== Number.POSITIVE_INFINITY
    ) {
      throw new Error("maxEntries must be an integer or Infinity");
    }
    if (maxEntries < 0) {
      throw new Error("maxEntries must be greater than or equal to 0");
    }

    this.maxEntries = maxEntries;
  }

  add(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    // 直近と同じ内容は保存しない（重複回避）
    if (this.getLatestEntry()?.text !== trimmed) {
      this.history.push({
        seq: this.nextSeq,
        text: trimmed,
      });
      this.nextSeq++;
      this.applyMaxEntries();
    }
    // インデックスをリセット
    this.index = -1;
  }

  addAll(texts: readonly string[]): void {
    for (let i = texts.length - 1; i >= 0; i--) {
      this.add(texts[i]!);
    }
  }

  exportHistory(): string[] {
    const result: string[] = [];
    for (let i = this.history.length - 1; i >= this.head; i--) {
      result.push(this.history[i]!.text);
    }
    return result;
  }

  serialize(): HistorySnapshot {
    const entries: HistorySnapshotEntry[] = [];
    for (let i = this.history.length - 1; i >= this.head; i--) {
      entries.push({ ...this.history[i]! });
    }

    return {
      version: 1,
      entries,
    };
  }

  deserialize(snapshot: HistorySnapshot): void {
    if (snapshot.version !== 1) {
      throw new Error("Unsupported history snapshot version");
    }
    const sorted = [...snapshot.entries].sort((a, b) => a.seq - b.seq);
    this.history = sorted.map((entry) => ({
      seq: entry.seq,
      text: entry.text.trim(),
    }));
    this.history = this.history.filter((entry) => entry.text.length > 0);
    this.head = 0;
    this.applyMaxEntries();
    this.nextSeq =
      this.getActiveEntries().reduce(
        (maxSeq, entry) => Math.max(maxSeq, entry.seq),
        0,
      ) + 1;
    this.index = -1;
    this.tempBuffer = "";
  }

  prev(currentBuffer: string): string | null {
    if (this.getActiveLength() === 0) return null;
    if (this.index === -1) {
      this.tempBuffer = currentBuffer;
    }

    if (this.index < this.getActiveLength() - 1) {
      this.index++;
      return this.getEntryByNewestIndex(this.index)!.text;
    }
    return null;
  }

  next(): string | null {
    if (this.index > 0) {
      this.index--;
      return this.getEntryByNewestIndex(this.index)!.text;
    } else if (this.index === 0) {
      this.index = -1;
      return this.tempBuffer;
    }
    return null;
  }

  reset(currentBuffer: string): void {
    this.index = -1;
    this.tempBuffer = currentBuffer;
  }

  private applyMaxEntries(): void {
    if (this.maxEntries === Number.POSITIVE_INFINITY) return;

    const over = this.getActiveLength() - this.maxEntries;
    if (over <= 0) return;

    this.head += over;
    if (this.index >= this.getActiveLength()) {
      this.index = this.getActiveLength() - 1;
    }

    // 先頭側の無効領域が大きくなったときにだけ圧縮し、push主体の運用を維持する
    if (this.head > 1024 && this.head * 2 > this.history.length) {
      this.history = this.history.slice(this.head);
      this.head = 0;
    }
  }

  private getActiveLength(): number {
    return this.history.length - this.head;
  }

  private getLatestEntry(): HistorySnapshotEntry | null {
    if (this.getActiveLength() === 0) return null;
    return this.history[this.history.length - 1] ?? null;
  }

  private getEntryByNewestIndex(
    newestIndex: number,
  ): HistorySnapshotEntry | null {
    const target = this.history.length - 1 - newestIndex;
    if (target < this.head || target >= this.history.length) return null;
    return this.history[target] ?? null;
  }

  private getActiveEntries(): HistorySnapshotEntry[] {
    return this.history.slice(this.head);
  }
}
