import { FsUtil } from '@travetto/boot';
import { SystemUtil } from '@travetto/base';
import { Class } from './types';

class $PendingRegister {
  map = new Map<string, Class<any>[]>();
  ordered: [string, Class<any>[]][] = [];

  initMeta(cls: Class<any>, file: string, hash: number, methods: Record<string, { hash: number }>, abstract: boolean) {
    file = FsUtil.toUnix(file.replace(/[.]js$/, '.ts'));
    const meta = {
      __id: SystemUtil.computeModuleClass(file, cls.name),
      __file: file,
      __hash: hash,
      __methods: methods,
      __abstract: abstract,
      __init: true
    };

    Object.defineProperties(cls, [...Object.keys(meta)].reduce((all, k) => {
      all[k] = {
        value: (meta as any)[k],
        enumerable: false,
        configurable: false,
        writable: k === '__init'
      };
      return all;
    }, {} as any));

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

export function Register() {
  return (target: Class<any>) => PendingRegister.add(target);
}

Register.initMeta = PendingRegister.initMeta.bind(PendingRegister);
