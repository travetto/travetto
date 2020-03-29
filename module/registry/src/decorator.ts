import { FsUtil } from '@travetto/boot';
import { Class } from './types';

class $PendingRegister {
  map = new Map<string, Class<any>[]>();
  ordered: [string, Class<any>[]][] = [];
  modCache = new Map<string, string>();

  initMeta(cls: Class<any>, file: string, hash: number, methods: Record<string, { hash: number }>, abstract: boolean) {
    file = FsUtil.toUnix(file.replace(/[.]js$/, '.ts'));
    if (!this.modCache.has(file)) {
      this.modCache.set(file, FsUtil.computeModule(file));
    }
    return {
      id: `${this.modCache.get(file)}#${cls.name}`,
      file,
      hash,
      methods,
      abstract,
    };
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
