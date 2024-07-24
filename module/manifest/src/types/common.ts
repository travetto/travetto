export type NodeModuleType = 'module' | 'commonjs';
export type NodePackageManager = 'yarn' | 'npm';

export type ManifestModuleFileType = 'typings' | 'ts' | 'js' | 'json' | 'package-json' | 'unknown' | 'fixture' | 'md';
export type ManifestModuleFolderType =
  '$root' | '$index' | '$package' |
  'src' | 'bin' | 'support' | 'resources' | 'test' | 'doc' |
  'test/fixtures' | 'support/fixtures' | 'support/resources' |
  '$other' | '$transformer';

export type ManifestModuleRole = 'std' | 'test' | 'doc' | 'compile' | 'build';

export type FunctionMetadataTag = { hash: number, lines: [number, number] };
export type FunctionMetadata = FunctionMetadataTag & {
  id: string;
  import: string;
  methods?: Record<string, FunctionMetadataTag>;
  synthetic?: boolean;
  abstract?: boolean;
};