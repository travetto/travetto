import type { ManifestModuleRole, NodeModuleType } from './common';
import type { ManifestContext } from './context';

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
    displayName?: string;
    roles?: ManifestModuleRole[];
    doc?: {
      output?: string[];
      root?: string;
      baseUrl?: string;
      outputs?: string[];
    };
    defaultEnv?: string;
    build?: Partial<ManifestContext['build']> & {
      isolated?: boolean;
      withModules?: Record<string, 'main' | true>;
    };
  };
  workspaces?: string[];
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};

type OrProm<T> = T | Promise<T>;

export type PackageNode<T> = {
  /** The package to visit */
  pkg: Package;
  /** Is the module intended to be viewed as a main module, compiling all top level files beyond index */
  mainLike?: boolean;
  /** The path, on disk, to the module source */
  sourcePath: string;
  /** Dependency is direct to the main module or its part of the workspace global set */
  topLevel?: boolean;
  /** Should this package go to production */
  prod: boolean;
  /** Is the package a workspace module */
  workspace?: boolean;
  /** Parent node? */
  parent?: T;
};

export type PackageVisitor<T> = {
  rootPath: string;
  init?(node: PackageNode<T>): OrProm<undefined | void | PackageNode<T>[]>;
  valid?(node: PackageNode<T>): boolean;
  create(node: PackageNode<T>): OrProm<T>;
  visit?(node: PackageNode<T>, item: T): OrProm<void>;
  complete?(values: Set<T>): OrProm<Set<T> | undefined>;
};

export type PackageWorkspaceEntry = { name: string, sourcePath: string };