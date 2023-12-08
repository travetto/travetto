import { RuntimeIndex } from '@travetto/manifest';

import { FileLoader } from './file-loader';
import { Env } from './env';

/**
 * File-based resource loader
 */
export class ResourceLoader extends FileLoader {

  static getSearchPaths(paths: string[] = []): string[] {
    return [...paths, ...Env.resourcePaths].map(x => RuntimeIndex.resolveModulePath(x));
  }

  constructor(paths: string[] = []) {
    super(ResourceLoader.getSearchPaths(paths));
  }
}