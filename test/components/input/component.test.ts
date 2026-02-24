import { describe, expect, test } from "bun:test";
import { resolveVerticalCursorMove } from "../../../src/components/input/helpers";
import { HistoryManager } from "../../../src/utils/history";

describe("input helpers", () => {
  test("複数行入力では上下キーで履歴ではなく入力内を移動できる", () => {
    const buffer = "abcde\nxy\n12345";

    const movedDown = resolveVerticalCursorMove(buffer, 4, null, 1);
    expect(movedDown).not.toBeNull();
    expect(movedDown?.cursorIndex).toBe(8);
    expect(movedDown?.preferredColumn).toBe(4);

    const movedDownAgain = resolveVerticalCursorMove(
      buffer,
      movedDown!.cursorIndex,
      movedDown!.preferredColumn,
      1,
    );
    expect(movedDownAgain).not.toBeNull();
    expect(movedDownAgain?.cursorIndex).toBe(13);
  });

  test("先頭行で上キーを押したときだけ履歴呼び出しにフォールバックできる", () => {
    const moved = resolveVerticalCursorMove("abc\ndef", 1, null, -1);
    expect(moved).toBeNull();
  });
});

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
