interface SpinnerIO {
  write: (chunk: string) => void;
}

type IntervalHandle = ReturnType<typeof setInterval>;

type SetIntervalFn = (
  callback: () => void,
  intervalMs: number,
) => IntervalHandle;

type ClearIntervalFn = (handle: IntervalHandle) => void;

export interface SpinnerOptions {
  intervalMs?: number;
  frames?: string[];
  successMark?: string;
  failureMark?: string;
}

interface SpinnerDependencies {
  stdout?: SpinnerIO;
  setIntervalFn?: SetIntervalFn;
  clearIntervalFn?: ClearIntervalFn;
}

export interface WithSpinnerOptions extends SpinnerOptions {
  successText?: string;
  failureText?: string;
  waitingMark?: string;
  runningMark?: string;
}

export type AsyncTask<T> = () => Promise<T>;

export interface AsyncTaskEntry<T> {
  label: string;
  task: AsyncTask<T>;
}

type TaskState = "waiting" | "running" | "success" | "failure";

const DEFAULT_FRAMES = ["-", "\\", "|", "/"];
const DEFAULT_INTERVAL_MS = 80;
const DEFAULT_SUCCESS_MARK = "✔";
const DEFAULT_FAILURE_MARK = "✖";
const DEFAULT_WAITING_MARK = "…";
const DEFAULT_RUNNING_MARK = ">";

export class Spinner {
  private readonly intervalMs: number;
  private readonly frames: string[];
  private readonly successMark: string;
  private readonly failureMark: string;
  private readonly stdout: SpinnerIO;
  private readonly setIntervalFn: SetIntervalFn;
  private readonly clearIntervalFn: ClearIntervalFn;

  private message: string;
  private frameIndex = 0;
  private timer: IntervalHandle | null = null;

  constructor(
    message: string,
    options: SpinnerOptions = {},
    dependencies: SpinnerDependencies = {},
  ) {
    this.message = message;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.frames =
      options.frames && options.frames.length > 0
        ? options.frames
        : DEFAULT_FRAMES;
    this.successMark = options.successMark ?? DEFAULT_SUCCESS_MARK;
    this.failureMark = options.failureMark ?? DEFAULT_FAILURE_MARK;
    this.stdout = dependencies.stdout ?? process.stdout;
    this.setIntervalFn = dependencies.setIntervalFn ?? setInterval;
    this.clearIntervalFn = dependencies.clearIntervalFn ?? clearInterval;
  }

  start() {
    if (this.timer !== null) {
      return;
    }

    this.renderFrame();
    this.timer = this.setIntervalFn(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.renderFrame();
    }, this.intervalMs);
  }

  updateMessage(message: string) {
    this.message = message;
    this.renderFrame();
  }

  stop() {
    if (this.timer !== null) {
      this.clearIntervalFn(this.timer);
      this.timer = null;
    }

    this.clearLine();
  }

  succeed(message: string = this.message) {
    this.finish(this.successMark, message);
  }

  fail(message: string = this.message) {
    this.finish(this.failureMark, message);
  }

  private finish(mark: string, message: string) {
    if (this.timer !== null) {
      this.clearIntervalFn(this.timer);
      this.timer = null;
    }

    this.stdout.write(`\r\u001b[2K${mark} ${message}\n`);
  }

  private renderFrame() {
    const frame = this.frames[this.frameIndex] ?? this.frames[0] ?? "-";
    this.stdout.write(`\r\u001b[2K${frame} ${this.message}`);
  }

  private clearLine() {
    this.stdout.write("\r\u001b[2K");
  }
}

class TaskProgressSpinner {
  private readonly intervalMs: number;
  private readonly frames: string[];
  private readonly successMark: string;
  private readonly failureMark: string;
  private readonly waitingMark: string;
  private readonly runningMark: string;
  private readonly stdout: SpinnerIO;
  private readonly setIntervalFn: SetIntervalFn;
  private readonly clearIntervalFn: ClearIntervalFn;
  private readonly taskLabels: string[];

  private frameIndex = 0;
  private timer: IntervalHandle | null = null;
  private renderedRows = 0;
  private taskStates: TaskState[];

