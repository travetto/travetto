import { Class } from '@travetto/base';
import { ModuleUtil } from '@travetto/boot/src/internal/module-util';

/**
 * Register a class as pending
 */
class $PendingRegister {
  map = new Map<string, Class[]>();
  ordered: [string, Class[]][] = [];

  /**
   * Initialize the meta data for the cls
   * @param cls Class
   * @param `ᚕfile` Filename
   * @param `ᚕhash` Hash of class contents
   * @param `ᚕmethods` Methods and their hashes
   * @param `ᚕabstract` Is the class abstract
   */
  initMeta(cls: Class, ᚕfile: string, ᚕhash: number, ᚕmethods: Record<string, { hash: number }>, ᚕabstract: boolean, ᚕsynthetic: boolean) {
    const meta = {
      ᚕid: ModuleUtil.getId(ᚕfile, cls.name),
      ᚕfile,
      ᚕhash,
      ᚕmethods,
      ᚕabstract,
      ᚕsynthetic,
    };

    const keys = [...Object.keys(meta)] as (keyof typeof meta)[];
    Object.defineProperties(cls, keys.reduce((all, k) => {
      all[k] = {
        value: meta[k],
        enumerable: false,
        configurable: false,
        writable: false
      };
      return all;
    }, {} as { [K in keyof typeof meta]: PropertyDescriptor }));

    return true;
  }

  /**
   * Register class as pending
   */
  add(cls: Class) {
    if (!this.map.has(cls.ᚕfile)) {
      const sub: Class[] = [];
      this.map.set(cls.ᚕfile, sub);
      this.ordered.push([cls.ᚕfile, sub]);
    }
    this.map.get(cls.ᚕfile)!.push(cls);
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
  return (target: Class) => PendingRegister.add(target);
}

Register.initMeta = PendingRegister.initMeta;
