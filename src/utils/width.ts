/**
 * 文字の表示幅を計算する (CJK対応)
 */
export function getDisplayWidth(str: string): number {
  let width = 0;
  // Array.from はサロゲートペア（絵文字など）を正しく分割する
  const chars = Array.from(str);

  for (const char of chars) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;

    // 1. 制御文字 (Control Characters)
    // 改行などは計算上 0 とみなす（描画ロジック側で処理するため）
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      width += 0;
      continue;
    }

    // 2. ASCII 範囲
    if (code <= 0x7f) {
      width += 1;
      continue;
    }

    // 3. 半角カタカナ (Half-width Katakana)
    // 範囲: U+FF61 - U+FF9F
    if (code >= 0xff61 && code <= 0xff9f) {
      width += 1;
      continue;
    }

    // 4. ゼロ幅文字 (Zero Width Space 等)
    // 主要なもののみ。必要に応じて追加
    if (code === 0x200b || code === 0xfeff) {
      width += 0;
      continue;
    }

    // 5. その他（漢字、ひらがな、全角カタカナ、全角記号、絵文字など）
    // 基本的にこれらは幅2とみなす
    width += 2;
  }
  return width;
}

/**
 * 文字列が指定した表示幅を超えないか、指定幅でカットする
 */
export function sliceByDisplayWidth(str: string, maxWidth: number): string {
  let currentWidth = 0;
  let result = "";
  for (const char of Array.from(str)) {
    const w = getDisplayWidth(char);
    if (currentWidth + w > maxWidth) break;
    result += char;
    currentWidth += w;
  }
  return result;
}

/**
 * 指定した表示幅で文字列を切り取る (Table表示などで必須)
 */
export function truncate(str: string, maxWidth: number): string {
  let currentWidth = 0;
  let result = "";
  for (const char of Array.from(str)) {
    const charWidth = getDisplayWidth(char);
    if (currentWidth + charWidth > maxWidth) break;
    result += char;
    currentWidth += charWidth;
  }
  return result;
}
