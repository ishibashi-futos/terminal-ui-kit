import {
  select,
  input,
  withSpinner,
  HistoryManager,
  printStatus,
  printToolCall,
  printError,
  createStickyStatusBar,
  notify,
} from "../src/lib";

// 実行例
const history = new HistoryManager({ maxEntries: 100 });
history.deserialize({
  version: 1,
  entries: [
    { seq: 10, text: "前回の入力A" },
    { seq: 11, text: "前回の入力B" },
  ],
});
while (true) {
  const selected = await select("お試しするアクションを選択してください", [
    { label: "✒️ 複数行入力(関数版)", value: "multi-line-input-fn" },
    {
      label: "🧭 Slash Command + 補完サンプル",
      value: "slash-command-sample",
    },
    {
      label: "⏳ Spinner + 非同期待機サンプル(単一タスク)",
      value: "spinner-sample",
    },
    {
      label: "⏳ Spinner + 非同期待機サンプル(複数タスク)",
      value: "spinner-sample-multiple",
    },
    {
      label: "🖨️ status/log/error 表示サンプル",
      value: "display-api-sample",
    },
    {
      label: "📌 Sticky Status Bar サンプル",
      value: "sticky-status-bar-sample",
    },
    {
      label: "📝 select + 自由入力サンプル",
      value: "select-custom-input-sample",
    },
    {
      label: "🔔 OS通知サンプル",
      value: "os-notification-sample",
    },
    { label: "❌ 終了", value: "exit" },
  ]);

  switch (selected) {
    case "multi-line-input-fn": {
      const result = await input("Prompt > ", history, {
        onDoubleCtrlC: () => {
          console.log("Ctrl + C が短時間に2回押されたため終了します");
          process.exit(0);
        },
      });
      console.log("--- 送信内容 ---");
      console.log(result.value.trim());
      console.log("--- 履歴エクスポート ---");
      console.log(history.exportHistory());
      console.log("--- 履歴シリアライズ ---");
      console.log(history.serialize());
      console.log("--- 指定ファイル ---");
      console.log(result.paths);
      console.log("--- 指定メンション ---");
      console.log(result.mentions);
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
      console.log(result.value.trim());
      console.log("--- 指定ファイル ---");
      console.log(result.paths);
      console.log("--- 指定メンション ---");
      console.log(result.mentions);
      break;
    }
    case "exit": {
      console.log("--- 終了が選択されました ---");
      process.exit(0);
    }
    case "spinner-sample": {
      const singleResult = await withSpinner("単一タスクを実行中", async () => {
        await Bun.sleep(900);
        return "single-done";
      });

      console.log(`[single] result=${singleResult}`);
      break;
    }
    case "spinner-sample-multiple": {
      const multipleResults = await withSpinner(
        "複数タスクを並列実行中",
        [
          {
            label: "設定ファイルを読み込み",
            task: async () => {
              await Bun.sleep(1500);
              return "task-a";
            },
          },
          {
            label: "依存関係を解決",
            task: async () => {
              await Bun.sleep(2000);
              return "task-b";
            },
          },
          {
            label: "キャッシュを検証",
            task: async () => {
              await Bun.sleep(1000);
              return "task-c";
            },
          },
        ],
        {
          successText: "複数タスク完了",
        },
      );

      console.log(`[multiple] result=${multipleResults.join(", ")}`);
      break;
    }
    case "display-api-sample": {
      printStatus("セッションを初期化しています");
      printToolCall("read_file", { path: "./README.md" });
      printToolCall("exec", "bun test");
      printError("テスト実行に失敗しました");
      break;
    }
    case "select-custom-input-sample": {
      const plan = await select(
        "今日やるタスクを選択/入力してください",
        [
          { label: "ドキュメント作成", value: "docs" },
          { label: "テスト追加", value: "test" },
          { label: "リファクタリング", value: "refactor" },
        ],
        {
          allowCustomInput: true,
          customInputLabel: "✍️ その他を入力",
        },
      );
      console.log(`[select-custom-input] result=${plan}`);
      break;
    }
    case "sticky-status-bar-sample": {
      const stickyBar = createStickyStatusBar();

      const inputResult = await input("Prompt > ", history, {
        stickyStatusBar: {
          bar: stickyBar,
          render: ({ buffer }) =>
            buffer.length === 0 ? "" : `Input length: ${buffer.length} chars`,
        },
      });
      console.log(`[sticky-input] value=${inputResult.value.trim()}`);

      const selected = await select(
        "次のアクションを選択してください",
        [
          { label: "Build", value: "build" },
          { label: "Test", value: "test" },
          { label: "Deploy", value: "deploy" },
        ],
        {
          allowCustomInput: true,
          stickyStatusBar: {
            bar: stickyBar,
            render: ({ selectedLabel, isCustomInputSelected, customInput }) => {
              if (isCustomInputSelected) {
                return customInput.length === 0
                  ? "Custom input is empty"
                  : `Custom input: ${customInput}`;
              }

              return `Selected: ${selectedLabel}`;
            },
          },
        },
      );
      console.log(`[sticky-select] result=${selected}`);
      break;
    }
    case "os-notification-sample": {
      const notified = await notify(
        "terminal-ui-kit",
        "OS notification sample message",
      );
      console.log(`[os-notification] success=${notified}`);
      break;
    }
  }
}
