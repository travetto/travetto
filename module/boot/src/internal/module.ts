import { PathUtil } from '../path';
import { EnvUtil } from '../env';

export type ModuleIndexEntry = { source: string, module: string, file: string };
type ScanTest = ((x: string) => boolean) | { test: (x: string) => boolean };
export type FindConfig = { folder?: string, filter?: ScanTest, includeIndex?: boolean };

type ModuleFileType = 'ts' | 'js' | 'json' | 'unknown' | 'typing';
type ModuleFile = ModuleIndexEntry & { type: ModuleFileType };
type Module<Sub = ModuleFile> = {
  name: string;
  source: string;
  output: string;
  module: boolean;
  files: {
    [key: string]: Sub[];
  };
};

/**
 * Module index, files to be loaded at runtime
 */
class $ModuleIndex {

  #modules: Module[];

  #resolve(...parts: string[]): string {
    return PathUtil.resolveUnix(EnvUtil.get('TRV_CACHE', PathUtil.cwd), ...parts);
  }

  #loadManifest(): Module<[string, ModuleFileType]>[] {
    const modules: Module<[string, ModuleFileType]>[] = require(this.#resolve('manifest.json'));
    return modules;
  }

  /**
   * Get index of all source files
   */
  get #index(): Module[] {
    if (this.#modules === undefined) {
      this.#modules = this.#loadManifest().map(
        m => {
          const mapping: Record<string, ModuleFile[]> = {};
          for (const folder of Object.keys(m.files)) {
            mapping[folder] = m.files[folder].map(([f, type]) => {
              const source = PathUtil.joinUnix(m.source, f);
              const fullFile = this.#resolve(m.output, f).replace(/[.]ts$/, '.js');
              const module = (m.output.startsWith('node_modules') ?
                `${m.output.split('node_modules/')[1]}/${f}` :
                `./${f}`).replace(/[.]ts$/, '.js');
              return {
                type,
                source,
                file: fullFile,
                module
              };
            });
          }
          return {
            ...m,
            files: mapping
          };
        }
      );
    }
    return this.#modules;
  }

  /**
   * Clears the app scanning cache
   */
  reset(): void {
    // @ts-expect-error
    this.#modules = undefined;
  }

  /**
   * Find files from the index
   * @param folder The sub-folder to check into
   * @param filter The filter to determine if this is a valid support file
   */
  find(config: FindConfig): ModuleIndexEntry[] {
    const { filter: f, folder } = config;
    const filter = f ? 'test' in f ? f.test.bind(f) : f : f;

    const idx = this.#index;
    const searchSpace = folder ?
      idx.flatMap(m => [...m.files[folder] ?? [], ...(config.includeIndex ? m.files.index : [])]) :
      idx.flatMap(m => [...Object.values(m.files)].flat());

    return searchSpace
      .filter(({ type }) => type === 'ts')
      .filter(({ file }) => filter?.(file) ?? true);
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findSupport(config: Omit<FindConfig, 'folder'>): ModuleIndexEntry[] {
    return this.find({ ...config, folder: 'support' });
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findSrc(config: Omit<FindConfig, 'folder'>): ModuleIndexEntry[] {
    return this.find({ ...config, folder: 'src', includeIndex: true });
  }

  findOwnSrc(): ModuleIndexEntry[] {
    return this.findSrc({
      filter: x => !x.includes('node_modules') && x.includes('src/')
    });
  }

  /**
   * Find files from the index
   * @param filter The filter to determine if this is a valid support file
   */
  findTest(config: Omit<FindConfig, 'folder'>): ModuleIndexEntry[] {
    return this.find({ ...config, folder: 'test' });
  }
}

export const ModuleIndex = new $ModuleIndex();