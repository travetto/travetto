import { Class } from '@travetto/base';

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
    if (!this.map.has(cls.Ⲑsource)) {
      const sub: Class[] = [];
      this.map.set(cls.Ⲑsource, sub);
      this.ordered.push([cls.Ⲑsource, sub]);
    }
    this.map.get(cls.Ⲑsource)!.push(cls);
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