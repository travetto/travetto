import type { ManifestModuleRole, NodeModuleType } from './common';
import type { ManifestContext } from './context';

export const PackagePath = Symbol.for('@travetto/manifest:package-path');

export type Package = {
  [PackagePath]: string;
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

export type PackageDepType = 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies';

export type PackageWorkspaceEntry = { name: string, path: string };