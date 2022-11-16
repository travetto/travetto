export type ManifestModuleFileType = 'typings' | 'ts' | 'js' | 'json' | 'package-json' | 'unknown' | 'fixture';
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

export type ManifestModuleFolders = {
  $root?: ManifestModuleFile[];
  $index?: ManifestModuleFile[];
  $package?: ManifestModuleFile[];
  src?: ManifestModuleFile[];
  bin?: ManifestModuleFile[];
  support?: ManifestModuleFile[];
  resources?: ManifestModuleFile[];
  test?: ManifestModuleFile[];
  ['test/fixtures']?: ManifestModuleFile[];
  ['support/fixtures']?: ManifestModuleFile[];
  ['support/resources']?: ManifestModuleFile[];
  $other?: ManifestModuleFile[];
}

export type ManifestModuleFolderType = keyof ManifestModuleFolders;

export type ManifestModule = ManifestModuleCore & {
  files: ManifestModuleFolders
}

export type ManifestRoot = {
  generated: number;
  buildLocation: string;
  main: string;
  modules: Record<string, ManifestModule>;
};

export type ManifestDeltaModule = ManifestModuleCore & { files: Record<string, ManifestModuleFile> };
export type ManifestDeltaEvent = [string, 'added' | 'changed' | 'removed' | 'missing' | 'dirty'];
export type ManifestDelta = Record<string, ManifestDeltaEvent[]>;
export type ManifestState = {
  manifest: ManifestRoot;
  delta: ManifestDelta;
};

export type Package = {
  name: string;
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
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};

export type PackageDigest = Pick<Package, 'name' | 'main' | 'author' | 'license' | 'version'> & { framework: string };
