import { SystemUtil } from '@travetto/base/src/internal/system';
import { Class } from './types';

/**
 * Register a class as pending
 */
class $PendingRegister {
  map = new Map<string, Class<any>[]>();
  ordered: [string, Class<any>[]][] = [];

  /**
   * Initialize the meta data for the cls
   * @param cls Class
   * @param file Filename
   * @param hash Hash of class contents
   * @param methods Methods and their hashes
   * @param abstract Is the class abstract
   */
  initMeta(cls: Class<any>, file: string, hash: number, methods: Record<string, { hash: number }>, abstract: boolean) {
    const meta = {
      __id: SystemUtil.computeModuleClass(file, cls.name),
      __file: file,
      __hash: hash,
      __methods: methods,
      __abstract: abstract,
      __init: true
    };

    Object.defineProperties(cls, [...Object.keys(meta) as (keyof typeof meta)[]].reduce((all, k) => {
      all[k] = {
        value: meta[k],
        enumerable: false,
        configurable: false,
        writable: k === '__init'
      };
      return all;
    }, {} as Record<keyof typeof meta, PropertyDescriptor>));

    return true;
  }

  /**
   * Register class as pending
   */
  add(cls: Class<any>) {
    if (!this.map.has(cls.__file)) {
      const sub: Class<any>[] = [];
      this.map.set(cls.__file, sub);
      this.ordered.push([cls.__file, sub]);
    }
    this.map.get(cls.__file)!.push(cls);
  }

  /**
   * Clear pending classes
   */
  flush() {
    const out = this.ordered.slice(0);
    this.map.clear();
    this.ordered = [];
    return out;
  }
}

export const PendingRegister = new $PendingRegister();

/**
 * Decorator to track class as pending
 */
export function Register() {
  return (target: Class<any>) => PendingRegister.add(target);
}

Register.initMeta = PendingRegister.initMeta;
