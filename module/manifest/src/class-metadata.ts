import { RootIndex } from './root-index';

/**
 * Register class metadata
 */
export class ClassMetadataUtil {

  /**
   * Initialize the meta data for a function
   * @param function Function
   * @param `file` Filename
   */
  static initFunctionMeta(fn: Function, file: string): boolean {
    const source = RootIndex.getSourceFile(file);
    const id = RootIndex.getId(source, fn.name);
    RootIndex.setClassMetadata(id, { id, source });
    Object.defineProperty(fn, 'Ⲑid', { value: id });
    return true;
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
    RootIndex.setClassMetadata(id, { id, source, hash, methods, abstract, synthetic });
    Object.defineProperty(cls, 'Ⲑid', { value: id });
    return true;
  }
}