export interface InputCommand {
  name: string;
  description?: string;
  callback?: (
    this: any,
    args: string[],
    rawInput: string,
  ) => void | Promise<void>;
  bind?: unknown;
}

export type InputMentionError = "binary_file" | "invalid_range" | "too_large";

export interface InputMention {
  path: string;
  startLine: number;
  endLine: number;
  content: string | null;
  truncated: boolean;
  error?: InputMentionError;
}
