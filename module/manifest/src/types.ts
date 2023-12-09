export type NodeModuleType = 'module' | 'commonjs';

export type ManifestModuleFileType = 'typings' | 'ts' | 'js' | 'json' | 'package-json' | 'unknown' | 'fixture' | 'md';
export type ManifestModuleFolderType =
  '$root' | '$index' | '$package' |
  'src' | 'bin' | 'support' | 'resources' | 'test' | 'doc' |
  'test/fixtures' | 'support/fixtures' | 'support/resources' |
  '$other' | '$transformer';

export type ManifestModuleRole = 'std' | 'test' | 'doc' | 'compile' | 'build';

export type ManifestModuleFile = [string, ManifestModuleFileType, number] | [string, ManifestModuleFileType, number, ManifestModuleRole];
export type ManifestModuleCore = {
  name: string;
  main?: boolean;
  local?: boolean;
  version: string;
  sourceFolder: string;
  outputFolder: string;
  prod: boolean;
  roles: ManifestModuleRole[];
  parents: string[];
  internal?: boolean;
};

export type ManifestModule = ManifestModuleCore & {
  files: Partial<Record<ManifestModuleFolderType, ManifestModuleFile[]>>;
};

export type ManifestContext = {
  /** Main module for manifest */
  mainModule: string;
  /** Folder, relative to workspace for main module */
  mainFolder: string;
  /** Workspace path for module */
  workspacePath: string;
  /** Code output folder, relative to workspace */
  outputFolder: string;
  /** Tooling folder, relative to workspace */
  toolFolder: string;
  /** Compiler folder, relative to workspace */
  compilerFolder: string;
  /** Is the manifest for a module in a monorepo? */
  monoRepo?: boolean;
  /** The module type of the workspace */
  moduleType: NodeModuleType;
  /** The package manager of the workspace */
  packageManager: 'yarn' | 'npm';
  /** The version of the framework being used */
  frameworkVersion: string;
  /** Description of the main module */
  description?: string;
  /** Version of the main module */
  version: string;
  /** URL for the compiler servier */
  compilerUrl: string;
};

export type ManifestRoot = ManifestContext & {
  generated: number;
  modules: Record<string, ManifestModule>;
};

export type Package = {
  name: string;
  type?: NodeModuleType;
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
    roles?: ManifestModuleRole[];
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

export type PackageVisitReq<T> = { pkg: Package, prod: boolean, sourcePath: string, parent?: T, topLevel?: boolean };
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