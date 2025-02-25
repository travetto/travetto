import { Runtime } from './context';
import { Env } from './env';
import { FileLoader } from './file-loader';

/**
 * Environment aware file loader
 */
class $RuntimeResources extends FileLoader {
  #computed: string[];
  #env: string;
  #mod: string;

  constructor() {
    super([]);
  }

  override get searchPaths(): readonly string[] {
    if (!this.#computed || this.#env !== Env.TRV_RESOURCES.val || this.#mod !== Env.TRV_MODULE.val) {
      this.#env = Env.TRV_RESOURCES.val!;
      this.#mod = Env.TRV_MODULE.val!;
      this.#computed = Runtime.resourcePaths();
    }
    return this.#computed;
  }
}

/** Runtime resources */
export const RuntimeResources = new $RuntimeResources();