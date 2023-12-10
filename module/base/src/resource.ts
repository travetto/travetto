import { Env } from './env';
import { FileLoader } from './file-loader';

const RES = Env.TRV_RESOURCES;

/**
 * File-based resource loader
 */
export class ResourceLoader extends FileLoader {

  static resolvePaths(paths: string[] = []): string[] {
    return FileLoader.resolvePaths([...paths, ...RES.list ?? [], '@#resources', '@@#resources']);
  }

  constructor(paths: string[] = []) {
    super(ResourceLoader.resolvePaths(paths));
  }
}

class $RuntimeResources extends FileLoader {
  #resolved: string[];
  #env: string = '__';

  get searchPaths(): string[] {
    if (this.#env !== process.env[RES.key]) {
      this.#env = process.env[RES.key]!;
      this.#resolved = ResourceLoader.resolvePaths();
    }
    return this.#resolved;
  }
}

/** Resources available at runtime */
export const RuntimeResources = new $RuntimeResources([]);