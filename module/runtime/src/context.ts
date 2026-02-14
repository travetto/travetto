import fs from 'node:fs/promises';
import path from 'node:path';

import { type ManifestIndex, type ManifestContext, ManifestModuleUtil } from '@travetto/manifest';

import { Env } from './env.ts';
import { RuntimeIndex } from './manifest-index.ts';
import { describeFunction } from './function.ts';
import type { Role } from './trv';
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

  /** The role we are running as */
  get role(): Role {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Env.TRV_ROLE.value as Role ?? 'std';
  }

  /** Are we in production mode */
  get production(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /** Are we in development mode */
  get localDevelopment(): boolean {
    return !this.production && this.role === 'std';
  }

  /** Get debug value */
  get debug(): false | string {
    return Env.DEBUG.isFalse ? false : (Env.DEBUG.value || false);
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
      return fs.readFile(location).then(JSONUtil.fromBinaryArray<T>);
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

  /** Get an install command for a given npm module */
  getInstallCommand(pkg: string, production = false): string {
    switch (this.workspace.manager) {
      case 'npm': return `npm install ${production ? '' : '--save-dev '}${pkg}`;
      case 'yarn': return `yarn add ${production ? '' : '--dev '}${pkg}`;
      case 'pnpm': return `pnpm add ${production ? '' : '--dev '}${pkg}`;
    }
  }
}

export const Runtime = new $Runtime(RuntimeIndex, Env.TRV_RESOURCE_OVERRIDES.object);