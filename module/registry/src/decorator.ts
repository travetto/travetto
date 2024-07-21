import { Class, RuntimeContext } from '@travetto/base';

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
    const src = RuntimeContext.getFunctionMetadata(cls)!.source;
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
  flush(log?: boolean): [string, Class[]][] {
    if (log) {
      console.debug('Pending changes', { changes: this.ordered.map(([, x]) => x.map(y => y.Ⲑid)) });
    }
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