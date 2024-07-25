import { Runtime } from './context';
import { Env } from './env';
import { FileLoader } from './file-loader';

/**
 * Environment aware file loader
 */
class $RuntimeResources extends FileLoader {
  #computed: string[];
  #env: string;

  constructor() {
    super(Runtime.resourcePaths());
  }

  override get searchPaths(): readonly string[] {
    if (this.#env !== Env.TRV_RESOURCES.val) {
      this.#env = Env.TRV_RESOURCES.val!;
      this.#computed = Runtime.resourcePaths();
    }
    return this.#computed ?? super.searchPaths;
  }
}

/** Runtime resources */
export const RuntimeResources = new $RuntimeResources();