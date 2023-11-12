import { RootIndex } from '@travetto/manifest';

import { GlobalEnv } from './global-env';
import { FileLoader } from './file-loader';

/**
 * File-based resource loader
 */
export class ResourceLoader extends FileLoader {

  static getSearchPaths(paths: string[] = []): string[] {
    return [
      ...(paths ?? []).flat(),
      ...GlobalEnv.resourcePaths,
      '@#resources', // Module root
      ...(RootIndex.manifest.monoRepo ? ['@@#resources'] : []) // Monorepo root
    ].map(x => RootIndex.resolveModulePath(x));
  }

  constructor(paths: string[] = []) {
    super(ResourceLoader.getSearchPaths(paths));
  }
}