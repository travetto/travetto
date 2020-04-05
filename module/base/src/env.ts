import { EnvUtil, FsUtil } from '@travetto/boot';

const PROD_KEY = 'prod';

class $Env {

  private profileSet: Set<string>;

  readonly cwd = FsUtil.cwd;
  readonly dev: boolean;
  readonly prod: boolean;
  readonly watch: boolean;
  readonly debug: boolean | string;
  readonly trace: boolean | string;
  readonly quietInit: boolean;
  readonly profiles: string[];
  readonly appRoots: string[];

  constructor() {
    this.prod = this.computeNodeEnv().includes(PROD_KEY);
    this.dev = !this.prod;

    this.profiles = this.computeProfiles();
    this.profileSet = new Set(this.profiles);
    this.appRoots = this.computeAppRoots();

    this.watch = EnvUtil.isTrue('watch');
    this.debug = this.computeLogLevel('debug', this.dev ? '*' : '');
    this.trace = this.computeLogLevel('trace', '');
    this.quietInit = EnvUtil.isTrue('quiet_init');
  }

  private computeProfiles() {
    const nodeEnv = this.computeNodeEnv();
    const seen = new Set();
    return ['application', nodeEnv.includes(PROD_KEY) ? PROD_KEY : '', ...nodeEnv]
      .filter(x => !!x)
      .filter(x => {
        const isNew = !seen.has(x);
        seen.add(x);
        return isNew;
      });
  }

  private computeAppRoots() {
    let appRoots: string[] = [];
    if (!EnvUtil.isFalse('app_roots')) {
      appRoots.push(...EnvUtil.getList('app_roots'));

      if (appRoots.length === 0) {
        appRoots.push('.');
      }

      appRoots = appRoots
        .filter(x => !!x)
        .map(x => (!x || x === '.') ? './' : FsUtil.resolveUnix(FsUtil.cwd, x).replace(FsUtil.cwd, '.'));
    }
    return appRoots;
  }

  private computeNodeEnv() {
    const envs = ['node_env', 'env', 'profile'];
    const all = envs.reduce((acc, x) => acc.concat(EnvUtil.getList(x)), [] as string[]);
    return all.map(x => x === 'production' ? PROD_KEY : x);
  }

  toJSON() {
    return (['trace', 'debug', 'cwd', 'dev', 'prod', 'watch', 'profiles', 'appRoots'] as (keyof this)[])
      .reduce((acc, k) => {
        acc[k] = this[k];
        return acc;
      }, {} as any);
  }

  computeLogLevel(key: string, def?: string) {
    return !EnvUtil.isFalse(key) && (EnvUtil.isTrue(key) || /,(@trv:)?[*],/.test(`,${EnvUtil.get(key, def)},`) || !!EnvUtil.get(key));
  }

  hasProfile(name: string) {
    return this.profileSet.has(name);
  }

  rootMatcher(paths: string[]) {
    if (!paths.length) {
      return /^$/;
    } else {
      const finalPaths =
        paths.map(x => x.replace(/^[.]\//, '').replace(/^[.]$/g, ''));
      const re = new RegExp(`^(${finalPaths.map(x => `${x === '' ? '' : `${x}/`}`).join('|')})`);
      return re;
    }
  }
}

export const Env = new $Env();