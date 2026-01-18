import type { ManifestModuleRole } from './common.ts';
import type { ManifestContext } from './context.ts';

export const PackagePathSymbol = Symbol.for('@travetto/manifest:package-path');

const ALL_PACKAGE_MANAGERS = [
  { lock: 'package-lock.json', type: 'npm', title: 'Npm', workspaceFile: undefined, active: true },
  { lock: 'yarn.lock', type: 'yarn', title: 'Yarn', workspaceFile: undefined, active: true },
  { lock: 'pnpm-lock.yaml', type: 'pnpm', workspaceFile: 'pnpm-workspace.yaml', title: 'Pnpm', active: false }
] as const;

export type NodePackageManager = (typeof ALL_PACKAGE_MANAGERS)[number]['type'];

export const PACKAGE_MANAGERS = ALL_PACKAGE_MANAGERS.filter(manager => manager.active);

export type Package = {
  [PackagePathSymbol]?: string;
  name: string;
  type?: string;
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
    workspaceInclude?: boolean;
    build?: Partial<ManifestContext['build']> & {
      isolated?: boolean;
      includes?: Record<string, 'main' | true>;
      watchIgnores?: string[];
      typesFolder?: string;
      binaryDependencies?: string[];
    };
  };
  workspaces?: string[];
  private?: boolean;
  publishConfig?: { access?: 'restricted' | 'public' };
};

export type PackageDependencyType = 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies';

export type PackageWorkspaceEntry = { name: string, path: string };