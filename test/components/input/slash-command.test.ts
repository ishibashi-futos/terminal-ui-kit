import { describe, expect, test } from "bun:test";
import {
  buildSlashCommandHintLines,
  completeSlashCommand,
  resolveSlashCommandState,
  runSlashCommandCallback,
} from "../../../src/components/input/slash-command";

describe("slash command helpers", () => {
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
