import { PathUtil } from '../path';

import { Host } from '../host';

export type ModuleIndexEntry = { source: string, module: string, file: string };
type ScanTest = ((x: string) => boolean) | { test: (x: string) => boolean };
export type FindConfig = { folder?: string, filter?: ScanTest, includeIndex?: boolean };

type ModuleFile = [string, 'ts' | 'js' | 'json' | 'unknown' | 'typing'];
type Module = {
  name: string;
  source: string;
  output: string;
  module: boolean;
  files: {
    index: ModuleFile[];
    src: ModuleFile[];
    test: ModuleFile[];
    resources: ModuleFile[];
    bin: ModuleFile[];
    [key: string]: ModuleFile[];
  }
}

/**
 * Module index, files to be loaded at runtime
 */
class $ModuleIndex {

  #modules: Module[];

  /**
   * Get index of all source files
   */
  get #index(): Module[] {
    if (this.#modules === undefined) {
      this.#modules = require(PathUtil.resolveUnix('manifest.json'));
    }
    return this.#modules;
  }

  /**
   * Clears the app scanning cache
   */
  reset(): void {
    // @ts-expect-error
    delete this.#modules;
  }

  /**
   * Find files from the index
   * @param paths The paths to check
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  find(config: FindConfig): ModuleIndexEntry[] {
    const { filter: f, folder } = config;
    const filter = f ? 'test' in f ? f.test.bind(f) : f : f;

    if (folder === Host.PATH.src) {
      config.includeIndex = config.includeIndex ?? true;
    }
    const idx = this.#index;
    if (folder) {
      return idx.flatMap(
        m => [...m.files[folder], ...(config.includeIndex ? m.files.index : [])]
          .filter(([f, ext]) => ext === 'ts')
          .map(([f]) => ({
            source: `${m.source}/${f}`.replace(/[.]js$/, '.ts'),
            file: f,
            module: `${m.output}/${f}`.replace(/^.*node_modules\//, '')
          }))
          .filter(({ file }) => filter?.(file) ?? true)
      );
    } else {
      return idx.flatMap(
        m => [...Object.values(m.files)]
          .flat()
          .filter(([f, ext]) => ext === 'ts')
          .map(([f]) => ({
            source: `${m.source}/${f}`.replace(/[.]js$/, '.ts'),
            file: f,
            module: `${m.output}/${f}`.replace(/^.*node_modules\//, '')
          }))
          .filter(({ file }) => filter?.(file) ?? true)
      )
    }
  }
}

export const ModuleIndex = new $ModuleIndex();