import { readdir } from "node:fs/promises";
import { join } from "node:path";
import simpleGit from "simple-git";
import type { FileEntry } from "./config";

const AUTH_PATTERNS = [
  "authentication failed",
  "could not read username",
  "permission denied",
  "repository not found",
  "fatal: could not read from remote",
  "host key verification failed",
  "invalid credentials",
  "401",
  "403",
];

function isAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return AUTH_PATTERNS.some((pattern) => lower.includes(pattern));
}

export class GitAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitAuthError";
  }
}

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
    try {
      await git.clone(remoteUrl, localPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (isAuthError(message)) {
        throw new GitAuthError(
          "Authentication failed. Ensure your Git credentials (SSH key or access token) are configured for this repository."
        );
      }
      throw err;
    }
    return { cloned: true, pulled: false, conflicts: [] };
  }

  const git = simpleGit(localPath);

  // Check if remote URL has changed
  const currentRemote = (await git.remote(['get-url', 'origin']))?.trim();
  if (currentRemote !== remoteUrl) {
    // Remote changed — delete stale clone and re-clone
    await Bun.$`rm -rf ${localPath}`;
    const freshGit = simpleGit();
    try {
      await freshGit.clone(remoteUrl, localPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (isAuthError(message)) {
        throw new GitAuthError(
          "Authentication failed. Ensure your Git credentials (SSH key or access token) are configured for this repository."
        );
      }
      throw err;
    }
    return { cloned: true, pulled: false, conflicts: [] };
  }

  try {
    await git.pull();
    return { cloned: false, pulled: true, conflicts: [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (isAuthError(message)) {
      throw new GitAuthError(
        "Authentication failed during pull. Check your Git credentials."
      );
    }
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
  try {
    await git.push();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isAuthError(msg)) {
      throw new GitAuthError(
        "Authentication failed during push. Check your Git credentials."
      );
    }
    throw err;
  }
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
    const fileName = parts[parts.length - 1] ?? "";
    if (fileName.toLowerCase().startsWith("readme")) continue;

    if (parts.length === 1) {
      // Top-level file
      if (!seen.has(filePath)) {
        seen.add(filePath);
        entries.push({ name: filePath, isDirectory: false, path: filePath, source: "remote" });
      }
    } else {
      // Nested — show as folder
      const dirName = parts[0] ?? filePath;
      if (!seen.has(dirName)) {
        seen.add(dirName);
        entries.push({ name: dirName, isDirectory: true, path: dirName, source: "remote" });
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
    const fileName = parts[parts.length - 1] ?? "";
    if (fileName.toLowerCase().startsWith("readme")) continue;

    if (!seen.has(topName)) {
      seen.add(topName);
      entries.push({
        name: topName,
        isDirectory: parts.length > 1,
        path: `${dirPath}/${topName}`,
        source: "remote",
      });
    }
  }

  return entries;
}

const IGNORED_NAMES = new Set([
  ".git",
  ".agentrc.json",
  "node_modules",
  ".DS_Store",
  "bun.lockb",
]);

const ALLOWED_DOT_DIRS = new Set([".cursor", ".claude"]);
const ALLOWED_DOT_FILES = new Set([".cursorrules"]);
const AGENT_EXTENSIONS = [".md", ".mdc", ".json"];

async function walkDir(dir: string, prefix: string): Promise<string[]> {
  const results: string[] = [];
  let dirents;
  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const dirent of dirents) {
    if (IGNORED_NAMES.has(dirent.name)) continue;
    const rel = prefix ? `${prefix}/${dirent.name}` : dirent.name;
    if (dirent.isDirectory()) {
      if (dirent.name.startsWith(".") && !ALLOWED_DOT_DIRS.has(dirent.name)) continue;
      results.push(...(await walkDir(join(dir, dirent.name), rel)));
    } else {
      if (dirent.name.startsWith(".") && !ALLOWED_DOT_FILES.has(dirent.name)) continue;
      const lower = dirent.name.toLowerCase();
      if (lower.startsWith("readme")) continue;
      if (AGENT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        results.push(rel);
      }
    }
  }
  return results;
}

export async function getLocalFiles(
  cwd: string,
  mappedFolder: string,
  subdir?: string
): Promise<FileEntry[]> {
  const allPaths = await walkDir(cwd, "");

  const subdirRelative = subdir && subdir.startsWith(mappedFolder + "/")
    ? subdir.slice(mappedFolder.length + 1)
    : subdir && subdir === mappedFolder
      ? ""
      : null;

  const seen = new Set<string>();
  const entries: FileEntry[] = [];

  for (const filePath of allPaths) {
    if (subdirRelative !== null && subdirRelative !== "") {
      if (!filePath.startsWith(subdirRelative + "/")) continue;
    }

    const fullPath = mappedFolder ? `${mappedFolder}/${filePath}` : filePath;

    let displayPath: string;
    if (subdir) {
      if (!fullPath.startsWith(subdir + "/")) continue;
      displayPath = fullPath.slice(subdir.length + 1);
    } else {
      displayPath = fullPath;
    }

    const parts = displayPath.split("/");
    const topName = parts[0] ?? displayPath;

    if (!seen.has(topName)) {
      seen.add(topName);
      entries.push({
        name: topName,
        isDirectory: parts.length > 1,
        path: subdir ? `${subdir}/${topName}` : topName,
        source: "local",
      });
    }
  }

  return entries;
}

export async function getLocalFilePaths(
  cwd: string,
  mappedFolder: string,
  dirPath: string
): Promise<string[]> {
  const allPaths = await walkDir(cwd, "");
  const subdirRelative = dirPath.startsWith(mappedFolder + "/")
    ? dirPath.slice(mappedFolder.length + 1)
    : dirPath === mappedFolder
      ? ""
      : null;

  const results: string[] = [];
  for (const filePath of allPaths) {
    if (subdirRelative !== null && subdirRelative !== "") {
      if (!filePath.startsWith(subdirRelative + "/")) continue;
    }
    results.push(`${mappedFolder}/${filePath}`);
  }
  return results;
}
