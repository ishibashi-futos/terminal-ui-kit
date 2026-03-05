import { describe, expect, test } from "bun:test";
import { notify } from "../../../src/components/notification/component";
import { resolveNotificationCommand } from "../../../src/utils/notify";

describe("notification", () => {
  test("macOS 用に osascript コマンドを組み立てできる", () => {
    const command = resolveNotificationCommand(
      "darwin",
      "Title",
      'Message with "quote"',
    );

    expect(command).not.toBeNull();
    expect(command?.command).toBe("osascript");
    expect(command?.args).toEqual([
      "-e",
      'display notification "Message with \\"quote\\"" with title "Title"',
    ]);
  });

  test("Windows 用に pwsh.exe コマンドを組み立てできる", () => {
    const command = resolveNotificationCommand("win32", "O'Hara", "it's ok");

    expect(command).not.toBeNull();
    expect(command?.command).toBe("pwsh.exe");
    expect(command?.args[0]).toBe("-NoProfile");
    expect(command?.args[1]).toBe("-Command");
    expect(command?.args[2]).toContain("$title='O''Hara';");
    expect(command?.args[2]).toContain("$message='it''s ok';");
  });

  test("非対応OSでは false を返す", async () => {
    const result = await notify("Title", "Message", {
      platform: "linux",
      runCommand: async () => true,
    });

    expect(result).toBe(false);
  });

  test("対応OSでは生成したコマンドを実行する", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const result = await notify("Title", "Message", {
      platform: "darwin",
      runCommand: async (command, args) => {
        calls.push({ command, args });
        return true;
      },
    });

    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe("osascript");
    expect(calls[0]?.args[0]).toBe("-e");
  });
});
