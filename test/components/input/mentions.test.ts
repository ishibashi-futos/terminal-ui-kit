import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractMentionedFiles,
  extractMentionedFilePaths,
} from "../../../src/components/input/mentions/extract";
import {
  buildMentionPathHintLines,
  completeMentionPath,
  resolveMentionPathHints,
} from "../../../src/components/input/mentions/path-completion";
import {
  collectParsedMentionTokens,
  parseMentionToken,
} from "../../../src/components/input/mentions/token";
import { normalizeInputChunk } from "../../../src/components/input/text-normalization";

describe("mention helpers", () => {
  test("貼り付けチャンクの制御シーケンスと改行コードを正規化できる", () => {
    const pasted = "\u001b[200~line1\r\nline2\rline3\u001b[201~";
    expect(normalizeInputChunk(pasted)).toBe("line1\nline2\nline3");
  });

  test("@token を純粋関数で解析できる", () => {
    expect(parseMentionToken("src/file.ts:2-3")).toEqual({
      path: "src/file.ts",
      startLine: 2,
      endLine: 3,
      hasExplicitRange: true,
      hasInvalidRange: false,
    });
    expect(collectParsedMentionTokens("確認 @a.txt と @b.txt:4")).toEqual([
      {
        path: "a.txt",
        startLine: 1,
        endLine: 100,
        hasExplicitRange: false,
        hasInvalidRange: false,
      },
      {
        path: "b.txt",
        startLine: 4,
        endLine: 4,
        hasExplicitRange: true,
        hasInvalidRange: false,
      },
    ]);
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
});
