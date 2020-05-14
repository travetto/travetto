import { FsUtil } from '@travetto/boot';
import { SystemUtil } from '@travetto/base/src/internal/system';
import { Class } from './types';

// TODO: Document
class $PendingRegister {
  map = new Map<string, Class<any>[]>();
  ordered: [string, Class<any>[]][] = [];

  initMeta(cls: Class<any>, file: string, hash: number, methods: Record<string, { hash: number }>, abstract: boolean) {
    file = FsUtil.toUnix(FsUtil.toTS(file));
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

  add(cls: Class<any>) {
    if (!this.map.has(cls.__file)) {
      const sub: Class<any>[] = [];
      this.map.set(cls.__file, sub);
      this.ordered.push([cls.__file, sub]);
    }
    this.map.get(cls.__file)!.push(cls);
  }

  flush() {
    const out = this.ordered.slice(0);
    this.map.clear();
    this.ordered = [];
    return out;
  }
}

export const PendingRegister = new $PendingRegister();

// TODO: Document
export function Register() {
  return (target: Class<any>) => PendingRegister.add(target);
}

Register.initMeta = PendingRegister.initMeta.bind(PendingRegister);
