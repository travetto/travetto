import { Env } from './env';
import { FileLoader } from './file-loader';

class $RuntimeResources extends FileLoader {
  #env: string;
  override get searchPaths(): readonly string[] {
    if (this.#env !== Env.TRV_RESOURCES.val) {
      this.#env = Env.TRV_RESOURCES.val!;
      this.computePaths(Env.resourcePaths);
    }
    return super.searchPaths;
  }
}

export const RuntimeResources = new $RuntimeResources(Env.resourcePaths);