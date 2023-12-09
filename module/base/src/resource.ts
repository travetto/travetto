import { Env } from './env';
import { FileLoader } from './file-loader';

/**
 * File-based resource loader
 */
export class ResourceLoader extends FileLoader {
  constructor(paths: string[] = []) {
    super([...paths, ...Env.resourcePaths]);
  }
}