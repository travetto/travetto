import { Readable } from 'stream';
import fs from 'fs/promises';

import { path, RootIndex } from '@travetto/manifest';

import { AppError } from './error';
import { GlobalEnv } from './global-env';

export type ResourceDescription = { size: number, path: string };

export interface FileResourceConfig {
  paths?: string[];
  mainFolder?: string;
  moduleFolder?: string;
  includeCommon?: boolean;
}

/**
 * Primary contract for resource handling
 */
export interface ResourceProvider {
  /**
   * Describe the resource
   * @param pth The path to resolve
   */
  describe(pth: string): Promise<ResourceDescription>;

  /**
   * Read a resource, mimicking fs.read
   * @param pth The path to read
   */
  read(pth: string, binary?: false): Promise<string>;
  read(pth: string, binary: true): Promise<Buffer>;
  read(pth: string, binary?: boolean): Promise<string | Buffer>;

  /**
   * Read a resource as a stream, mimicking fs.readStream
   * @param pth The path to read
   */
  readStream(pth: string, binary?: boolean): Promise<Readable>;
}

/**
 * Simple file-based resource provider
 */
export class FileResourceProvider implements ResourceProvider {

  static resolvePaths(cfgOrPaths: FileResourceConfig | string[]): string[] {
    const main = RootIndex.manifest.mainModule;
    const cfg = Array.isArray(cfgOrPaths) ? { paths: cfgOrPaths } : cfgOrPaths;
    const paths = cfg.paths ?? [];
    if (cfg.includeCommon) {
      paths.unshift(
        ...GlobalEnv.resourcePaths,
        path.resolve(RootIndex.manifest.workspacePath, 'resources'),
        '@#resources'
      );
    }
    const found = new Set();
    return paths.map(pth => {
      const [base, sub] = pth.replace(/^@$/, main).replace(/^@#/, `${main}#`).split('#');
      const rel = sub ?? (base !== main ? cfg.moduleFolder : undefined) ?? cfg.mainFolder;
      const value = RootIndex.hasModule(base) ?
        path.resolve(RootIndex.getModule(base)!.sourcePath, rel ?? '') :
        path.resolve(base, sub ?? cfg.mainFolder ?? '');
      if (found.has(value)) {
        return undefined;
      } else {
        found.add(value);
        return value;
      }
    }).filter((x): x is string => !!x);
  }

  #paths: string[];

  constructor(cfg: FileResourceConfig | string[]) {
    this.#paths = FileResourceProvider.resolvePaths(cfg);
  }

  async #getPath(file: string): Promise<string> {
    for (const sub of this.#paths) {
      const resolved = path.join(sub, file);
      if (await fs.stat(resolved).catch(() => false)) {
        return resolved;
      }
    }
    throw new AppError(`Unable to find: ${file}, searched=${this.#paths.join(',')}`, 'notfound');
  }

  get paths(): string[] {
    return this.#paths.slice(0);
  }

  async describe(file: string): Promise<ResourceDescription> {
    file = await this.#getPath(file);
    const stat = await fs.stat(file);
    return { size: stat.size, path: file };
  }

  async read(file: string, binary?: false): Promise<string>;
  async read(file: string, binary: true): Promise<Buffer>;
  async read(file: string, binary = false): Promise<string | Buffer> {
    file = await this.#getPath(file);
    return fs.readFile(file, binary ? undefined : 'utf8');
  }

  async readStream(file: string, binary = true): Promise<Readable> {
    file = await this.#getPath(file);
    const handle = await fs.open(file);
    return handle.createReadStream({ encoding: binary ? undefined : 'utf8' });
  }
}