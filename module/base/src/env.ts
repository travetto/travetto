import { EnvUtil, FsUtil } from '@travetto/boot';

const PROD_KEY = 'prod';

/**
 * General Environmental state for the application
 */
class $Env {

  private profiles: Set<string>;

  /**
   * The application env.  Generally 'prod', 'dev', or 'test'
   */
  readonly env: string;
  /**
   * The root directory for the application
   */
  readonly cwd: string;

  /**
   * If, and only if the `.env` property is equal to 'prod'
   */
  readonly prod: boolean;

  /**
   * Determines if the debug log level should be visible
   */
  readonly debug: boolean;

  /**
   * Determines if the trace log level should be visible
   */
  readonly trace: boolean;

  /**
   * Whether or not startup logging should be suppressed
   */
  readonly quietInit: boolean;

  /**
   * Additional locations for the application search paths
   */
  readonly appRoots: string[];

  constructor() {
    this.cwd = FsUtil.cwd;
    this.env = (EnvUtil.get('ENV') ?? EnvUtil.get('NODE_ENV') ?? PROD_KEY).replace(/^production$/i, PROD_KEY).toLowerCase();
    this.prod = this.env === PROD_KEY;

    this.profiles = new Set(EnvUtil.getList('PROFILE'));
    this.appRoots = this.computeAppRoots();

    this.debug = EnvUtil.isSet('DEBUG') ? !EnvUtil.isFalse('DEBUG') : !this.prod;
    this.trace = EnvUtil.isSet('TRACE') && !EnvUtil.isFalse('TRACE');
    this.quietInit = EnvUtil.isTrue('QUIET_INIT');
  }

  private computeAppRoots() {
    // Include root
    return [this.cwd, ...EnvUtil.getList('APP_ROOTS')]
      .filter(x => !!x)
      .map(x => FsUtil.resolveUnix(this.cwd, x).replace(this.cwd, '.'))
      .filter((x, i, all) => i === 0 || x !== all[i - 1]); // Dedupe
  }

  toJSON() {
    return (['trace', 'debug', 'cwd', 'env', 'prod', 'profiles', 'appRoots'] as (keyof this)[])
      .reduce((acc, k) => {
        acc[k] = this[k];
        return acc;
      }, {} as any);
  }

  /**
   * Will return true if a profile is active
   */
  hasProfile(name: string) {
    return this.profiles.has(name);
  }

  /**
   * Determine if color is supported in the terminal
   */
  get colorize() {
    return (process.stdout.isTTY && !EnvUtil.isTrue('NO_COLOR')) || EnvUtil.isTrue('FORCE_COLOR');
  }
}

export const Env = new $Env();