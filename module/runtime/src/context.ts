import path from 'node:path';

import type { ManifestIndex, ManifestContext } from '@travetto/manifest';

import { Env } from './env';
import { RuntimeIndex } from './manifest-index';
import { describeFunction } from './function';

/** Constrained version of {@type ManifestContext} */
class $Runtime {

  #idx: ManifestIndex;
  #resourceOverrides?: Record<string, string>;

  constructor(idx: ManifestIndex, resourceOverrides?: Record<string, string>) {
    this.#idx = idx;
    this.#resourceOverrides = resourceOverrides;
  }

  get #moduleAliases(): Record<string, string> {
    return {
      '@': this.#idx.mainModule.sourcePath,
      '@@': this.#idx.manifest.workspace.path,
    };
  }

  /** Get env name, with support for the default env */
  get envName(): string | undefined {
    return Env.TRV_ENV.val || (!this.production ? this.#idx.manifest.workspace.defaultEnv : undefined);
  }

  /** Are we in development mode */
  get production(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /** Is the app in dynamic mode? */
  get dynamic(): boolean {
    return Env.TRV_DYNAMIC.isTrue;
  }

  /** Get debug value */
  get debug(): false | string {
    const val = Env.DEBUG.val ?? '';
    return (!val && this.production) || Env.DEBUG.isFalse ? false : val;
  }

  /** Manifest main */
  get main(): ManifestContext['main'] {
    return this.#idx.manifest.main;
  }

  /** Manifest workspace */
  get workspace(): ManifestContext['workspace'] {
    return this.#idx.manifest.workspace;
  }

  /** Are we running from a mono-root? */
  get monoRoot(): boolean {
    return !!this.workspace.mono && !this.main.folder;
  }

  /** Main source path */
  get mainSourcePath(): string {
    return this.#idx.mainModule.sourcePath;
  }

  /** Produce a workspace relative path */
  workspaceRelative(...rel: string[]): string {
    return path.resolve(this.workspace.path, ...rel);
  }

  /** Strip off the workspace path from a file */
  stripWorkspacePath(full: string): string {
    return full === this.workspace.path ? '' : full.replace(`${this.workspace.path}/`, '');
  }

  /** Produce a workspace path for tooling, with '@' being replaced by node_module/name folder */
  toolPath(...rel: string[]): string {
    rel = rel.flatMap(x => x === '@' ? ['node_modules', this.#idx.manifest.main.name] : [x]);
    return path.resolve(this.workspace.path, this.#idx.manifest.build.toolFolder, ...rel);
  }

  /** Resolve single module path */
  modulePath(modulePath: string): string {
    const [base, sub] = (this.#resourceOverrides?.[modulePath] ?? modulePath)
      .replace(/^([^#]*)(#|$)/g, (_, v, r) => `${this.#moduleAliases[v] ?? v}${r}`)
      .split('#');
    return path.resolve(this.#idx.getModule(base)?.sourcePath ?? base, sub ?? '.');
  }

  /** Resolve resource paths */
  resourcePaths(paths: string[] = []): string[] {
    return [...paths, ...Env.TRV_RESOURCES.list ?? [], '@#resources', '@@#resources'].map(v => this.modulePath(v));
  }

  /** Get source for function */
  getSourceFile(fn: Function): string {
    return this.#idx.getFromImport(this.getImport(fn))?.sourceFile!;
  }

  /** Get import for function */
  getImport(fn: Function): string {
    return describeFunction(fn).import;
  }

  /** Import from import path */
  import<T = unknown>(imp: string): Promise<T> {
    imp = imp.endsWith('.ts') ? imp.replace(/[.]ts$/, '') : imp;
    imp = !imp.endsWith('.js') ? `${imp}.js` : imp;
    return import(imp);
  }
}

export const Runtime = new $Runtime(RuntimeIndex, Env.TRV_RESOURCE_OVERRIDES.object);