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

export type ManifestDelta = Record<string, ManifestDeltaEvent[]>;

export type SourceMap = {
  sourceRoot: string;
  sources: string[];
};

export type ManifestState = {
  manifest: Manifest;
  delta: ManifestDelta;
};