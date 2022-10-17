import { Class } from '../types';
import { ModuleUtil } from './module-util';

/**
 * Register a class as pending
 */
export class ClassMetadataUtil {
  map = new Map<string, Class[]>();
  ordered: [string, Class[]][] = [];

  /**
   * Initialize the meta data for a function
   * @param function Function
   * @param `ᚕfile` Filename
   */
  static initFunctionMeta(fn: Function, file: string): boolean {
    fn.ᚕfile = ModuleUtil.toUnixSource(file);
    fn.ᚕfileRaw = file;
    return true;
  }

  /**
   * Initialize the meta data for the cls
   * @param cls Class
   * @param `ᚕfile` Filename
   * @param `ᚕhash` Hash of class contents
   * @param `ᚕmethods` Methods and their hashes
   * @param `ᚕabstract` Is the class abstract
   */
  static initMeta(cls: Class, file: string, ᚕhash: number, ᚕmethods: Record<string, { hash: number }>, ᚕabstract: boolean, ᚕsynthetic: boolean): boolean {
    const ᚕfile = ModuleUtil.toUnixSource(file);
    const meta = {
      ᚕid: ModuleUtil.computeId(ᚕfile, cls.name),
      ᚕfile,
      ᚕfileRaw: file,
      ᚕhash,
      ᚕmethods,
      ᚕabstract,
      ᚕsynthetic,
    };

    const keys = [...Object.keys(meta)];
    Object.defineProperties(cls, keys.reduce<Partial<Record<keyof typeof meta, PropertyDescriptor>>>((all, k) => {
      all[k] = {
        value: meta[k],
        enumerable: false,
        configurable: false,
        writable: false
      };
      return all;
    }, {}));

    return true;
  }
}