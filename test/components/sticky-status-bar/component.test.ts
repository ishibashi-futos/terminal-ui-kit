import { describe, expect, test } from "bun:test";
import {
  createStickyStatusBar,
  type StickyStatusBar,
} from "../../../src/components/sticky-status-bar/component";
import { ANSI } from "../../../src/core/ansi";

function createBar(): StickyStatusBar {
  return createStickyStatusBar();
}

describe("sticky status bar", () => {
  test("setText した内容を status プレフィックス付きで描画できる", () => {
    const bar = createBar();
    bar.setText("ready");

    expect(bar.renderLine()).toBe(
      `${ANSI.COLOR.BG_BLACK}${ANSI.COLOR.CYAN} status${ANSI.COLOR.FG_DEFAULT} ready${ANSI.COLOR.RESET}`,
    );
  });

  test("幅指定時は行末まで埋める", () => {
    const bar = createBar();
    bar.setText("ok");

    expect(bar.renderLine(20)).toBe(
      `${ANSI.COLOR.BG_BLACK}${ANSI.COLOR.CYAN} status${ANSI.COLOR.FG_DEFAULT} ok${" ".repeat(10)}${ANSI.COLOR.RESET}`,
    );
  });

  test("空文字列は非表示として扱える", () => {
    const bar = createBar();

    expect(bar.renderLine()).toBeNull();

    bar.setText("");
    expect(bar.renderLine()).toBeNull();
  });

  test("clear で表示内容を消せる", () => {
    const bar = createBar();
    bar.setText("working");
    bar.clear();

    expect(bar.renderLine()).toBeNull();
  });

  test("label/color をカスタムできる", () => {
    const bar = createStickyStatusBar({
      label: "task",
      color: ANSI.COLOR.YELLOW,
    });

    bar.setText("running");

    expect(bar.renderLine()).toBe(
      `${ANSI.COLOR.BG_BLACK}${ANSI.COLOR.YELLOW} task  ${ANSI.COLOR.FG_DEFAULT} running${ANSI.COLOR.RESET}`,
    );
  });
});
