import { describe, expect, test } from "bun:test";
import { ANSI } from "../../src/core/ansi";
import { Terminal } from "../../src/core/terminal";

interface FakeStdin {
  setRawMode: (enabled: boolean) => void;
  resume: () => void;
  setEncoding: (encoding: string) => void;
  on: (event: string, handler: (chunk: string) => void) => void;
  off: (event: string, handler: (chunk: string) => void) => void;
  pause: () => void;
  emitData: (chunk: string) => void;
}

interface FakeStdout {
  write: (chunk: string) => void;
}

function createFakeStdin(): FakeStdin {
  let dataHandler: ((chunk: string) => void) | null = null;

  return {
    setRawMode() {},
    resume() {},
    setEncoding() {},
    on(event, handler) {
      if (event === "data") {
        dataHandler = handler;
      }
    },
    off(event, handler) {
      if (event === "data" && dataHandler === handler) {
        dataHandler = null;
      }
    },
    pause() {},
    emitData(chunk) {
      dataHandler?.(chunk);
    },
  };
}

describe("Terminal", () => {
  test("カーソルが途中行にある状態でも update が入力エリア外を消さない", () => {
    const writes: string[] = [];
    const stdin = createFakeStdin();
    const stdout: FakeStdout = {
      write(chunk: string) {
        writes.push(chunk);
      },
    };

    const term = new Terminal(stdin as never, stdout as never);

    term.update(["prompt> abc", "        def"]);
    term.setCursorPosition(0, 3, 2);

    writes.length = 0;

    term.update(["prompt> abc", "        def"]);

    expect(writes.join("")).toStartWith(`\r${ANSI.ERASE_DOWN}`);
  });

  test("ブラケットペーストの制御シーケンスを除去して onAnyChar に渡せる", () => {
    const stdin = createFakeStdin();
    const stdout: FakeStdout = { write() {} };
    const term = new Terminal(stdin as never, stdout as never);
    let received = "";

    const cleanup = term.bindActions({}, (chunk) => {
      received += chunk;
    });

    stdin.emitData("\u001b[200~line1\r\nline2\u001b[201~");

    expect(received).toBe("line1\r\nline2");
    cleanup();
  });
});
