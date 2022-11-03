// Manifest types
export type ManifestModuleFileType = 'd.ts' | 'ts' | 'js' | 'json' | 'unknown';

export type ManifestModuleFile = [string, ManifestModuleFileType, number];

export type ManifestModule<T = Record<string, ManifestModuleFile[]>> = {
  id: string;
  name: string;
  version: string,
  source: string;
  output: string;
  profiles?: string[];
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
  peerDependenciesMeta?: Record<string, { optional?: boolean, profiles?: string[] }>;
  optionalDependencies?: Record<string, string>;
  travetto?: {
    id?: string;
    displayName?: string;
    profiles?: string[];
  },
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};