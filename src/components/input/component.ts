import { Terminal } from "../../core/terminal";
import { type StickyStatusBar } from "../sticky-status-bar/component";
import { type HistoryManager } from "../../utils/history";
import { getDisplayWidth } from "../../utils/width";
import {
  completeSlashCommand,
  buildSlashCommandHintLines,
  resolveSlashCommandState,
  runSlashCommandCallback,
} from "./slash-command";
import { buildInputLines } from "./layout";
import {
  buildMentionPathHintLines,
  completeMentionPath,
  resolveMentionPathHints,
} from "./mentions/path-completion";
import {
  extractMentionedFiles,
  extractMentionedFilePaths,
} from "./mentions/extract";
import {
  resolveLineJumpCursorIndex,
  resolveVerticalCursorMove,
} from "./cursor";
import { type InputMention, type InputCommand } from "./types";
import { normalizeInputChunk } from "./text-normalization";

export interface InputOptions {
  commands?: InputCommand[];
  onDoubleCtrlC?: () => void | Promise<void>;
  doubleCtrlCThresholdMs?: number;
  stickyStatusBar?: {
    bar: StickyStatusBar;
    render: (state: InputStickyStatusState) => string;
  };
}

export interface InputResult {
  value: string;
  paths: string[];
  mentions: InputMention[];
}

export interface InputStickyStatusState {
  buffer: string;
  cursorIndex: number;
  terminalWidth: number;
}

