export type ManifestModuleFileType = 'typings' | 'ts' | 'js' | 'json' | 'package-json' | 'unknown' | 'fixture' | 'md';
export type ManifestModuleFolderType =
  '$root' | '$index' | '$package' |
  'src' | 'bin' | 'support' | 'resources' | 'test' | 'doc' |
  'test/fixtures' | 'support/fixtures' | 'support/resources' |
  '$other' | '$transformer';

export type ManifestFileProfile = 'compile' | 'test' | 'doc' | 'build' | 'std';
export type PackageRel = 'dev' | 'prod' | 'peer' | 'opt' | 'root' | 'global';

export type ManifestModuleFile = [string, ManifestModuleFileType, number] | [string, ManifestModuleFileType, number, ManifestFileProfile];
export type ManifestModuleCore = {
  name: string;
  main?: boolean;
  local?: boolean;
  version: string;
  sourceFolder: string;
  outputFolder: string;
  profiles: ManifestFileProfile[];
  parents: string[];
  internal?: boolean;
};

export type ManifestModule = ManifestModuleCore & {
  files: Partial<Record<ManifestModuleFolderType, ManifestModuleFile[]>>;
};

export type ManifestContext = {
  mainModule: string;
  mainFolder: string;
  workspacePath: string;
  outputFolder: string;
  toolFolder: string;
  compilerFolder: string;
  monoRepo?: boolean;
  moduleType: 'module' | 'commonjs';
  packageManager: 'yarn' | 'npm';
  frameworkVersion: string;
  description?: string;
  version: string;
  compilerUrl: string;
};

export type ManifestRoot = ManifestContext & {
  generated: number;
  modules: Record<string, ManifestModule>;
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
    isolated?: boolean;
    displayName?: string;
    profiles?: ManifestFileProfile[];
    globalModules?: string[];
    mainSource?: string[];
    docOutput?: string[];
    docRoot?: string;
    docBaseUrl?: string;
    docOutputs?: string[];
    outputFolder?: string;
    toolFolder?: string;
    compilerFolder?: string;
    compilerUrl?: string;
  };
  workspaces?: string[];
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};

type OrProm<T> = T | Promise<T>;

export type PackageVisitReq<T> = { pkg: Package, rel: PackageRel, sourcePath: string, parent?: T };
export type PackageVisitor<T> = {
  init?(req: PackageVisitReq<T>): OrProm<undefined | void | PackageVisitReq<T>[]>;
  valid?(req: PackageVisitReq<T>): boolean;
  create(req: PackageVisitReq<T>): OrProm<T>;
  visit?(req: PackageVisitReq<T>, item: T): OrProm<void>;
  complete?(values: Set<T>): OrProm<Set<T> | undefined>;
};

export type PackageWorkspaceEntry = { name: string, sourcePath: string };

export type FunctionMetadata = {
  id: string;
  source: string;
  hash?: number;
  methods?: Record<string, { hash: number }>;
  synthetic?: boolean;
  abstract?: boolean;
};