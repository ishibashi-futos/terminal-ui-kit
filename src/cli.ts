import { select, input, HistoryManager } from "./lib";

// 実行例
const history = new HistoryManager();
while (true) {
  const selected = await select("お試しするアクションを選択してください", [
    { label: "✒️ 複数行入力(関数版)", value: "multi-line-input-fn" },
    {
      label: "🧭 Slash Command + 補完サンプル",
      value: "slash-command-sample",
    },
    { label: "❌ 終了", value: "exit" },
  ]);

  switch (selected) {
    case "multi-line-input-fn": {
      const result = await input("Prompt > ", history);
      console.log("--- 送信内容 ---");
      console.log(result.trim());
      break;
    }
    case "slash-command-sample": {
      const commandContext = {
        service: "sample-service",
      };
      const result = await input("Prompt > ", history, {
        commands: [
          {
            name: "help",
            description: "使い方を表示",
            callback: () => {
              console.log("利用可能コマンド: /help /status /deploy /exit");
            },
          },
          {
            name: "status",
            description: "現在状態を確認",
            callback: function (args) {
              const target = args[0] ?? "default";
              console.log(`[status] target=${target}`);
            },
          },
          {
            name: "deploy",
            description: "デプロイを開始",
            callback: function (this: { service: string }, args) {
              const env = args[0] ?? "staging";
              console.log(`[deploy] service=${this.service} env=${env}`);
            },
            bind: commandContext,
          },
          {
            name: "exit",
            description: "終了する",
            callback: () => {
              console.log("exit コマンドが入力されました");
              process.exit(0);
            },
          },
        ],
      });

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
