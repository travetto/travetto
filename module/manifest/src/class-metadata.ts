import { RootIndex } from './root-index';

/**
 * Register class metadata
 */
export class ClassMetadataUtil {

  static #writeMeta(fn: Function, cfg: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(cfg)) {
      Object.defineProperty(fn, `Ⲑ${key}`, {
        value,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
    return true;
  }

  /**
   * Initialize the meta data for a function
   * @param function Function
   * @param `file` Filename
   */
  static initFunctionMeta(fn: Function, file: string): boolean {
    const source = RootIndex.getSourceFile(file);
    return this.#writeMeta(fn, { source });
  }

  /**
   * Initialize the meta data for the cls
   * @param cls Class
   * @param `file` Filename
   * @param `hash` Hash of class contents
   * @param `methods` Methods and their hashes
   * @param `abstract` Is the class abstract
   */
  static initMeta(cls: Function, file: string, hash: number, methods: Record<string, { hash: number }>, abstract: boolean, synthetic: boolean): boolean {
    const source = RootIndex.getSourceFile(file);
    const id = RootIndex.getId(source, cls.name);
    const meta = { id, hash, methods, abstract, synthetic };
    return this.#writeMeta(cls, { id, source, meta });
  }
}