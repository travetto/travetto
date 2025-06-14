export type NodeModuleType = 'module' | 'commonjs';
export type NodePackageManager = 'yarn' | 'npm' | 'pnpm';
export type NodePackageRunner = 'pnpm' | 'npx';

export type ManifestModuleFileType = 'typings' | 'ts' | 'js' | 'json' | 'package-json' | 'unknown' | 'fixture' | 'md';
export type ManifestModuleFolderType =
  '$root' | '$index' | '$package' |
  'src' | 'bin' | 'support' | 'resources' | 'test' | 'doc' |
  'test/fixtures' | 'support/fixtures' | 'support/resources' |
  '$transformer';

export type ManifestModuleRole = 'std' | 'test' | 'doc' | 'compile' | 'build';