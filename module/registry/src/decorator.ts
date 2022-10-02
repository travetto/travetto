import { Class } from '@travetto/base';

import { PathUtil } from '@travetto/boot';
import { SourceUtil } from '@travetto/boot/src/internal/source-util';

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
  initMeta(cls: Class, file: string, ᚕhash: number, ᚕmethods: Record<string, { hash: number }>, ᚕabstract: boolean, ᚕsynthetic: boolean): boolean {
    const ᚕfile = PathUtil.toUnixSource(file);
    const meta = {
      ᚕid: SourceUtil.getSourceId(ᚕfile, cls.name),
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

  /**
   * Register class as pending
   */
  add(cls: Class): void {
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
  flush(): [string, Class[]][] {
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
  return (target: Class): void => PendingRegister.add(target);
}

Register.initMeta = PendingRegister.initMeta;
