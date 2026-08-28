export interface UserConfig {
  defaultOutputDir?: string;
  defaultTargetFaces?: number;
  defaultMode?: 'merged' | 'split' | 'both';
}

export function loadConfig(): UserConfig {
  throw new Error('loadConfig: 未实现');
}

export function saveConfig(_config: UserConfig): void {
  throw new Error('saveConfig: 未实现');
}
