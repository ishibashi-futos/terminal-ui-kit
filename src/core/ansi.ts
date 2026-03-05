export const ESC = "\u001b";
export const CSI = `${ESC}[`;

export const ANSI = {
  CURSOR_UP: (n: number) => `${CSI}${n}A`,
  CURSOR_LEFT: "\r",
  ERASE_DOWN: `${CSI}J`,
  ERASE_LINE: `${CSI}2K`,
  COLOR: {
    FG_DEFAULT: `${CSI}39m`,
    CYAN: `${CSI}36m`,
    YELLOW: `${CSI}33m`,
    RED: `${CSI}31m`,
    BG_BLACK: `${CSI}40m`,
    RESET: `${CSI}0m`,
    // 必要に応じて追加
  },
} as const;
