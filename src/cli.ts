import { HistoryManager, createStickyStatusBar, input, select } from "./lib";

// Sticky Status Bar の最小サンプル実装
const history = new HistoryManager();
const stickyBar = createStickyStatusBar();

const inputResult = await input("Prompt > ", history, {
  stickyStatusBar: {
    bar: stickyBar,
    render: ({ buffer }) =>
      buffer.length === 0 ? "" : `入力文字数: ${buffer.length}`,
  },
});

console.log(`入力結果: ${inputResult.value.trim()}`);

const nextAction = await select(
  "次の操作を選択してください",
  [
    { label: "保存", value: "save" },
    { label: "終了", value: "exit" },
  ],
  {
    stickyStatusBar: {
      bar: stickyBar,
      render: ({ selectedLabel }) => `選択中: ${selectedLabel}`,
    },
  },
);

console.log(`選択結果: ${nextAction}`);
