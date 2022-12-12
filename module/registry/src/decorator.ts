import { Class } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

/**
 * Register a class as pending
 */
class $PendingRegister {
  map = new Map<string, Class[]>();
  ordered: [string, Class[]][] = [];

  /**
   * Register class as pending
   */
  add(cls: Class): void {
    const src = RootIndex.getFunctionMetadata(cls)!.source;
    if (!this.map.has(src)) {
      const sub: Class[] = [];
      this.map.set(src, sub);
      this.ordered.push([src, sub]);
    }
    this.map.get(src)!.push(cls);
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
export const Register = () =>
  (target: Class): void => PendingRegister.add(target);