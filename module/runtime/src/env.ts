import { type ManifestModuleRole } from '@travetto/manifest';
import { castKey, castTo } from './types';
import { type TimeSpan } from './time';

const IS_TRUE = /^(true|yes|on|1)$/i;
const IS_FALSE = /^(false|no|off|0)$/i;

type Role = Exclude<ManifestModuleRole, 'std' | 'compile'>;

export interface EnvData {
  /** 
   * The node environment we are running in
   * @default development
   */
  NODE_ENV: 'development' | 'production';
  /** 
   * Outputs all console.debug messages, defaults to `local` in dev, and `off` in prod. 
   */
  DEBUG: boolean | string;
  /** 
   * Environment to deploy, defaults to `NODE_ENV` if not `TRV_ENV` is not specified.  
   */
  TRV_ENV: string;
  /** 
   * Special role to run as, used to access additional files from the manifest during runtime.  
   */
  TRV_ROLE: Role;
  /** 
   * Whether or not to run the program in dynamic mode, allowing for real-time updates  
   */
  TRV_DYNAMIC: boolean;
  /** 
   * The folders to use for resource lookup
   */
  TRV_RESOURCES: string[];
  /** 
   * Resource path overrides
   * @private
   */
  TRV_RESOURCE_OVERRIDES: Record<string, string>;
  /** 
   * The max time to wait for shutdown to finish after initial SIGINT, 
   * @default 2s
   */
  TRV_SHUTDOWN_WAIT: TimeSpan | number;
  /**
   * The desired runtime module 
   */
  TRV_MODULE: string;
  /**
   * The location of the manifest file
   * @default undefined
   */
  TRV_MANIFEST: string;
  /**
   * trvc log level
   */
  TRV_BUILD: 'none' | 'info' | 'debug' | 'error' | 'warn',
  /**
   * Should break on first line of a method when using the @DebugBreak decorator
   * @default false
   */
  TRV_DEBUG_BREAK: boolean;
}

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
    let out: string;
    if (val === undefined || val === '' || val === null) {
      out = '';
    } else if (Array.isArray(val)) {
      out = val.join(',');
    } else if (typeof val === 'object') {
      out = Object.entries(val).map(([k, v]) => `${k}=${v}`).join(',');
    } else {
      out = `${val}`;
    }
    return { [this.key]: out };
  }

  /** Read value as string */
  get val(): string | undefined { return process.env[this.key] || undefined; }

  /** Read value as list */
  get list(): string[] | undefined {
    const val = this.val;
    return (val === undefined || val === '') ?
      undefined : val.split(/[, ]+/g).map(x => x.trim()).filter(x => !!x);
  }

  /** Read value as object */
  get object(): Record<string, string> | undefined {
    const items = this.list;
    return items ? Object.fromEntries(items.map(x => x.split(/[:=]/g))) : undefined;
  }

  /** Add values to list */
  add(...items: string[]): void {
    process.env[this.key] = [... new Set([...this.list ?? [], ...items])].join(',');
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
  [K in keyof EnvData]: Pick<EnvProp<EnvData[K]>, 'key' | 'export' | 'val' | 'set' | 'clear' | 'isSet' |
    (EnvData[K] extends unknown[] ? 'list' | 'add' : never) |
    (Extract<EnvData[K], object> extends never ? never : 'object') |
    (Extract<EnvData[K], number> extends never ? never : 'int') |
    (Extract<EnvData[K], boolean> extends never ? never : 'bool' | 'isTrue' | 'isFalse')
  >
};

function delegate<T extends object>(base: T): AllType & T {
  return new Proxy(castTo(base), {
    get(target, prop): unknown {
      return typeof prop !== 'string' ? undefined :
        (prop in base ? base[castKey(prop)] :
          target[castKey<typeof target>(prop)] ??= castTo(new EnvProp(prop))
        );
    }
  });
}

/** Basic utils for reading known environment variables */
export const Env = delegate({});