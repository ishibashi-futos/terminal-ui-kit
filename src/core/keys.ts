export const KEYS = {
  // 基本操作
  UP: "\u001b[A",
  DOWN: "\u001b[B",
  LEFT: "\u001b[D",
  RIGHT: "\u001b[C",
  ENTER: "\r",
  BACKSPACE: "\u007f",
  SUBMIT: "\u000a", // Ctrl + J

  // Ctrl系 (同時押し)
  CTRL_C: "\u0003",
  CTRL_R: "\u0012", // 履歴検索などに

  // Alt系 (同時押し)
  ALT_ENTER: "\u001b\r",

  // Shift系 (同時押し)
  SHIFT_UP: "\u001b[1;2A",
  SHIFT_DOWN: "\u001b[1;2B",
} as const;
export type KeyName = keyof typeof KEYS;
