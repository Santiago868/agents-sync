export interface GlobalConfig {
  remoteUrl: string;
}

export interface LocalConfig {
  mappedFolder: string;
}

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

const globalConfigPath = `${Bun.env.HOME}/.agents-cli-config.json`;
const localConfigPath = `${process.cwd()}/.agentrc.json`;

export function getRepoCachePath(): string {
  return `${Bun.env.HOME}/.team-agents-repo`;
}

export async function loadGlobalConfig(): Promise<GlobalConfig | null> {
  const file = Bun.file(globalConfigPath);
  if (!(await file.exists())) return null;
  return file.json();
}

export async function saveGlobalConfig(config: GlobalConfig): Promise<void> {
  await Bun.write(globalConfigPath, JSON.stringify(config, null, 2));
}

export async function loadLocalConfig(): Promise<LocalConfig | null> {
  const file = Bun.file(localConfigPath);
  if (!(await file.exists())) return null;
  return file.json();
}

export async function saveLocalConfig(config: LocalConfig): Promise<void> {
  await Bun.write(localConfigPath, JSON.stringify(config, null, 2));
}
