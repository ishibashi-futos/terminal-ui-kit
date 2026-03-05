import { spawn } from "node:child_process";

type SupportedPlatform = "darwin" | "win32";

interface NotificationCommand {
  command: string;
  args: string[];
}

interface NotifyOptions {
  platform?: NodeJS.Platform;
  runCommand?: (command: string, args: string[]) => Promise<boolean>;
}

function escapeForAppleScript(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeForPowerShellSingleQuote(value: string): string {
  return value.replaceAll("'", "''");
}

export function resolveNotificationCommand(
  platform: NodeJS.Platform,
  title: string,
  message: string,
): NotificationCommand | null {
  if (platform === "darwin") {
    const escapedTitle = escapeForAppleScript(title);
    const escapedMessage = escapeForAppleScript(message);
    return {
      command: "osascript",
      args: [
        "-e",
        `display notification "${escapedMessage}" with title "${escapedTitle}"`,
      ],
    };
  }

  if (platform === "win32") {
    const escapedTitle = escapeForPowerShellSingleQuote(title);
    const escapedMessage = escapeForPowerShellSingleQuote(message);
    const script =
      `$title='${escapedTitle}';` +
      `$message='${escapedMessage}';` +
      "Add-Type -AssemblyName System.Windows.Forms;" +
      "Add-Type -AssemblyName System.Drawing;" +
      "$notify=New-Object System.Windows.Forms.NotifyIcon;" +
      "$notify.Icon=[System.Drawing.SystemIcons]::Information;" +
      "$notify.BalloonTipTitle=$title;" +
      "$notify.BalloonTipText=$message;" +
      "$notify.Visible=$true;" +
      "$notify.ShowBalloonTip(3000);" +
      "Start-Sleep -Milliseconds 3500;" +
      "$notify.Dispose();";
    return {
      command: "pwsh.exe",
      args: ["-NoProfile", "-Command", script],
    };
  }

  return null;
}

async function runCommand(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", () => {
      resolve(false);
    });
    child.once("exit", (code) => {
      resolve(code === 0);
    });
  });
}

export async function notify(
  title: string,
  message: string,
  options: NotifyOptions = {},
): Promise<boolean> {
  const platform = options.platform ?? process.platform;
  const command = resolveNotificationCommand(platform, title, message);
  if (command === null) {
    return false;
  }

  const commandRunner = options.runCommand ?? runCommand;
  return commandRunner(command.command, command.args);
}

export type { NotifyOptions, SupportedPlatform };
