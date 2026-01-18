import { existsSync } from 'node:fs';
import path from 'node:path';

import type { ManifestModuleRole } from './common.ts';
import type { ManifestContext } from './context.ts';

export const PackagePathSymbol = Symbol.for('@travetto/manifest:package-path');

export const PACKAGE_MANAGERS = {
  yarn: {
    lock: 'yarn.lock', type: 'yarn', otherFiles: [],
    isWorkspace: (pkg: Package & { path?: string }) => pkg.workspaces,
    isActive: (pkg: Package & { path?: string }) => existsSync(path.resolve(pkg.path!, PACKAGE_MANAGERS.yarn.lock))
  },
  npm: {
    lock: 'package-lock.json', type: 'npm', otherFiles: [],
    isWorkspace: (pkg: Package & { path?: string }) => pkg.workspaces,
    isActive: (pkg: Package & { path?: string }) => existsSync(path.resolve(pkg.path!, PACKAGE_MANAGERS.npm.lock))
  },
  pnpm: {
    lock: 'pnpm-lock.yaml', type: 'pnpm', otherFiles: ['pnpm-workspaces.yaml'],
    workspaceFile: 'pnpm-workspaces.yaml',
    isWorkspace: (pkg: Package & { path?: string }) => existsSync(path.resolve(pkg.path!, PACKAGE_MANAGERS.pnpm.workspaceFile)),
    isActive: (pkg: Package & { path?: string }) => existsSync(path.resolve(pkg.path!, PACKAGE_MANAGERS.pnpm.lock))
  },
} as const;

export type NodePackageManager = keyof typeof PACKAGE_MANAGERS;

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