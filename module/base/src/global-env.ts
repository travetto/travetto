import { Env } from './env';

const readEnvName = (): string => Env.get('TRV_ENV', '') ||
  Env.get('NODE_ENV', 'development').replace(/production/i, 'prod').replace(/development/i, 'dev');

/**
 * The general app state, via env
 */
export const GlobalEnv = {
  /** Get environment name */
  get envName(): string { return Env.get('TRV_ENV', ''); },

  /** Get debug module expression */
  get debug(): string | undefined { return Env.get('DEBUG'); },

  /** Are we in development mode */
  get devMode(): boolean { return Env.get('NODE_ENV', 'development') === 'development'; },

  /** Is the app in dynamic mode? */
  get dynamic(): boolean { return Env.isTrue('TRV_DYNAMIC'); },

  /** Get list of resource paths */
  get resourcePaths(): string[] { return Env.getList('TRV_RESOURCES', []); },

  /** Is test */
  get test(): boolean { return Env.get('TRV_ENV') === 'test'; },

  /** Get node major version */
  get nodeVersion(): number { return +(process.version.replace('v', '').split('.')[0]); },

  /** Export as plain object */
  toJSON(): Record<string, unknown> {
    return {
      envName: this.envName || '<unset>', debug: this.debug, devMode: this.devMode, test: this.test,
      dynamic: this.dynamic, resourcePaths: this.resourcePaths, nodeVersion: this.nodeVersion
    };
  }
} as const;

export type EnvInit = {
  debug?: boolean | string;
  envName?: string;
  dynamic?: boolean;
};

export function defineEnv(cfg: EnvInit = {}): void {
  const envName = (cfg.envName ?? readEnvName()).toLowerCase();
  process.env.NODE_ENV = /^(dev|development|test)$/.test(envName) ? 'development' : 'production';
  process.env.DEBUG = `${envName !== 'test' && (cfg.debug ?? GlobalEnv.debug ?? false)}`;
  process.env.TRV_ENV = envName;
  process.env.TRV_DYNAMIC = `${cfg.dynamic ?? GlobalEnv.dynamic}`;
}