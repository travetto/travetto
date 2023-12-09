/// <reference path="./_env.d.ts" />

import { TimeSpan, TimeUtil } from './time';

const IS_TRUE = /^(true|yes|on|1)$/i;
const IS_FALSE = /^(false|no|off|0)$/i;

export class EnvProp<T> {
  constructor(public readonly key: string) { }

  /** Set value according to prop type */
  set(val: T | undefined | null): void {
    if (val === undefined || val === null) {
      delete process.env[this.key];
    } else {
      process.env[this.key] = Array.isArray(val) ? `${val.join(',')}` : `${val}`;
    }
  }

  /** Remove value */
  clear(): void {
    this.set(null);
  }

  /** Export value */
  export(val: T | undefined): Record<string, string> {
    return val === undefined || val === '' ? { [this.key]: '' } : { [this.key]: Array.isArray(val) ? `${val.join(',')}` : `${val}` };
  }

  /** Read value as string */
  get val(): string | undefined { return process.env[this.key] || undefined; }

  /** Read value as list */
  get list(): string[] | undefined {
    const val = this.val;
    return (val === undefined || val === '') ?
      undefined : val.split(/[, ]+/g).map(x => x.trim()).filter(x => !!x);
  }

  /** Add values to list */
  add(...items: string[]): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.set([...new Set([...this.list ?? [], ...items])] as T);
  }

  /** Read value as int  */
  get int(): number | undefined {
    const vi = parseInt(this.val ?? '', 10);
    return Number.isNaN(vi) ? undefined : vi;
  }

  /** Read value as boolean */
  get bool(): boolean | undefined {
    const val = this.val;
    return (val === undefined || val === '') ? undefined : IS_TRUE.test(val);
  }

  /** Read value as a time value */
  get time(): number | undefined {
    return TimeUtil.resolveInput(this.val);
  }

  /** Determine if the underlying value is truthy */
  get isTrue(): boolean {
    return IS_TRUE.test(this.val ?? '');
  }

  /** Determine if the underlying value is falsy */
  get isFalse(): boolean {
    return IS_FALSE.test(this.val ?? '');
  }

  /** Determine if the underlying value is set */
  get isSet(): boolean {
    const val = this.val;
    return val !== undefined && val !== '';
  }
}

type AllType = {
  [K in keyof TrvEnv]: Pick<EnvProp<TrvEnv[K]>, 'key' | 'export' | 'val' | 'set' | 'clear' | 'isSet' |
    (TrvEnv[K] extends unknown[] ? 'list' | 'add' : never) |
    (Extract<TrvEnv[K], number> extends never ? never : 'int') |
    (Extract<TrvEnv[K], boolean> extends never ? never : 'bool' | 'isTrue' | 'isFalse') |
    (Extract<TrvEnv[K], TimeSpan> extends never ? never : 'time')
  >
};

function delegate<T extends object>(base: T): AllType & T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return new Proxy(base as AllType & T, {
    get(target, prop): unknown {
      return typeof prop !== 'string' ? undefined :
        // @ts-expect-error
        (prop in base ? base[prop] : target[prop] ??= new EnvProp(prop));
    }
  });
}

const prod = (): boolean => process.env.NODE_ENV === 'production';


/** Basic utils for reading known environment variables */
export const Env = delegate({
  /** Get name */
  get name(): string | undefined {
    return process.env.TRV_ENV || (!prod() ? 'local' : undefined);
  },

  /** Are we in development mode */
  get production(): boolean {
    return prod();
  },

  /** Is the app in dynamic mode? */
  get dynamic(): boolean {
    return IS_TRUE.test(process.env.TRV_DYNAMIC!);
  },

  /** Get debug value */
  get debug(): false | string {
    const val = process.env.DEBUG ?? '';
    return (!val && prod()) || IS_FALSE.test(val) ? false : val;
  },

  /** Get resource paths */
  get resourcePaths(): string[] {
    return [
      ...Env.TRV_RESOURCES.list ?? [],
      '@#resources', // Module root
      '@@#resources' // Monorepo root
    ];
  }
});