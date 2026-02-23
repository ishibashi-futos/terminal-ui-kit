import { select, input, HistoryManager } from "./lib";

// 実行例
const history = new HistoryManager();
while (true) {
  const selected = await select("お試しするアクションを選択してください", [
    { label: "✒️ 複数行入力(関数版)", value: "multi-line-input-fn" },
    { label: "❌ 終了", value: "exit" },
  ]);

  switch (selected) {
    case "multi-line-input-fn": {
      const result = await input("Prompt > ", history);
      console.log("--- 送信内容 ---");
      console.log(result.trim());
      break;
    }
    case "exit": {
      console.log("--- 終了が選択されました ---");
      process.exit(0);
    }
  }
}
