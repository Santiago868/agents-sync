import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";

export async function copyFile(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  await Bun.write(dest, Bun.file(src));
}

export async function readFileText(path: string): Promise<string> {
  return Bun.file(path).text();
}

export async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

export async function generateDiff(
  pathA: string,
  pathB: string
): Promise<string> {
  try {
    const result = await Bun.$`git diff --no-index -- ${pathA} ${pathB}`.quiet();
    return result.text();
  } catch (err: unknown) {
    // git diff --no-index exits with code 1 when files differ — expected
    const e = err as unknown as { exitCode: number; stdout: Buffer };
    if (e?.exitCode === 1 && e.stdout) {
      return e.stdout.toString();
    }
    throw err;
  }
}
