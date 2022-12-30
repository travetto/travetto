import { Env } from './env';

const PROD = 'prod';
const DEV = 'dev';
const TEST = 'test';

/**
 * The general app state, via env
 */
export const GlobalEnv = {
  /** Get environment name */
  get envName(): string {
    return Env.get('TRV_ENV', Env.get('NODE_ENV', DEV))
      .replace(/^(?:(production)|(development))$/i, (_, p) => p ? PROD : DEV)
      .toLowerCase();
  },

  /** Get debug value */
  get debug(): string | undefined { return Env.get('DEBUG'); },

  /** Are we in production mode */
  get prod(): boolean { return this.envName === PROD; },

  /** Is the app in dynamic mode? */
  get dynamic(): boolean { return Env.isTrue('TRV_DYNAMIC'); },

  /** The list of the profiles */
  get profiles(): string[] { return Env.getList('TRV_PROFILES', []); },

  /** Get list of resource paths */
  get resourcePaths(): string[] { return Env.getList('TRV_RESOURCES', []); },

  /** Get main value */
  get main(): string | undefined { return Env.get('TRV_MAIN'); },

  /** Is test */
  get test(): boolean { return this.profiles.includes('test'); },

  /** Get node version */
  get nodeVersion(): string { return process.version; },

  toJSON(): Record<string, unknown> {
    return {
      envName: this.envName, debug: this.debug, prod: this.prod, test: this.test,
      dynamic: this.dynamic, profiles: this.profiles, resourcePaths: this.resourcePaths,
      nodeVersion: this.nodeVersion
    };
  }
} as const;

export type GlobalEnvConfig = {
  set?: Record<string, string | number | boolean | undefined>;
  debug?: boolean | string;
} & Partial<Omit<typeof GlobalEnv, 'prod' | 'debug'>>;

export function defineGlobalEnv(cfg: GlobalEnvConfig = {}): void {
  const { set = {} } = cfg;
  const test = cfg.test ?? GlobalEnv.test;
  let debug = cfg.debug ?? GlobalEnv.debug;
  const env = cfg.envName ?? GlobalEnv.envName;
  const profiles = new Set([GlobalEnv.profiles, ...(cfg.profiles ?? [])]);
  if (test) {
    profiles.add(TEST);
    debug = false;
  }

  if ('main' in cfg) {
    set.TRV_MAIN = cfg.main;
  }

  for (const [k, v] of Object.entries(set)) {
    (v === undefined || v === null) ? delete process.env[k] : process.env[k] = `${v}`;
  }

  process.env.TRV_ENV = env;
  process.env.NODE_ENV = /^prod/i.test(env) ? 'production' : 'development';
  process.env.TRV_DYNAMIC = `${cfg.dynamic ?? GlobalEnv.dynamic}`;
  process.env.DEBUG = `${debug}`;
  process.env.TRV_PROFILES = [...profiles].sort().join(',');
}