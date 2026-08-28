import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface UserConfig {
  defaultOutputDir?: string;
  defaultTargetFaces?: number;
  defaultMode?: 'merged' | 'split' | 'both';
}

const CONFIG_PATH = path.join(os.homedir(), '.cadliterc');

export async function loadConfig(): Promise<UserConfig> {
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function saveConfig(config: UserConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}
