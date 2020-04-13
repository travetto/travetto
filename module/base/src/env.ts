import { EnvUtil, FsUtil } from '@travetto/boot';

const PROD_KEY = 'prod';

class $Env {

  private profiles: Set<string>;

  readonly env: string;
  readonly cwd: string;
  readonly prod: boolean;
  readonly watch: boolean;
  readonly debug: boolean | string;
  readonly trace: boolean | string;
  readonly quiet: boolean;
  readonly appRoots: string[];

  constructor() {
    this.cwd = FsUtil.cwd;
    this.env = (EnvUtil.get('env') ?? EnvUtil.get('node_env') ?? PROD_KEY).replace(/^production$/i, PROD_KEY).toLowerCase();
    this.prod = this.env === PROD_KEY;

    this.profiles = new Set(EnvUtil.getList('profile'));
    this.appRoots = this.computeAppRoots();

    this.watch = EnvUtil.isTrue('watch');
    this.debug = EnvUtil.isSet('debug') ? !EnvUtil.isFalse('debug') : this.prod;
    this.trace = EnvUtil.isSet('trace') && !EnvUtil.isFalse('trace');
    this.quiet = EnvUtil.isTrue('quiet_init');
  }

  private computeAppRoots() {
    // Include root
    return [this.cwd, ...EnvUtil.getList('app_roots')]
      .filter(x => !!x)
      .map(x => FsUtil.resolveUnix(this.cwd, x).replace(this.cwd, '.'));
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
}

export const Env = new $Env();