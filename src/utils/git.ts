import simpleGit from "simple-git";
import type { FileEntry } from "./config";

export interface CloneOrPullResult {
  cloned: boolean;
  pulled: boolean;
  conflicts: string[];
}

export async function cloneOrPull(
  remoteUrl: string,
  localPath: string
): Promise<CloneOrPullResult> {
  const exists = await Bun.file(`${localPath}/.git/HEAD`).exists();

  if (!exists) {
    const git = simpleGit();
    await git.clone(remoteUrl, localPath);
    return { cloned: true, pulled: false, conflicts: [] };
  }

  const git = simpleGit(localPath);
  try {
    await git.pull();
    return { cloned: false, pulled: true, conflicts: [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const conflicts: string[] = [];
    const match = message.match(/CONFLICTS:([\s\S]*)/);
    if (match?.[1]) {
      const lines = match[1].trim().split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) conflicts.push(trimmed);
      }
    }
    return { cloned: false, pulled: false, conflicts };
  }
}

export async function commitAndPush(
  repoPath: string,
  message: string,
  files: string[]
): Promise<void> {
  const git = simpleGit(repoPath);
  await git.add(files);
  await git.commit(message);
  await git.push();
}

export async function getRepoFileTree(repoPath: string): Promise<FileEntry[]> {
  const git = simpleGit(repoPath);
  const result = await git.raw(["ls-files"]);
  const paths = result
    .trim()
    .split("\n")
    .filter((p) => p.length > 0);

  // Build top-level entries (files and first-level dirs)
  const seen = new Set<string>();
  const entries: FileEntry[] = [];

  for (const filePath of paths) {
    const parts = filePath.split("/");
    if (parts.length === 1) {
      // Top-level file
      if (!seen.has(filePath)) {
        seen.add(filePath);
        entries.push({ name: filePath, isDirectory: false, path: filePath });
      }
    } else {
      // Nested — show as folder
      const dirName = parts[0] ?? filePath;
      if (!seen.has(dirName)) {
        seen.add(dirName);
        entries.push({ name: dirName, isDirectory: true, path: dirName });
      }
    }
  }

  return entries;
}

export async function getFilesInDir(
  repoPath: string,
  dirPath: string
): Promise<FileEntry[]> {
  const git = simpleGit(repoPath);
  const result = await git.raw(["ls-files", dirPath]);
  const paths = result
    .trim()
    .split("\n")
    .filter((p) => p.length > 0);

  const seen = new Set<string>();
  const entries: FileEntry[] = [];

  for (const filePath of paths) {
    const relative = filePath.startsWith(dirPath + "/")
      ? filePath.slice(dirPath.length + 1)
      : filePath;

    const parts = relative.split("/");
    const topName = parts[0] ?? relative;

    if (!seen.has(topName)) {
      seen.add(topName);
      entries.push({
        name: topName,
        isDirectory: parts.length > 1,
        path: `${dirPath}/${topName}`,
      });
    }
  }

  return entries;
}
