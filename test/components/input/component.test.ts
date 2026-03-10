import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildMentionPathHintLines,
  buildSlashCommandHintLines,
  buildInputLines,
  completeMentionPath,
  completeSlashCommand,
  extractMentionedFiles,
  extractMentionedFilePaths,
  normalizeInputChunk,
  resolveLineJumpCursorIndex,
  runSlashCommandCallback,
  resolveMentionPathHints,
  resolveSlashCommandState,
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

  test("スラッシュコマンド入力時に候補を取得できる", () => {
    const state = resolveSlashCommandState(
      "/he",
      3,
      [
        { name: "help", description: "ヘルプを表示" },
        { name: "hello", description: "挨拶する" },
        { name: "exit", description: "終了する" },
      ],
      5,
    );

    expect(state).not.toBeNull();
    expect(state?.query).toBe("he");
    expect(state?.suggestions.map((command) => command.name)).toEqual([
      "help",
      "hello",
    ]);
  });

  test("Tab 補完で単一候補のコマンド名に補完できる", () => {
    const result = completeSlashCommand("/hel", 4, [{ name: "help" }]);

    expect(result.completed).toBe(true);
    expect(result.buffer).toBe("/help");
    expect(result.cursorIndex).toBe(5);
  });

  test("Tab 補完で複数候補の共通接頭辞まで補完できる", () => {
    const result = completeSlashCommand("/h", 2, [
      { name: "help" },
      { name: "hello" },
      { name: "exit" },
    ]);

    expect(result.completed).toBe(true);
    expect(result.buffer).toBe("/hel");
    expect(result.cursorIndex).toBe(4);
  });

  test("候補表示行を組み立てできる", () => {
    expect(
      buildSlashCommandHintLines([
        { name: "help", description: "ヘルプを表示" },
        { name: "exit" },
      ]),
    ).toEqual(["  /help - ヘルプを表示", "  /exit"]);
  });

  test("@入力中に path 候補を取得できる", () => {
    const cwd = mkdtempSync(join(process.cwd(), "tmp-input-"));
    try {
      mkdirSync(join(cwd, "src"));
      writeFileSync(join(cwd, "README.md"), "ok");

      expect(resolveMentionPathHints("@s", 2, 5, cwd)).toEqual(["src/"]);
      expect(buildMentionPathHintLines(["src/", "README.md"])).toEqual([
        "  @src/",
        "  @README.md",
      ]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("@入力で Tab 補完できる", () => {
    const cwd = mkdtempSync(join(process.cwd(), "tmp-input-"));
    try {
      mkdirSync(join(cwd, "src"));
      writeFileSync(join(cwd, "src", "helpers.ts"), "ok");

      const directoryCompleted = completeMentionPath("@s", 2, cwd);
      expect(directoryCompleted.completed).toBe(true);
      expect(directoryCompleted.buffer).toBe("@src/");
      expect(directoryCompleted.cursorIndex).toBe(5);

      const fileCompleted = completeMentionPath("@src/he", 7, cwd);
      expect(fileCompleted.completed).toBe(true);
      expect(fileCompleted.buffer).toBe("@src/helpers.ts");
      expect(fileCompleted.cursorIndex).toBe(15);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("@path:range では : より後ろで path 候補を出さない", () => {
    const cwd = mkdtempSync(join(process.cwd(), "tmp-input-"));
    try {
      mkdirSync(join(cwd, "src"));
      writeFileSync(join(cwd, "src", "helpers.ts"), "ok");

      expect(resolveMentionPathHints("@src/he:1-10", 7, 5, cwd)).toEqual([
        "src/helpers.ts",
      ]);
      expect(resolveMentionPathHints("@src/he:1-10", 11, 5, cwd)).toEqual([]);

      const completed = completeMentionPath("@src/he:1-10", 7, cwd);
      expect(completed.completed).toBe(true);
      expect(completed.buffer).toBe("@src/helpers.ts:1-10");
      expect(completed.cursorIndex).toBe(15);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("送信文字列から指定ファイルの path を抽出できる", () => {
    const cwd = mkdtempSync(join(process.cwd(), "tmp-input-"));
    try {
      writeFileSync(join(cwd, "a.txt"), "a");
      writeFileSync(join(cwd, "b.txt"), "b");
      mkdirSync(join(cwd, "dir"));

      expect(
        extractMentionedFilePaths(
          "確認 @a.txt と @b.txt:2-3 と @a.txt:10-1 と @dir",
          cwd,
        ),
      ).toEqual(["a.txt", "b.txt"]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("送信文字列から指定ファイルの内容を抽出できる", () => {
    const cwd = mkdtempSync(join(process.cwd(), "tmp-input-"));
    try {
      writeFileSync(
        join(cwd, "a.txt"),
        Array.from({ length: 105 }, (_, index) => `line-${index + 1}`).join(
          "\n",
        ),
      );
      writeFileSync(join(cwd, "b.txt"), "a\nb\nc\nd");

      expect(
        extractMentionedFiles("確認 @a.txt と @b.txt:2-3 と @b.txt:4", cwd),
      ).toEqual([
        {
          path: "a.txt",
          startLine: 1,
          endLine: 100,
          content: Array.from(
            { length: 100 },
            (_, index) => `line-${index + 1}`,
          ).join("\n"),
          truncated: true,
        },
        {
          path: "b.txt",
          startLine: 2,
          endLine: 3,
          content: "b\nc",
          truncated: false,
        },
        {
          path: "b.txt",
          startLine: 4,
          endLine: 4,
          content: "d",
          truncated: false,
        },
      ]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("不正な行範囲はエラー付きメンションとして返す", () => {
    const cwd = mkdtempSync(join(process.cwd(), "tmp-input-"));
    try {
      writeFileSync(join(cwd, "a.txt"), "a\nb\nc");

      expect(
        extractMentionedFiles(
          "確認 @a.txt:10-1 と @a.txt:0 と @a.txt:5-6",
          cwd,
        ),
      ).toEqual([
        {
          path: "a.txt",
          startLine: 10,
          endLine: 1,
          content: null,
          truncated: false,
          error: "invalid_range",
        },
        {
          path: "a.txt",
          startLine: 0,
          endLine: 0,
          content: null,
          truncated: false,
          error: "invalid_range",
        },
        {
          path: "a.txt",
          startLine: 5,
          endLine: 6,
          content: null,
          truncated: false,
          error: "invalid_range",
        },
      ]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("巨大ファイルとバイナリファイルはエラーを返す", () => {
    const cwd = mkdtempSync(join(process.cwd(), "tmp-input-"));
    try {
      writeFileSync(join(cwd, "large.txt"), "a".repeat(60349));
      writeFileSync(join(cwd, "binary.bin"), Buffer.from([0x61, 0x00, 0x62]));

      expect(
        extractMentionedFiles("確認 @large.txt と @binary.bin:1-1", cwd),
      ).toEqual([
        {
          path: "large.txt",
          startLine: 1,
          endLine: 100,
          content: null,
          truncated: false,
          error: "too_large",
        },
        {
          path: "binary.bin",
          startLine: 1,
          endLine: 1,
          content: null,
          truncated: false,
          error: "binary_file",
        },
      ]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("送信時に一致する slash command callback を実行できる", async () => {
    let receivedArgs: string[] = [];
    let receivedRaw = "";
    const executed = await runSlashCommandCallback("/deploy prod --force", [
      {
        name: "deploy",
        callback: (args, rawInput) => {
          receivedArgs = args;
          receivedRaw = rawInput;
        },
      },
    ]);

    expect(executed).toBe(true);
    expect(receivedArgs).toEqual(["prod", "--force"]);
    expect(receivedRaw).toBe("/deploy prod --force");
  });

  test("bind 指定で callback 実行時の this を維持できる", async () => {
    const receiver = {
      prefix: "ok",
      logs: [] as string[],
      onStatus(this: { prefix: string; logs: string[] }, args: string[]) {
        this.logs.push(`${this.prefix}:${args.join(",")}`);
      },
    };

    const executed = await runSlashCommandCallback("/status now", [
      {
        name: "status",
        callback: receiver.onStatus,
        bind: receiver,
      },
    ]);

    expect(executed).toBe(true);
    expect(receiver.logs).toEqual(["ok:now"]);
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
