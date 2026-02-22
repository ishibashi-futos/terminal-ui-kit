import { MultiLineInput, select } from "./lib";

// 実行例
const input = new MultiLineInput("Prompt > ");
while (true) {
  const selected = await select("お試しするアクションを選択してください", [
    { label: "✒️ 複数行入力", value: "multi-line-input" },
    { label: "❌ 終了", value: "exit" },
  ]);

  switch (selected) {
    case "multi-line-input": {
      const result = await input.ask();
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