export async function input(
  prompt: string,
  history: HistoryManager,
  options: InputOptions = {},
): Promise<InputResult> {
  const defaultDoubleCtrlCThresholdMs = 500;
  const defaultDoubleCtrlCHintDurationMs = 2500;
  const doubleCtrlCHintMessage = "Press Ctrl+C again to exit";
  const term = new Terminal();
  const promptWidth: number = getDisplayWidth(prompt);
  const commands = options.commands ?? [];
  const onDoubleCtrlC = options.onDoubleCtrlC ?? (() => term.exit());
  const doubleCtrlCThresholdMs =
    options.doubleCtrlCThresholdMs ?? defaultDoubleCtrlCThresholdMs;
  let buffer: string = "";
  let cursorIndex = 0;
  let preferredColumn: number | null = null;
  let lastCtrlCAt: number | null = null;
  let lastCtrlCHintAt: number | null = null;
  let showDoubleCtrlCHint = false;
  let doubleCtrlCHintTimer: ReturnType<typeof setTimeout> | null = null;

  return new Promise((resolve, reject) => {
    const render = (withStickyBar = true) => {
      const terminalWidth = term.getWidth();
      const layout = buildInputLines(
        buffer,
        cursorIndex,
        prompt,
        promptWidth,
        terminalWidth,
      );
      const commandState = resolveSlashCommandState(
        buffer,
        cursorIndex,
        commands,
      );
      const mentionSuggestions = resolveMentionPathHints(buffer, cursorIndex);
      const hintLines =
        mentionSuggestions.length > 0
          ? buildMentionPathHintLines(mentionSuggestions)
          : commandState
            ? buildSlashCommandHintLines(commandState.suggestions)
            : [];
      const shouldShowDoubleCtrlCHint =
        showDoubleCtrlCHint &&
        lastCtrlCHintAt !== null &&
        Date.now() - lastCtrlCHintAt <= defaultDoubleCtrlCHintDurationMs;
      if (shouldShowDoubleCtrlCHint) {
        hintLines.push(`  ${doubleCtrlCHintMessage}`);
      }
      const lines = [...layout.lines, ...hintLines];
      let stickyRows = 0;
      const stickyStatusBar = options.stickyStatusBar;
      if (withStickyBar && stickyStatusBar) {
        stickyStatusBar.bar.setText(
          stickyStatusBar.render({
            buffer,
            cursorIndex,
            terminalWidth,
          }),
        );
        const stickyLine = stickyStatusBar.bar.renderLine(terminalWidth);
        lines.push(stickyLine ?? "");
        stickyRows = 1;
      }
      const totalRows = layout.totalRows + hintLines.length + stickyRows;
      term.update(lines, totalRows);
      term.setCursorPosition(layout.cursorRow, layout.cursorCol, totalRows);
    };

    const resetVerticalPreference = () => {
      preferredColumn = null;
    };
    const resetDoubleCtrlCWindow = () => {
      lastCtrlCAt = null;
      lastCtrlCHintAt = null;
      showDoubleCtrlCHint = false;
      if (doubleCtrlCHintTimer !== null) {
        clearTimeout(doubleCtrlCHintTimer);
        doubleCtrlCHintTimer = null;
      }
    };
    const armDoubleCtrlCHintTimer = () => {
      if (doubleCtrlCHintTimer !== null) {
        clearTimeout(doubleCtrlCHintTimer);
      }

      doubleCtrlCHintTimer = setTimeout(() => {
        showDoubleCtrlCHint = false;
        lastCtrlCHintAt = null;
        doubleCtrlCHintTimer = null;
        render();
      }, defaultDoubleCtrlCHintDurationMs);
    };

    const moveCursorVertical = (direction: -1 | 1): boolean => {
      const moved = resolveVerticalCursorMove(
        buffer,
        cursorIndex,
        preferredColumn,
        direction,
      );
      if (moved === null) {
        return false;
      }

      cursorIndex = moved.cursorIndex;
      preferredColumn = moved.preferredColumn;
      return true;
    };
    const moveCursorLineBoundary = (direction: "start" | "end") => {
      resetDoubleCtrlCWindow();
      cursorIndex = resolveLineJumpCursorIndex(buffer, cursorIndex, direction);
      resetVerticalPreference();
      render();
    };

    const applyHistoryBuffer = (nextBuffer: string) => {
      resetDoubleCtrlCWindow();
      buffer = nextBuffer;
      cursorIndex = buffer.length;
      resetVerticalPreference();
      render();
    };

    const applyBufferEdit = (nextBuffer: string, nextCursorIndex: number) => {
      resetDoubleCtrlCWindow();
      buffer = nextBuffer;
      cursorIndex = nextCursorIndex;
      history.reset(buffer);
      resetVerticalPreference();
      render();
    };

    const cleanup = term.bindActions(
      {
        SUBMIT: async () => {
          resetDoubleCtrlCWindow();
          if (!buffer) {
            return;
          }

          const result = buffer;
          const paths = extractMentionedFilePaths(result);
          const mentions = extractMentionedFiles(result);
          history.add(result);
          options.stickyStatusBar?.bar.clear();
          render(false);
          term.finalize();
          cleanup();
          try {
            await runSlashCommandCallback(result, commands);
          } catch (error) {
            reject(error);
            return;
          }
          resolve({ value: result, paths, mentions });
          return;
        },
        UP: () => {
          resetDoubleCtrlCWindow();
          if (moveCursorVertical(-1)) {
            render();
            return;
          }

          const prev = history.prev(buffer);
          if (prev !== null) {
            applyHistoryBuffer(prev);
          }
          return;
        },
        DOWN: () => {
          resetDoubleCtrlCWindow();
          if (moveCursorVertical(1)) {
            render();
            return;
          }

          const next = history.next();
          if (next !== null) {
            applyHistoryBuffer(next);
          }
          return;
        },
        LEFT: () => {
          resetDoubleCtrlCWindow();
          if (cursorIndex > 0) {
            cursorIndex--;
            resetVerticalPreference();
            render();
          }
        },
        RIGHT: () => {
          resetDoubleCtrlCWindow();
          if (cursorIndex < buffer.length) {
            cursorIndex++;
            resetVerticalPreference();
            render();
          }
        },
        HOME: () => {
          moveCursorLineBoundary("start");
        },
        HOME_APP: () => {
          moveCursorLineBoundary("start");
        },
        END: () => {
          moveCursorLineBoundary("end");
        },
        END_APP: () => {
          moveCursorLineBoundary("end");
        },
        CTRL_A: () => {
          moveCursorLineBoundary("start");
        },
        CTRL_E: () => {
          moveCursorLineBoundary("end");
        },
        BACKSPACE: () => {
          resetDoubleCtrlCWindow();
          if (cursorIndex > 0) {
            const chars = Array.from(buffer);
            chars.splice(cursorIndex - 1, 1); // カーソルの前の文字を消す
            applyBufferEdit(chars.join(""), cursorIndex - 1);
          }
        },
        ENTER: () => {
          resetDoubleCtrlCWindow();
          const chars = Array.from(buffer);
          chars.splice(cursorIndex, 0, "\n");
          applyBufferEdit(chars.join(""), cursorIndex + 1);
        },
        TAB: () => {
          resetDoubleCtrlCWindow();
          const mentionResult = completeMentionPath(buffer, cursorIndex);
          if (mentionResult.completed) {
            applyBufferEdit(mentionResult.buffer, mentionResult.cursorIndex);
            return;
          }

          const slashResult = completeSlashCommand(
            buffer,
            cursorIndex,
            commands,
          );
          if (!slashResult.completed) {
            return;
          }

          applyBufferEdit(slashResult.buffer, slashResult.cursorIndex);
        },
        CTRL_C: async () => {
          const now = Date.now();
          const isDoublePressed =
            lastCtrlCAt !== null && now - lastCtrlCAt <= doubleCtrlCThresholdMs;

          if (isDoublePressed) {
            cleanup();
            options.stickyStatusBar?.bar.clear();
            render(false);
            term.finalize();
            try {
              await onDoubleCtrlC();
            } catch (error) {
              reject(error);
            }
            return;
          }

          lastCtrlCAt = now;
          lastCtrlCHintAt = now;
          showDoubleCtrlCHint = true;
          armDoubleCtrlCHintTimer();
          buffer = "";
          cursorIndex = 0;
          history.reset(buffer);
          resetVerticalPreference();
          render();
        },
      },
      (char) => {
        resetDoubleCtrlCWindow();
        const normalized = normalizeInputChunk(char);
        if (!normalized) {
          return;
        }

        const chars = Array.from(buffer);
        chars.splice(cursorIndex, 0, normalized);
        applyBufferEdit(
          chars.join(""),
          cursorIndex + Array.from(normalized).length,
        );
        return;
      },
    );

    render();
  });
}
