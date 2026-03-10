import { describe, expect, test } from "bun:test";
import { buildInputLines } from "../../../src/components/input/layout";
import { getDisplayWidth } from "../../../src/utils/width";

describe("input layout helpers", () => {
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
});
