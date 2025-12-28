import fs from 'node:fs/promises';
import path from 'node:path';

import { type ManifestIndex, type ManifestContext, ManifestModuleUtil } from '@travetto/manifest';

import { Env } from './env.ts';
import { RuntimeIndex } from './manifest-index.ts';
import { describeFunction } from './function.ts';
import { castTo } from './types.ts';
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

  /** Are we in development mode */
  get production(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Are we in development mode
   */
  get development(): boolean {
    return !this.production && this.env !== 'test';
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
  getSourceFile(fn: Function): string {
    return this.#idx.getFromImport(this.getImport(fn))?.sourceFile!;
  }

  /** Get import for function */
  getImport(fn: Function): string {
    return describeFunction(fn).import;
  }

  /** Import from a given path */
  async importFrom<T = unknown>(imp?: string): Promise<T> {
    const file = path.resolve(this.#idx.mainModule.sourcePath, imp!);
    if (await fs.stat(file).catch(() => false)) {
      imp = this.#idx.getFromSource(file)?.import;
    }

    if (!imp) {
      throw new Error(`Unable to find ${imp}, not in the manifest`);
    } else if (imp.endsWith('.json')) {
      imp = this.#idx.getFromImport(imp)?.sourceFile ?? imp;
      return fs.readFile(imp, 'utf8').then(JSONUtil.parseSafe<T>);
    }

    if (!ManifestModuleUtil.SOURCE_EXT_REGEX.test(imp)) {
      if (imp.startsWith('@')) {
        if (/[/].*?[/]/.test(imp)) {
          imp = `${imp}.ts`;
        }
      } else {
        imp = `${imp}.ts`;
      }
    }

    imp = ManifestModuleUtil.withOutputExtension(imp);
    const imported = await import(imp);
    if (imported?.default?.default) {
      // Unpack default.default, typescript does this in a way that requires recreating the whole object
      const def = imported?.default?.default;
      return Object.defineProperties(castTo({}), {
        ...Object.getOwnPropertyDescriptors(imported),
        default: { get: () => def, configurable: false }
      });
    }
    return imported;
  }
}

export const Runtime = new $Runtime(RuntimeIndex, Env.TRV_RESOURCE_OVERRIDES.object);