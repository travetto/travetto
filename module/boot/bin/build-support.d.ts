export var log: (...args: unknown[]) => void;
type SpawnCfg = { args?: string[], cwd?: string, failOnError?: boolean, env?: Record<string, string> };
export var spawn: (action: string, cmd: string, cfg?: SpawnCfg) => Promise<void>;
export var isFolderStale: (folder: string) => boolean;
export type BuildConfig = {
  outputFolder: string;
  compilerFolder: string;
  watch?: boolean;
};