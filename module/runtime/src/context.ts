import path from 'node:path';

import { type ManifestContext } from '@travetto/manifest';

import { Env } from './env';
import { RuntimeIndex } from './manifest-index';
import { describeFunction } from './function';

const prod = (): boolean => process.env.NODE_ENV === 'production';

/** Constrained version of {@type ManifestContext} */
export const Runtime = {
  /** Get env name, with support for the default env */
  get name(): string | undefined {
    return Env.TRV_ENV.val || (!prod() ? RuntimeIndex.manifest.workspace.defaultEnv : undefined);
  },

  /** Are we in development mode */
  get production(): boolean {
    return prod();
  },

  /** Is the app in dynamic mode? */
  get dynamic(): boolean {
    return Env.TRV_DYNAMIC.isTrue;
  },

  /** Get debug value */
  get debug(): false | string {
    const val = Env.DEBUG.val ?? '';
    return (!val && prod()) || Env.DEBUG.isFalse ? false : val;
  },

  /** Manifest main */
  get main(): ManifestContext['main'] {
    return RuntimeIndex.manifest.main;
  },

  /** Manifest workspace */
  get workspace(): ManifestContext['workspace'] {
    return RuntimeIndex.manifest.workspace;
  },

  /** Are we running from a mono-root? */
  get monoRoot(): boolean {
    return !!RuntimeIndex.manifest.workspace.mono && !RuntimeIndex.manifest.main.folder;
  },

  /** Main source path */
  get mainSourcePath(): string {
    return RuntimeIndex.mainModule.sourcePath;
  },

  /** Produce a workspace relative path */
  workspaceRelative(...rel: string[]): string {
    return path.resolve(RuntimeIndex.manifest.workspace.path, ...rel);
  },

  /** Strip off the workspace path from a file */
  stripWorkspacePath(full: string): string {
    return full === RuntimeIndex.manifest.workspace.path ? '' : full.replace(`${RuntimeIndex.manifest.workspace.path}/`, '');
  },

  /** Produce a workspace path for tooling, with '@' being replaced by node_module/name folder */
  toolPath(...rel: string[]): string {
    rel = rel.flatMap(x => x === '@' ? ['node_modules', RuntimeIndex.manifest.main.name] : [x]);
    return path.resolve(RuntimeIndex.manifest.workspace.path, RuntimeIndex.manifest.build.toolFolder, ...rel);
  },

  /** Resolve module paths */
  modulePaths(paths: string[]): string[] {
    const overrides = Env.TRV_RESOURCE_OVERRIDES.object ?? {};
    return [...new Set(paths.map(x => RuntimeIndex.resolveModulePath(overrides[x] ?? x)))];
  },

  /** Resolve resource paths */
  resourcePaths(paths: string[] = []): string[] {
    return this.modulePaths([...paths, ...Env.TRV_RESOURCES.list ?? [], '@#resources', '@@#resources']);
  },

  /** Get source for function */
  getSource(fn: Function): string {
    return RuntimeIndex.getFromImport(describeFunction(fn).import)?.sourceFile!;
  }
};