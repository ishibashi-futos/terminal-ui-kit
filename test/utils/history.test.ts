import { describe, expect, test } from "bun:test";
import { HistoryManager } from "../../src/utils/history";

describe("HistoryManager", () => {
  test("exportHistory で履歴のスナップショットを取得できる", () => {
    const history = new HistoryManager();
    history.add("first");
    history.add("second");

    expect(history.exportHistory()).toEqual(["second", "first"]);
  });

  test("exportHistory の返却値を変更しても内部状態に影響しない", () => {
    const history = new HistoryManager();
    history.add("first");
    const snapshot = history.exportHistory();

    snapshot.push("mutated");

    expect(history.exportHistory()).toEqual(["first"]);
  });

  test("addAll で exportHistory の結果をそのまま復元できる", () => {
    const source = new HistoryManager();
    source.add("first");
    source.add("second");
    source.add("third");
    const snapshot = source.exportHistory();

    const restored = new HistoryManager();
    restored.addAll(snapshot);

    expect(restored.exportHistory()).toEqual(snapshot);
  });

  test("addAll は空白を除外して重複ルールを維持する", () => {
    const history = new HistoryManager();

    history.addAll(["  first  ", "", "first", "second"]);

    expect(history.exportHistory()).toEqual(["first", "second"]);
  });

  test("serialize した内容は deserialize で復元できる", () => {
    const source = new HistoryManager();
    source.add("first");
    source.add("second");
    source.add("third");
    const snapshot = source.serialize();

    const restored = new HistoryManager();
    restored.deserialize(snapshot);

    expect(restored.exportHistory()).toEqual(["third", "second", "first"]);
  });

  test("deserialize は entries の順番が崩れていても seq で復元できる", () => {
    const history = new HistoryManager();
    history.deserialize({
      version: 1,
      entries: [
        { seq: 1, text: "first" },
        { seq: 3, text: "third" },
        { seq: 2, text: "second" },
      ],
    });

    expect(history.exportHistory()).toEqual(["third", "second", "first"]);
  });

  test("deserialize 後の追加でも seq の連番が維持される", () => {
    const history = new HistoryManager();
    history.deserialize({
      version: 1,
      entries: [
        { seq: 10, text: "first" },
        { seq: 12, text: "third" },
        { seq: 11, text: "second" },
      ],
    });

    history.add("fourth");
    const snapshot = history.serialize();

    expect(snapshot.entries[0]).toEqual({ seq: 13, text: "fourth" });
    expect(history.exportHistory()).toEqual([
      "fourth",
      "third",
      "second",
      "first",
    ]);
  });

  test("maxEntries 未指定時は無制限で履歴を保持する", () => {
    const history = new HistoryManager();

    for (let i = 0; i < 100; i++) {
      history.add(`entry-${i}`);
    }

    expect(history.exportHistory()).toHaveLength(100);
  });

  test("maxEntries 指定時は add で上限を超えない", () => {
    const history = new HistoryManager({ maxEntries: 3 });
    history.add("first");
    history.add("second");
    history.add("third");
    history.add("fourth");

    expect(history.exportHistory()).toEqual(["fourth", "third", "second"]);
  });

  test("maxEntries 指定時は deserialize でも上限を超えない", () => {
    const history = new HistoryManager({ maxEntries: 2 });
    history.deserialize({
      version: 1,
      entries: [
        { seq: 1, text: "first" },
        { seq: 4, text: "fourth" },
        { seq: 3, text: "third" },
        { seq: 2, text: "second" },
      ],
    });

    expect(history.exportHistory()).toEqual(["fourth", "third"]);
  });

  test("maxEntries が 0 の場合は履歴を保持しない", () => {
    const history = new HistoryManager({ maxEntries: 0 });
    history.add("first");
    history.add("second");

    expect(history.exportHistory()).toEqual([]);
  });

  test("maxEntries が不正な値の場合はエラーになる", () => {
    expect(() => new HistoryManager({ maxEntries: -1 })).toThrow(
      "maxEntries must be greater than or equal to 0",
    );
    expect(() => new HistoryManager({ maxEntries: 1.5 })).toThrow(
      "maxEntries must be an integer or Infinity",
    );
  });
});
