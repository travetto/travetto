import fs from 'node:fs/promises';
import path from 'node:path';

import { type ManifestIndex, type ManifestContext, ManifestModuleUtil } from '@travetto/manifest';

import { Env } from './env.ts';
import { RuntimeIndex } from './manifest-index.ts';
import { describeFunction } from './function.ts';
import { JSONUtil } from './json.ts';

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
  get env(): string | undefined {
    return Env.TRV_ENV.value || (!this.production ? this.#idx.manifest.workspace.defaultEnv : undefined);
  }

  /** Are we in production mode */
  get production(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /** Get environment type mode */
  get envType(): 'production' | 'development' | 'test' {
    switch (process.env.NODE_ENV) {
      case 'production': return 'production';
      case 'test': return 'test';
      default: return 'development';
    }
  }

  /** Get debug value */
  get debug(): false | string {
    const value = Env.DEBUG.value ?? '';
    return (!value && this.production) || Env.DEBUG.isFalse ? false : value;
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

  /** Get trv entrypoint */
  get trvEntryPoint(): string {
    return this.workspaceRelative('node_modules', '.bin', 'trv');
  }

  /** Produce a workspace relative path */
  workspaceRelative(...parts: string[]): string {
    return path.resolve(this.workspace.path, ...parts);
  }

  /** Strip off the workspace path from a file */
  stripWorkspacePath(full: string): string {
    return full === this.workspace.path ? '' : full.replace(`${this.workspace.path}/`, '');
  }

  /** Produce a workspace path for tooling, with '@' being replaced by node_module/name folder */
  toolPath(...parts: string[]): string {
    parts = parts.flatMap(part => part === '@' ? ['node_modules', this.#idx.manifest.main.name] : [part]);
    return path.resolve(this.workspace.path, this.#idx.manifest.build.toolFolder, ...parts);
  }

  /** Resolve single module path */
  modulePath(modulePath: string, overrides?: Record<string, string>): string {
    const combined = { ...this.#resourceOverrides, ...overrides };
    const [base, sub] = (combined[modulePath] ?? modulePath)
      .replace(/^([^#]*)(#|$)/g, (_, module, relativePath) => `${this.#moduleAliases[module] ?? module}${relativePath}`)
      .split('#');
    return path.resolve(this.#idx.getModule(base)?.sourcePath ?? base, sub ?? '.');
  }

  /** Resolve resource paths */
  resourcePaths(paths: string[] = []): string[] {
    return [...new Set([...paths, ...Env.TRV_RESOURCES.list ?? [], '@#resources', '@@#resources'].map(module => this.modulePath(module)))];
  }

  /** Get source for function */
  getSourceFile(handle: Function): string {
    return this.#idx.getFromImport(this.getImport(handle))?.sourceFile!;
  }

  /** Get import for function */
  getImport(handle: Function): string {
    return describeFunction(handle).import;
  }

  /** Import from a given path */
  async importFrom<T = unknown>(location?: string): Promise<T> {
    const file = path.resolve(this.#idx.mainModule.sourcePath, location!);
    if (await fs.stat(file).catch(() => false)) {
      location = this.#idx.getFromSource(file)?.import;
    }

    if (!location) {
      throw new Error(`Unable to find ${location}, not in the manifest`);
    } else if (location.endsWith('.json')) {
      location = this.#idx.getFromImport(location)?.sourceFile ?? location;
      return fs.readFile(location, 'utf8').then(JSONUtil.parseSafe<T>);
    }

    if (!ManifestModuleUtil.SOURCE_EXT_REGEX.test(location)) {
      if (location.startsWith('@')) {
        if (/[/].*?[/]/.test(location)) {
          location = `${location}.ts`;
        }
      } else {
        location = `${location}.ts`;
      }
    }

    location = ManifestModuleUtil.withOutputExtension(location);
    const imported = await import(location);
    return imported;
  }
}

export const Runtime = new $Runtime(RuntimeIndex, Env.TRV_RESOURCE_OVERRIDES.object);