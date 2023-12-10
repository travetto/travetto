import { Env } from './env';
import { FileLoader } from './file-loader';

const RES = Env.TRV_RESOURCES;
const COMMON = ['@#resources', '@@#resources'];

/**
 * File-based resource loader
 */
export class ResourceLoader extends FileLoader {
  constructor(paths?: string[] | readonly string[]) {
    super([...paths ?? [], ...RES.list ?? [], ...COMMON]);
  }
}

class $RuntimeResources extends FileLoader {
  #env: string = '__';
  #paths: readonly string[];

  get searchPaths(): readonly string[] {
    if (this.#env !== RES.val) {
      this.#env = RES.val!;
      this.#paths = Object.freeze(FileLoader.resolvePaths([...RES.list ?? [], ...COMMON]));
    }
    return this.#paths;
  }
}

/** Resources available at runtime, updates in realtime with changes to process.env.TRV_RESOURCES */
export const RuntimeResources = new $RuntimeResources([]);