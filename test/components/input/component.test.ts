import { describe, expect, test } from "bun:test";
import {
  buildInputLines,
  normalizeInputChunk,
  resolveVerticalCursorMove,
} from "../../../src/components/input/helpers";
import { getDisplayWidth } from "../../../src/utils/width";
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

  test("terminal width を考慮して日本語入力時のカーソル視覚位置を計算できる", () => {
    const prompt = "P> ";
    const buffer = "あいうえ";
    const layout = buildInputLines(
      buffer,
      buffer.length,
      prompt,
      getDisplayWidth(prompt),
      10,
    );

    expect(layout.cursorRow).toBe(1);
    expect(layout.cursorCol).toBe(1);
    expect(layout.totalRows).toBe(2);
  });

  test("terminal width を考慮して複数行入力の総表示行数を計算できる", () => {
    const prompt = "入力> ";
    const buffer = "あいうえおかき\nさし";
    const layout = buildInputLines(
      buffer,
      buffer.length,
      prompt,
      getDisplayWidth(prompt),
      12,
    );

    expect(layout.cursorRow).toBe(2);
    expect(layout.cursorCol).toBe(10);
    expect(layout.totalRows).toBe(3);
  });

  test("貼り付けチャンクの制御シーケンスと改行コードを正規化できる", () => {
    const pasted = "\u001b[200~line1\r\nline2\rline3\u001b[201~";
    expect(normalizeInputChunk(pasted)).toBe("line1\nline2\nline3");
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
