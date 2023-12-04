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

  /** Read/write value as list */
  get list(): string[] | undefined {
    const val = this.val;
    return (val === undefined || val === '') ?
      undefined : val.split(/[, ]+/g).map(x => x.trim()).filter(x => !!x);
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
    (TrvEnv[K] extends unknown[] ? 'list' : never) |
    (Extract<TrvEnv[K], number> extends never ? never : 'int') |
    (Extract<TrvEnv[K], boolean> extends never ? never : 'bool' | 'isTrue' | 'isFalse') |
    (Extract<TrvEnv[K], TimeSpan> extends never ? never : 'time')
  >
};

function delegate<T extends Record<string, unknown>>(): AllType & T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return new Proxy({} as AllType & T, {
    get(target, prop): unknown {
      return typeof prop !== 'string' ? undefined :
        // @ts-expect-error
        target[prop] ??= new EnvProp(prop);
    }
  });
}

/** Basic utils for reading known environment variables */
export const Env = delegate();
