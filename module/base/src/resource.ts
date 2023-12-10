import { Env } from './env';
import { FileLoader } from './file-loader';

const RES = Env.TRV_RESOURCES;

const searchPaths = (paths?: string[] | readonly string[]): string[] =>
  [...paths ?? [], ...RES.list ?? [], '@#resources', '@@#resources'];

/**
 * File-based resource loader
 */
export class ResourceLoader extends FileLoader {
  constructor(paths?: string[] | readonly string[]) {
    super(searchPaths(paths));
  }
}

class $RuntimeResources extends FileLoader {
  #env: string = '__';
  #paths: readonly string[];

  get searchPaths(): readonly string[] {
    if (this.#env !== RES.val) {
      this.#env = RES.val!;
      this.#paths = Object.freeze(FileLoader.resolvePaths(searchPaths()));
    }
    return this.#paths;
  }
}

/** Resources available at runtime, updates in realtime with changes to process.env.TRV_RESOURCES */
export const RuntimeResources = new $RuntimeResources([]);