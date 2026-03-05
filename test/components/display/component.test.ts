import { describe, expect, test } from "bun:test";
import {
  printError,
  printStatus,
  printToolCall,
} from "../../../src/components/display/component";
import { ANSI } from "../../../src/core/ansi";

describe("printStatus", () => {
  test("status プレフィックス付きで1行出力する", () => {
    const writes: string[] = [];

    printStatus("ready", {
      stdout: {
        write(chunk: string) {
          writes.push(chunk);
        },
      },
    });

    expect(writes).toEqual([
      `${ANSI.COLOR.BG_BLACK}${ANSI.COLOR.CYAN} status${ANSI.COLOR.FG_DEFAULT} ready${ANSI.COLOR.RESET}\n`,
    ]);
  });

  test("columns 指定時は行末まで背景色を埋める", () => {
    const writes: string[] = [];
    const message = "ok";

    printStatus(message, {
      stdout: {
        columns: 20,
        write(chunk: string) {
          writes.push(chunk);
        },
      },
    });

    expect(writes).toEqual([
      `${ANSI.COLOR.BG_BLACK}${ANSI.COLOR.CYAN} status${ANSI.COLOR.FG_DEFAULT} ok${" ".repeat(10)}${ANSI.COLOR.RESET}\n`,
    ]);
  });
});

describe("printToolCall", () => {
  test("引数なしの tool call を1行出力する", () => {
    const writes: string[] = [];

    printToolCall("deploy", undefined, {
      stdout: {
        write(chunk: string) {
          writes.push(chunk);
        },
      },
    });

    expect(writes).toEqual([
      `${ANSI.COLOR.BG_BLACK}${ANSI.COLOR.YELLOW} tool  ${ANSI.COLOR.FG_DEFAULT} deploy${ANSI.COLOR.RESET}\n`,
    ]);
  });

  test("object 引数は JSON 文字列化して出力する", () => {
    const writes: string[] = [];

    printToolCall(
      "deploy",
      { env: "prod", dryRun: true },
      {
        stdout: {
          write(chunk: string) {
            writes.push(chunk);
          },
        },
      },
    );

    expect(writes).toEqual([
      `${ANSI.COLOR.BG_BLACK}${ANSI.COLOR.YELLOW} tool  ${ANSI.COLOR.FG_DEFAULT} deploy {"env":"prod","dryRun":true}${ANSI.COLOR.RESET}\n`,
    ]);
  });
});

describe("printError", () => {
  test("error プレフィックス付きで stderr に1行出力する", () => {
    const writes: string[] = [];

    printError("failed", {
      stderr: {
        write(chunk: string) {
          writes.push(chunk);
        },
      },
    });

    expect(writes).toEqual([
      `${ANSI.COLOR.BG_BLACK}${ANSI.COLOR.RED} error ${ANSI.COLOR.FG_DEFAULT} failed${ANSI.COLOR.RESET}\n`,
    ]);
  });
});
