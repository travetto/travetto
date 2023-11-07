import { createReadStream } from 'fs';
import { Readable } from 'stream';
import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';

import { AppError } from './error';
import { GlobalEnv } from './global-env';

export type ResourceDescription = { size: number, path: string };

export interface FileResourceConfig {
  paths?: string[];
  defaultPaths?: string[];
  mainFolder?: string;
  moduleFolder?: string;
  includeCommon?: boolean;
}

/**
 * File-based resource provider
 */
export class FileResourceProvider {

  static #resolveSearchPath(folder: string, mainFolder?: string, moduleFolder?: string): string {
    const main = RootIndex.manifest.mainModule;
    const [base, sub] = folder
      .replace(/^@@$/, RootIndex.manifest.workspacePath)
      .replace(/^@@#/, `${RootIndex.manifest.workspacePath}#`)
      .replace(/^@$/, main)
      .replace(/^@#/, `${main}#`)
      .split('#');
    const rel = sub ?? (base !== main ? moduleFolder : undefined) ?? mainFolder;
    return RootIndex.hasModule(base) ?
      path.resolve(RootIndex.getModule(base)!.sourcePath, rel ?? '') :
      path.resolve(base, sub ?? mainFolder ?? '');
  }

  /**
   * Resolve search paths given the input configuration
   * @param cfgOrPaths List of primary paths, or a configuration object
   */
  static resolveSearchPaths(cfgOrPaths: FileResourceConfig | string[]): string[] {
    const cfg = Array.isArray(cfgOrPaths) ? { paths: cfgOrPaths } : cfgOrPaths;
    const paths = [
      ...cfg.paths ?? [],
      ...(cfg.includeCommon ? [
        ...GlobalEnv.resourcePaths,
        '@#resources',
        '@@#resources' // Monorepo root
      ] : []),
      ...cfg.defaultPaths ?? []
    ];
    // Dedupe list
    const seen = new Set<string>();
    return paths.map(x => this.#resolveSearchPath(x, cfg.mainFolder, cfg.moduleFolder)).filter(x =>
      !seen.has(x) ? !!seen.add(x) : false
    );
  }

  #searchPaths: string[];

  constructor(cfg: FileResourceConfig | string[]) {
    this.#searchPaths = FileResourceProvider.resolveSearchPaths(cfg);
  }

  /**
   * Return the absolute path for the given relative path
   * @param relativePath The path to resolve
   */
  async resolve(relativePath: string): Promise<string> {
    for (const sub of this.#searchPaths) {
      const resolved = path.join(sub, relativePath);
      if (await fs.stat(resolved).catch(() => false)) {
        return resolved;
      }
    }
    throw new AppError(`Unable to find: ${relativePath}, searched=${this.#searchPaths.join(',')}`, 'notfound');
  }


  get searchPaths(): string[] {
    return this.#searchPaths.slice(0);
  }

  /**
   * Read a resource, mimicking fs.read
   * @param relativePath The path to read
   */
  async read(relativePath: string, binary?: false): Promise<string>;
  async read(relativePath: string, binary: true): Promise<Buffer>;
  async read(relativePath: string, binary = false): Promise<string | Buffer> {
    const file = await this.resolve(relativePath);
    return fs.readFile(file, binary ? undefined : 'utf8');
  }

  /**
   * Read a resource as a stream, mimicking fs.readStream
   * @param relativePath The path to read
   */
  async readStream(relativePath: string, binary = true): Promise<Readable> {
    const file = await this.resolve(relativePath);
    return createReadStream(file, { encoding: binary ? undefined : 'utf8' });
  }
}