import { Env } from './env';

const NODE_ENV_PROD = 'production';
const NODE_ENV_DEV = 'development';
const NODE_ENV_DEV_REGEX = /^dev|development|test$/i;

const PROD = 'prod';
const DEV = 'dev';
const TEST = 'test';

const readNodeEnv = (): string => Env.get('NODE_ENV', DEV).replace(NODE_ENV_PROD, PROD).replace(NODE_ENV_DEV, DEV);
const detectNodeEnv = (val: string): string => NODE_ENV_DEV_REGEX.test(val) ? NODE_ENV_DEV : NODE_ENV_PROD;

/**
 * The general app state, via env
 */
export const GlobalEnv = {
  /** Get environment name */
  get envName(): string { return Env.get('TRV_ENV', ''); },

  /** Get debug module expression */
  get debug(): string | undefined { return Env.get('DEBUG'); },

  /** Are we in development mode */
  get devMode(): boolean { return Env.get('NODE_ENV', NODE_ENV_DEV) === NODE_ENV_DEV; },

  /** Is the app in dynamic mode? */
  get dynamic(): boolean { return Env.isTrue('TRV_DYNAMIC'); },

  /** Get list of resource paths */
  get resourcePaths(): string[] { return Env.getList('TRV_RESOURCES', []); },

  /** Is test */
  get test(): boolean { return Env.get('TRV_ENV') === 'test'; },

  /** Get node major version */
  get nodeVersion(): string { return process.version.replace('v', '').split('.')[0]; },

  /** Export as plain object */
  toJSON(): Record<string, unknown> {
    return {
      envName: this.envName || '<unset>', debug: this.debug, devMode: this.devMode, test: this.test,
      dynamic: this.dynamic, resourcePaths: this.resourcePaths, nodeVersion: this.nodeVersion
    };
  }
} as const;

export type GlobalEnvConfig = {
  set?: Record<string, string | number | boolean | undefined>;
  debug?: boolean | string;
} & Partial<Omit<typeof GlobalEnv, 'devMode' | 'debug' | 'test'>>;

export function defineGlobalEnv(cfg: GlobalEnvConfig = {}): void {
  const { set = {} } = cfg;
  const resources = [...cfg.resourcePaths ?? [], ...GlobalEnv.resourcePaths];

  const envName = (cfg.envName ?? GlobalEnv.envName) || readNodeEnv();

  Object.assign(set, {
    NODE_ENV: detectNodeEnv(envName),
    DEBUG: envName !== TEST ? (cfg.debug ?? GlobalEnv.debug ?? false) : false,
    TRV_ENV: envName,
    TRV_DYNAMIC: cfg.dynamic ?? GlobalEnv.dynamic,
    TRV_RESOURCES: resources.join(',')
  });

  for (const [k, v] of Object.entries(set)) {
    (v === undefined || v === null) ? delete process.env[k] : process.env[k] = `${v}`;
  }
}