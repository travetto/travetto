import { Runtime } from './context.ts';
import { Env } from './env.ts';
import { FileLoader } from './file-loader.ts';

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
    if (!this.#computed || this.#env !== Env.TRV_RESOURCES.value || this.#mod !== Env.TRV_MODULE.value) {
      this.#env = Env.TRV_RESOURCES.value!;
      this.#mod = Env.TRV_MODULE.value!;
      this.#computed = Runtime.resourcePaths();
    }
    return this.#computed;
  }
}

/** Runtime resources */
export const RuntimeResources = new $RuntimeResources();