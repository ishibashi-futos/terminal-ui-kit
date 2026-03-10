import { describe, expect, test } from "bun:test";
import { HistoryManager } from "../../../src/utils/history";

describe("HistoryManager", () => {
  test("編集中に履歴ナビゲーション状態をリセットして現在の入力を保持できる", () => {
    const history = new HistoryManager();
    history.add("first");
    history.add("second");

    expect(history.prev("draft")).toBe("second");

    history.reset("draft+edit");

    expect(history.prev("draft+edit")).toBe("second");
    expect(history.next()).toBe("draft+edit");
  });
});
