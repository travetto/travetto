import { castKey, castTo } from './types.ts';

const IS_TRUE = /^(true|yes|on|1)$/i;
const IS_FALSE = /^(false|no|off|0)$/i;

export interface EnvData { }

export class EnvProp<T> {
  readonly key: string;
  constructor(key: string) { this.key = key; }

  /** Set value according to type */
  set(value: T | undefined | null): void {
    if (value === undefined || value === null) {
      delete process.env[this.key];
    } else {
      process.env[this.key] = Array.isArray(value) ? `${value.join(',')}` : `${value}`;
    }
  }

  /** Remove value */
  clear(): void {
    this.set(null);
  }

  /** Export value */
  export(value?: T | undefined | null): Record<string, string> {
    let out: string;
    if (arguments.length === 0) { // If nothing passed in
      out = `${this.value}`;
    } else if (value === undefined || value === null) {
      out = '';
    } else if (Array.isArray(value)) {
      out = value.join(',');
    } else if (typeof value === 'object') {
      out = Object.entries(value).map(([key, keyValue]) => `${key}=${keyValue}`).join(',');
    } else {
      out = `${value}`;
    }
    return { [this.key]: out };
  }

  /** Read value as string */
  get value(): string | undefined { return process.env[this.key] || undefined; }

  /** Read value as list */
  get list(): string[] | undefined {
    const value = this.value;
    return (value === undefined || value === '') ?
      undefined : value.split(/[, ]+/g).map(item => item.trim()).filter(item => !!item);
  }

  /** Read value as object */
  get object(): Record<string, string> | undefined {
    const items = this.list;
    return items ? Object.fromEntries(items.map(item => item.split(/[:=]/g))) : undefined;
  }

  /** Add values to list */
  add(...items: string[]): void {
    process.env[this.key] = [... new Set([...this.list ?? [], ...items])].join(',');
  }

  /** Read value as int  */
  get int(): number | undefined {
    const vi = parseInt(this.value ?? '', 10);
    return Number.isNaN(vi) ? undefined : vi;
  }

  /** Read value as boolean */
  get bool(): boolean | undefined {
    const value = this.value;
    return (value === undefined || value === '') ? undefined : IS_TRUE.test(value);
  }

  /** Determine if the underlying value is truthy */
  get isTrue(): boolean {
    return IS_TRUE.test(this.value ?? '');
  }

  /** Determine if the underlying value is falsy */
  get isFalse(): boolean {
    return IS_FALSE.test(this.value ?? '');
  }

  /** Determine if the underlying value is set */
  get isSet(): boolean {
    const value = this.value;
    return value !== undefined && value !== '';
  }
}

type AllType = {
  [K in keyof EnvData]: Pick<EnvProp<EnvData[K]>, 'key' | 'export' | 'value' | 'set' | 'clear' | 'isSet' |
    (EnvData[K] extends unknown[] ? 'list' | 'add' : never) |
    (Extract<EnvData[K], object> extends never ? never : 'object') |
    (Extract<EnvData[K], number> extends never ? never : 'int') |
    (Extract<EnvData[K], boolean> extends never ? never : 'bool' | 'isTrue' | 'isFalse')
  >
};

function delegate<T extends object>(base: T): AllType & T {
  return new Proxy(castTo(base), {
    get(target, property): unknown {
      return typeof property !== 'string' ? undefined :
        (property in base ? base[castKey(property)] :
          target[castKey<typeof target>(property)] ??= castTo(new EnvProp(property))
        );
    }
  });
}

/** Basic utils for reading known environment variables */
export const Env = delegate({});