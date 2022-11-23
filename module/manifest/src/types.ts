export type ManifestModuleFileType = 'typings' | 'ts' | 'js' | 'json' | 'package-json' | 'unknown' | 'fixture';
export type ManifestModuleFolderType =
  '$root' | '$index' | '$package' |
  'src' | 'bin' | 'support' | 'resources' | 'test' |
  'test/fixtures' | 'support/fixtures' | 'support/resources' |
  '$other';

export type ManifestModuleFile = [string, ManifestModuleFileType, number];
type ManifestModuleCore = {
  id: string;
  name: string;
  main?: boolean;
  local?: boolean;
  version: string;
  source: string;
  output: string;
  profiles: string[];
};

export type ManifestModule = ManifestModuleCore & {
  files: Partial<Record<ManifestModuleFolderType, ManifestModuleFile[]>>;
};

export type ManifestRoot = {
  generated: number;
  buildLocation: string;
  main: string;
  modules: Record<string, ManifestModule>;
};

export type ManifestDeltaEventType = 'added' | 'changed' | 'removed' | 'missing' | 'dirty';
export type ManifestDeltaModule = ManifestModuleCore & { files: Record<string, ManifestModuleFile> };
export type ManifestDeltaEvent = [string, ManifestDeltaEventType];
export type ManifestDelta = Record<string, ManifestDeltaEvent[]>;
export type ManifestState = {
  manifest: ManifestRoot;
  delta: ManifestDelta;
};

export type Package = {
  name: string;
  type?: 'module' | 'commonjs';
  version: string;
  description?: string;
  license?: string;
  repository?: {
    url: string;
    directory?: string;
  };
  author?: {
    email?: string;
    name?: string;
  };
  main: string;
  homepage?: string;
  files?: string[];
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  keywords?: string[];

  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  optionalDependencies?: Record<string, string>;
  travetto?: {
    id?: string;
    displayName?: string;
    profileInherit?: boolean;
    profiles?: string[];
  };
  travettoRepo?: {
    global?: string[];
    docBranch?: string;
  };
  workspaces?: string[];
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};

export type PackageDigestField = 'name' | 'main' | 'author' | 'license' | 'version';

export type PackageDigest = Pick<Package, PackageDigestField> & { framework: string };
