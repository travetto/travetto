// Manifest types
export type ManifestModuleFileType = 'd.ts' | 'ts' | 'js' | 'json' | 'unknown';

export type ManifestModuleFile = [string, ManifestModuleFileType, number];

export type ManifestModule<T = Record<string, ManifestModuleFile[]>> = {
  id: string;
  name: string;
  source: string;
  output: string;
  files: T;
};

export type Manifest = {
  generated: number;
  modules: Record<string, ManifestModule>;
};

export type ManifestDeltaEvent = [string, 'added' | 'changed' | 'removed' | 'missing' | 'dirty'];


// Log types
export type LogLevel = 'info' | 'warn' | 'debug' | 'error';

export type LineContext = { file: string, line: number };

export interface ConsoleListener {
  onLog<T extends LineContext>(context: LogLevel, ctx: T, args: unknown[]): void;
}