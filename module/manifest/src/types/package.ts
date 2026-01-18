import { existsSync } from 'node:fs';
import path from 'node:path';

import type { ManifestModuleRole } from './common.ts';
import type { ManifestContext } from './context.ts';

export const PackagePathSymbol = Symbol.for('@travetto/manifest:package-path');

export type PackageManager<K extends string = string> = {
  lock: string;
  type: K;
  workspaceFile?: string;
  importantFiles: string[];
  isWorkspace: (pkg: Package & { path?: string }) => boolean;
  isActive: (pkg: Package & { path?: string }) => boolean;
  install: (pkg: string, production?: boolean) => string;
  workspaceInit: () => string;
  installAll: () => string;
  updateDependenciesToLatest: () => string;
  execPackage: (pkg: string, args?: string[]) => string;
  listWorkspace: () => string;
  remoteInfo: (pkg: string, version: string) => string;
  setVersion: (level: string, preid?: string) => string;
  dryRunPack: () => string;
  publish: (version: string) => string;
};

export const PACKAGE_MANAGERS: Record<'npm' | 'yarn' | 'pnpm', PackageManager> = {
  yarn: {
    lock: 'yarn.lock', type: 'yarn',
    isWorkspace: (pkg: Package & { path?: string }) => !!pkg.workspaces,
    isActive: (pkg: Package & { path?: string }) => existsSync(path.resolve(pkg.path!, PACKAGE_MANAGERS.yarn.lock)),
    install: (pkg: string, production?: boolean) => `yarn add ${production ? '' : '--dev '}${pkg}`,
    workspaceInit: () => 'yarn init -y',
    installAll: () => 'yarn',
    updateDependenciesToLatest: () => 'yarn upgrade --latest',
    execPackage: (pkg: string, args: string[] = []) => `npx ${[pkg, ...args].join(' ').trim()}`,
    listWorkspace: () => 'npm query .workspace',
    remoteInfo: (pkg: string, version: string) => `yarn info ${pkg}@${version} --json`,
    setVersion: (level: string, preid?: string) => `yarn version --no-workspaces-update' ${level} ${preid ? `--preid ${preid}` : ''}`,
    dryRunPack: () => 'yarn pack --dry-run',
    publish: (version: string) => `yarn publish --tag ${version} --access public`,
    get importantFiles(): string[] { return [PACKAGE_MANAGERS.yarn.lock]; }
  },
  npm: {
    lock: 'package-lock.json', type: 'npm',
    isWorkspace: (pkg: Package & { path?: string }) => !!pkg.workspaces,
    isActive: (pkg: Package & { path?: string }) => existsSync(path.resolve(pkg.path!, PACKAGE_MANAGERS.npm.lock)),
    install: (pkg: string, production?: boolean) => `npm install ${production ? '' : '--save-dev '}${pkg}`,
    workspaceInit: () => 'npm init -f',
    installAll: () => 'npm install',
    updateDependenciesToLatest: () => 'npm update --save',
    execPackage: (pkg: string, args: string[] = []) => `npx ${[pkg, ...args].join(' ').trim()}`,
    listWorkspace: () => 'npm query .workspace',
    remoteInfo: (pkg: string, version: string) => `npm info ${pkg}@${version} --json`,
    setVersion: (level: string, preid?: string) => `npm version --no-workspaces-update' ${level} ${preid ? `--preid ${preid}` : ''}`,
    dryRunPack: () => 'npm pack --dry-run',
    publish: (version: string) => `npm publish --tag ${version} --access public`,
    get importantFiles(): string[] { return [PACKAGE_MANAGERS.npm.lock]; }
  },
  pnpm: {
    lock: 'pnpm-lock.yaml', type: 'pnpm', workspaceFile: 'pnpm-workspaces.yaml',
    isWorkspace: (pkg: Package & { path?: string }) => existsSync(path.resolve(pkg.path!, PACKAGE_MANAGERS.pnpm.workspaceFile!)),
    isActive: (pkg: Package & { path?: string }) => existsSync(path.resolve(pkg.path!, PACKAGE_MANAGERS.pnpm.lock)),
    install: (pkg: string, production?: boolean) => `pnpm add ${production ? '' : '--save-dev '}${pkg}`,
    workspaceInit: () => 'pnpm init -f',
    installAll: () => 'pnpm install',
    updateDependenciesToLatest: () => 'pnpm update --latest',
    execPackage: (pkg: string, args: string[] = []) => `pnpm ${[pkg, ...args].join(' ').trim()}`,
    listWorkspace: () => 'pnpm ls -r --depth -1 --json',
    remoteInfo: (pkg: string, version: string) => `pnpm info ${pkg}@${version} --json`,
    setVersion: (level: string, preid?: string) => `pnpm version --no-workspaces-update' ${level} ${preid ? `--preid ${preid}` : ''}`,
    dryRunPack: () => 'pnpm pack --dry-run',
    publish: (version: string) => `pnpm publish --tag ${version} --access public`,
    get importantFiles(): string[] { return [PACKAGE_MANAGERS.pnpm.lock, PACKAGE_MANAGERS.pnpm.workspaceFile!]; }
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