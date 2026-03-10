import { type InputMention } from "../types";
import { resolveMentionContent } from "./core";
import { hasMentionFile, readMentionFileSource } from "./fs";
import { collectParsedMentionTokens } from "./token";

export function extractMentionedFilePaths(
  input: string,
  cwd: string = process.cwd(),
): string[] {
  const unique = new Set<string>();

  for (const parsed of collectParsedMentionTokens(input)) {
    if (hasMentionFile(cwd, parsed.path)) {
      unique.add(parsed.path);
    }
  }

  return Array.from(unique);
}

export function extractMentionedFiles(
  input: string,
  cwd: string = process.cwd(),
): InputMention[] {
  const mentions: InputMention[] = [];

  for (const parsed of collectParsedMentionTokens(input)) {
    const fileSource = readMentionFileSource(cwd, parsed.path);
    if (fileSource === null) {
      continue;
    }

    mentions.push(resolveMentionContent(parsed, fileSource));
  }

  return mentions;
}
