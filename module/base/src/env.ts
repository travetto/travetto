import { EnvUtil, FsUtil } from '@travetto/boot';

const PROD_KEY = 'prod';

/**
 * General Environmental state for the application
 */
// TODO: Document
class $Env {

  private profiles: Set<string>;

  readonly env: string;
  readonly cwd: string;
  readonly prod: boolean;
  readonly watch: boolean;
  readonly debug: boolean | string;
  readonly trace: boolean | string;
  readonly quietInit: boolean;
  readonly appRoots: string[];

  constructor() {
    this.cwd = FsUtil.cwd;
    this.env = (EnvUtil.get('ENV') ?? EnvUtil.get('NODE_ENV') ?? PROD_KEY).replace(/^production$/i, PROD_KEY).toLowerCase();
    this.prod = this.env === PROD_KEY;

    this.profiles = new Set(EnvUtil.getList('PROFILE'));
    this.appRoots = this.computeAppRoots();

    this.watch = EnvUtil.isTrue('WATCH');
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
    return (['trace', 'debug', 'cwd', 'env', 'prod', 'watch', 'profiles', 'appRoots'] as (keyof this)[])
      .reduce((acc, k) => {
        acc[k] = this[k];
        return acc;
      }, {} as any);
  }

  hasProfile(name: string) {
    return this.profiles.has(name);
  }

  get colorize() {
    return (process.stdout.isTTY && !EnvUtil.isTrue('NO_COLOR')) || EnvUtil.isTrue('FORCE_COLOR');
  }
}

export const Env = new $Env();