  constructor(
    private message: string,
    taskLabels: string[],
    options: WithSpinnerOptions = {},
    dependencies: SpinnerDependencies = {},
  ) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.frames =
      options.frames && options.frames.length > 0
        ? options.frames
        : DEFAULT_FRAMES;
    this.successMark = options.successMark ?? DEFAULT_SUCCESS_MARK;
    this.failureMark = options.failureMark ?? DEFAULT_FAILURE_MARK;
    this.waitingMark = options.waitingMark ?? DEFAULT_WAITING_MARK;
    this.runningMark = options.runningMark ?? DEFAULT_RUNNING_MARK;
    this.stdout = dependencies.stdout ?? process.stdout;
    this.setIntervalFn = dependencies.setIntervalFn ?? setInterval;
    this.clearIntervalFn = dependencies.clearIntervalFn ?? clearInterval;
    this.taskLabels = taskLabels;
    this.taskStates = taskLabels.map(() => "waiting");
  }

  start() {
    if (this.timer !== null) {
      return;
    }

    this.renderCurrentFrame();
    this.timer = this.setIntervalFn(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.renderCurrentFrame();
    }, this.intervalMs);
  }

  markRunning(index: number) {
    this.taskStates[index] = "running";
    this.renderCurrentFrame();
  }

  markSuccess(index: number) {
    this.taskStates[index] = "success";
    this.renderCurrentFrame();
  }

  markFailure(index: number) {
    this.taskStates[index] = "failure";
    this.renderCurrentFrame();
  }

  succeed(message: string = this.message) {
    this.finish(this.successMark, message);
  }

  fail(message: string = this.message) {
    this.finish(this.failureMark, message);
  }

  private finish(mark: string, message: string) {
    if (this.timer !== null) {
      this.clearIntervalFn(this.timer);
      this.timer = null;
    }

    this.render([`${mark} ${message}`, ...this.buildTaskLines()]);
    this.stdout.write("\n");
    this.renderedRows = 0;
  }

  private renderCurrentFrame() {
    const frame = this.frames[this.frameIndex] ?? this.frames[0] ?? "-";
    this.render([`${frame} ${this.message}`, ...this.buildTaskLines()]);
  }

  private buildTaskLines(): string[] {
    const lines: string[] = [];
    for (let index = 0; index < this.taskLabels.length; index += 1) {
      const state = this.taskStates[index] ?? "waiting";
      const label = this.taskLabels[index] ?? `タスク${index + 1}`;
      lines.push(
        `${this.resolveMark(state)} ${label} (${this.resolveStateText(state)})`,
      );
    }
    return lines;
  }

  private resolveMark(state: TaskState): string {
    if (state === "success") {
      return this.successMark;
    }

    if (state === "failure") {
      return this.failureMark;
    }

    if (state === "running") {
      return this.runningMark;
    }

    return this.waitingMark;
  }

  private resolveStateText(state: TaskState): string {
    if (state === "success") {
      return "完了";
    }

    if (state === "failure") {
      return "失敗";
    }

    if (state === "running") {
      return "実行中";
    }

    return "待機中";
  }

  private render(lines: string[]) {
    if (this.renderedRows > 0) {
      this.stdout.write("\r");
      if (this.renderedRows > 1) {
        this.stdout.write(`\u001b[${this.renderedRows - 1}A`);
      }
    }

    this.stdout.write("\u001b[J");
    this.stdout.write(lines.join("\n"));
    this.renderedRows = lines.length;
  }
}

function normalizeTaskEntries<T>(
  taskOrEntries: AsyncTask<T>[] | AsyncTaskEntry<T>[],
): AsyncTaskEntry<T>[] {
  if (taskOrEntries.length === 0) {
    return [];
  }

  const first = taskOrEntries[0];
  if (typeof first === "function") {
    return (taskOrEntries as AsyncTask<T>[]).map((task, index) => ({
      label: `タスク${index + 1}`,
      task,
    }));
  }

  return taskOrEntries as AsyncTaskEntry<T>[];
}

export async function withSpinner<T>(
  message: string,
  task: AsyncTask<T>,
  options?: WithSpinnerOptions,
): Promise<T>;

export async function withSpinner<T>(
  message: string,
  tasks: AsyncTask<T>[],
  options?: WithSpinnerOptions,
): Promise<T[]>;

export async function withSpinner<T>(
  message: string,
  tasks: AsyncTaskEntry<T>[],
  options?: WithSpinnerOptions,
): Promise<T[]>;

export async function withSpinner<T>(
  message: string,
  taskOrTasks: AsyncTask<T> | AsyncTask<T>[] | AsyncTaskEntry<T>[],
  options: WithSpinnerOptions = {},
): Promise<T | T[]> {
  if (Array.isArray(taskOrTasks)) {
    const entries = normalizeTaskEntries(taskOrTasks);
    const taskSpinner = new TaskProgressSpinner(
      message,
      entries.map((entry) => entry.label),
      options,
    );

    taskSpinner.start();

    const results: T[] = new Array(entries.length);
    const settled = await Promise.allSettled(
      entries.map(async (entry, index) => {
        taskSpinner.markRunning(index);
        try {
          const result = await entry.task();
          results[index] = result;
          taskSpinner.markSuccess(index);
          return result;
        } catch (error) {
          taskSpinner.markFailure(index);
          throw error;
        }
      }),
    );

    const rejected = settled.find(
      (item): item is PromiseRejectedResult => item.status === "rejected",
    );

    if (rejected) {
      taskSpinner.fail(options.failureText ?? message);
      throw rejected.reason;
    }

    taskSpinner.succeed(options.successText ?? message);
    return results;
  }

  const spinner = new Spinner(message, options);
  spinner.start();

  try {
    const result = await taskOrTasks();
    spinner.succeed(options.successText ?? message);
    return result;
  } catch (error) {
    spinner.fail(options.failureText ?? message);
    throw error;
  }
}
