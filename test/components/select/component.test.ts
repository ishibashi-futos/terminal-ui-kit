import { describe, expect, test } from "bun:test";
import { ANSI } from "../../../src/core/ansi";
import {
  buildSelectItems,
  buildSelectLines,
  normalizeSelectInputChunk,
} from "../../../src/components/select/helpers";

describe("select helpers", () => {
  test("allowCustomInput 有効時に自由入力項目を末尾に追加できる", () => {
    const items = buildSelectItems(
      [
        { label: "A", value: "a" },
        { label: "B", value: "b" },
      ],
      { allowCustomInput: true, customInputLabel: "Custom value" },
    );

    expect(items).toHaveLength(3);
    expect(items[2]).toEqual({ type: "custom", label: "Custom value" });
  });

  test("選択中項目だけマーカーと色が付く", () => {
    const layout = buildSelectLines(
      "Choose an item",
      [
        { type: "choice", choice: { label: "A", value: "a" } },
        { type: "custom", label: "Custom value" },
      ],
      1,
      80,
      "",
    );

    expect(layout.lines).toEqual([
      "Choose an item",
      "    A",
      `${ANSI.COLOR.CYAN}  > Custom value: ${ANSI.COLOR.RESET}`,
    ]);
    expect(layout.totalRows).toBe(3);
  });

  test("自由入力選択中は選択肢行の後ろに入力値をインライン表示できる", () => {
    const layout = buildSelectLines(
      "Choose an item",
      [
        { type: "choice", choice: { label: "A", value: "a" } },
        { type: "custom", label: "Custom value" },
      ],
      1,
      80,
      "new-task",
    );

    expect(layout.lines).toEqual([
      "Choose an item",
      "    A",
      `${ANSI.COLOR.CYAN}  > Custom value: new-task${ANSI.COLOR.RESET}`,
    ]);
    expect(layout.totalRows).toBe(3);
  });

  test("自由入力チャンクの改行と貼り付け制御シーケンスを正規化できる", () => {
    expect(
      normalizeSelectInputChunk("\u001b[200~line1\r\nline2\u001b[201~"),
    ).toBe("line1 line2");
  });
});
