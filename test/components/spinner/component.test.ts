import { describe, expect, test } from "bun:test";
import {
  Spinner,
  withSpinner,
} from "../../../src/components/spinner/component";

describe("Spinner", () => {
  test("start でフレームを描画し、インターバルで次フレームへ進む", () => {
    const writes: string[] = [];
    const timerRef: {
      callback: (() => void) | null;
      intervalMs: number | null;
    } = {
      callback: null,
      intervalMs: null,
    };

    const spinner = new Spinner(
      "処理中",
      { frames: [".", "o"], intervalMs: 100 },
      {
        stdout: {
          write(chunk: string) {
            writes.push(chunk);
          },
        },
        setIntervalFn(callback, intervalMs) {
          timerRef.callback = callback;
          timerRef.intervalMs = intervalMs;
          return { id: 1 } as never;
        },
        clearIntervalFn() {},
      },
    );

    spinner.start();

    if (timerRef.callback === null || timerRef.intervalMs === null) {
      throw new Error("タイマーが登録されていません");
    }
    expect(timerRef.intervalMs).toBe(100);
    expect(writes.at(-1)).toBe("\r\u001b[2K. 処理中");

    timerRef.callback();

    expect(writes.at(-1)).toBe("\r\u001b[2Ko 処理中");
  });

  test("succeed でスピナーを停止し完了行を出力する", () => {
    const writes: string[] = [];
    let cleared = false;

    const spinner = new Spinner(
      "処理中",
      {},
      {
        stdout: {
          write(chunk: string) {
            writes.push(chunk);
          },
        },
        setIntervalFn() {
          return { id: 1 } as never;
        },
        clearIntervalFn() {
          cleared = true;
        },
      },
    );

    spinner.start();
    spinner.succeed("完了");

    expect(cleared).toBe(true);
    expect(writes.at(-1)).toBe("\r\u001b[2K✔ 完了\n");
  });
});

describe("withSpinner", () => {
  test("単一の非同期関数を待機して結果を返せる", async () => {
    let startCount = 0;
    let succeedMessage = "";
    let failCount = 0;

    const originalStart = Spinner.prototype.start;
    const originalSucceed = Spinner.prototype.succeed;
    const originalFail = Spinner.prototype.fail;

    Spinner.prototype.start = function () {
      startCount += 1;
    };
    Spinner.prototype.succeed = function (message?: string) {
      succeedMessage = message ?? "";
    };
    Spinner.prototype.fail = function () {
      failCount += 1;
    };

    try {
      const result = await withSpinner("読み込み", async () => 42, {
        successText: "完了",
      });

      expect(result).toBe(42);
      expect(startCount).toBe(1);
      expect(succeedMessage).toBe("完了");
      expect(failCount).toBe(0);
    } finally {
      Spinner.prototype.start = originalStart;
      Spinner.prototype.succeed = originalSucceed;
      Spinner.prototype.fail = originalFail;
    }
  });

  test("複数の非同期関数を待機して順序を維持した結果を返せる", async () => {
    const result = await withSpinner("実行", [
      async () => "first",
      async () => "second",
      async () => "third",
    ]);

    expect(result).toEqual(["first", "second", "third"]);
  });

  test("ラベル付きタスク配列を待機して結果を返せる", async () => {
    const result = await withSpinner("実行", [
      {
        label: "タスクA",
        task: async () => "A",
      },
      {
        label: "タスクB",
        task: async () => "B",
      },
    ]);

    expect(result).toEqual(["A", "B"]);
  });

  test("ラベル未指定のタスク配列でも結果を返せる", async () => {
    const result = await withSpinner("実行", [
      {
        task: async () => "A",
      },
      {
        label: "タスクB",
        task: async () => "B",
      },
    ]);

    expect(result).toEqual(["A", "B"]);
  });

  test("失敗時は fail 表示して例外を再送出する", async () => {
    let failMessage = "";
    const originalFail = Spinner.prototype.fail;

    Spinner.prototype.fail = function (message?: string) {
      failMessage = message ?? "";
    };

    try {
      await expect(
        withSpinner(
          "実行",
          async () => {
            throw new Error("boom");
          },
          {
            failureText: "失敗",
          },
        ),
      ).rejects.toThrow("boom");

      expect(failMessage).toBe("失敗");
    } finally {
      Spinner.prototype.fail = originalFail;
    }
  });

  test("単一タスクはタイムアウト時間を超えると失敗する", async () => {
    await expect(
      withSpinner(
        "実行",
        async () =>
          new Promise<number>(() => {
            return;
          }),
        { timeoutMs: 10 },
      ),
    ).rejects.toThrow("timed out");
  });

  test("複数タスクはタイムアウト時間を超えると失敗する", async () => {
    await expect(
      withSpinner(
        "実行",
        [
          async () => "A",
          async () =>
            new Promise<string>(() => {
              return;
            }),
        ],
        { timeoutMs: 10 },
      ),
    ).rejects.toThrow("timed out");
  });
});
