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
}

interface FakeStdout {
  write: (chunk: string) => void;
}

function createFakeStdin(): FakeStdin {
  return {
    setRawMode() {},
    resume() {},
    setEncoding() {},
    on() {},
    off() {},
    pause() {},
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
});
