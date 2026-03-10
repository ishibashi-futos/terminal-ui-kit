import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { type MentionDirectoryEntry } from "./core";

interface MentionFileSource {
  size: number;
  buffer: Buffer;
}

export function listMentionDirectoryEntries(
  cwd: string,
  dirInput: string,
): MentionDirectoryEntry[] | null {
  const baseDir = resolve(cwd, dirInput);

  try {
    return readdirSync(baseDir, {
      withFileTypes: true,
      encoding: "utf8",
    }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  } catch {
    return null;
  }
}

export function hasMentionFile(cwd: string, filePath: string): boolean {
  try {
    return statSync(resolve(cwd, filePath)).isFile();
  } catch {
    return false;
  }
}

export function readMentionFileSource(
  cwd: string,
  filePath: string,
): MentionFileSource | null {
  const absolutePath = resolve(cwd, filePath);

  let stat;
  try {
    stat = statSync(absolutePath);
  } catch {
    return null;
  }

  if (!stat.isFile()) {
    return null;
  }

  return {
    size: stat.size,
    buffer: readFileSync(absolutePath),
  };
}
