import { describe, expect, test } from "bun:test";
import {
  resolveLineJumpCursorIndex,
  resolveVerticalCursorMove,
} from "../../../src/components/input/cursor";

describe("input cursor helpers", () => {
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

  test("行頭ジャンプは現在行の先頭へ移動できる", () => {
    const buffer = "abcde\nxyz";
    expect(resolveLineJumpCursorIndex(buffer, 8, "start")).toBe(6);
    expect(resolveLineJumpCursorIndex(buffer, 2, "start")).toBe(0);
  });

  test("行末ジャンプは現在行の末尾へ移動できる", () => {
    const buffer = "abcde\nxyz";
    expect(resolveLineJumpCursorIndex(buffer, 1, "end")).toBe(5);
    expect(resolveLineJumpCursorIndex(buffer, 6, "end")).toBe(9);
  });

  test("先頭行で上キーを押したときだけ履歴呼び出しにフォールバックできる", () => {
    const moved = resolveVerticalCursorMove("abc\ndef", 1, null, -1);
    expect(moved).toBeNull();
  });
});
