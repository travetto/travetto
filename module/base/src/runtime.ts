import { Env } from './env';

const isProd = (): boolean => Env.get('NODE_ENV') === 'production';
const NODE_VERSION = parseInt(process.version.replace('v', '').split('.')[0], 10);

/**
 * The general app state, via env
 */
export const Runtime = {
  /** Get Node version */
  get nodeVersion(): number { return NODE_VERSION; },

  /** Get environment name */
  get env(): string { return Env.get('TRV_ENV', isProd() ? 'prod' : 'dev'); },

  /** Get Resource paths used for ResourceLoader */
  get resourcePaths(): string[] { return Env.getList('TRV_RESOURCES', []); },

  /** Get debug module expression */
  get debug(): string | undefined {
    return Env.isFalse('DEBUG') ? undefined : Env.get('DEBUG', isProd() ? undefined : '@');
  },

  /** Are we in development mode */
  get production(): boolean { return isProd(); },

  /** Is the app in dynamic mode? */
  get dynamic(): boolean { return Env.isTrue('TRV_DYNAMIC'); },
} as const;