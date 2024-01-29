export type NodeModuleType = 'module' | 'commonjs';
export type NodePackageManager = 'yarn' | 'npm';

export type ManifestModuleFileType = 'typings' | 'ts' | 'js' | 'json' | 'package-json' | 'unknown' | 'fixture' | 'md';
export type ManifestModuleFolderType =
  '$root' | '$index' | '$package' |
  'src' | 'bin' | 'support' | 'resources' | 'test' | 'doc' |
  'test/fixtures' | 'support/fixtures' | 'support/resources' |
  '$other' | '$transformer';

export type ManifestModuleRole = 'std' | 'test' | 'doc' | 'compile' | 'build';

export type FunctionMetadata = {
  id: string;
  source: string;
  hash?: number;
  methods?: Record<string, { hash: number }>;
  synthetic?: boolean;
  abstract?: boolean;
};