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
 * File-based resource provider
 */
export class FileResourceProvider {

  static resolveSearchConfig(cfgOrPaths: FileResourceConfig | string[]): string[] {
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
    this.#paths = FileResourceProvider.resolveSearchConfig(cfg);
  }

  async #getPaths(relativePath: string, minSize = Number.MAX_SAFE_INTEGER): Promise<string[]> {
    const out: string[] = [];
    for (const sub of this.#paths) {
      const resolved = path.join(sub, relativePath);
      if (await fs.stat(resolved).catch(() => false)) {
        out.push(resolved);
        if (out.length >= minSize) {
          break;
        }
      }
    }
    if (!out.length) {
      throw new AppError(`Unable to find: ${relativePath}, searched=${this.#paths.join(',')}`, 'notfound');
    }
    return out;
  }


  get searchPaths(): string[] {
    return this.#paths.slice(0);
  }

  /**
   * Return the absolute path for the given relative path
   * @param relativePath The path to resolve
   */
  async resolve(relativePath: string): Promise<string> {
    return this.#getPaths(relativePath, 1).then(v => v[0]);
  }

  /**
   * Return all of the matching absolute paths for the given
   *  relative path, if one or more found
   * @param relativePath The path to resolve
   */
  async resolveAll(relativePath: string): Promise<string[]> {
    return this.#getPaths(relativePath);
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
    const handle = await fs.open(file);
    return handle.createReadStream({ encoding: binary ? undefined : 'utf8' });
  }
}