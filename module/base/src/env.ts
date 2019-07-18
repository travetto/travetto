import { FsUtil, EnvUtil } from '@travetto/boot';

const PROD_KEY = 'prod';

const PROD_ENV_MAPPING: Record<string, string> = {
  production: PROD_KEY
};

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

    this.initLogging(this.debug, this.trace);
  }

  initLogging(debug: string | boolean, trace: string | boolean) {
    const c = console as any;
    const { log, error } = c.raw || (c.raw = {
      log: c.log.bind(c),
      error: c.error.bind(c)
    });

    if (!trace) {
      console.trace = () => { };
    }

    if (!debug) {
      console.debug = () => { };
    }

    if (EnvUtil.isTrue('plain_logs')) {
      return; // Don't decorate
    }

    const logFn = EnvUtil.isFalse('log_time') ? (op: typeof log, ...args: string[]) => op(...args) :
      (trace ?
        (op: typeof log, ...args: any[]) => op(new Date().toISOString(), ...args) :
        (op: typeof log, ...args: any[]) => op(new Date().toISOString().split(/[.]/)[0], ...args));

    console.log = logFn.bind(null, log, 'info ');
    console.warn = logFn.bind(null, log, 'warn ');
    console.info = logFn.bind(null, log, 'info ');
    console.error = (...args) => {
      logFn(error, 'error', ...args.map(x => x && x.toConsole ? x.toConsole() : (x && x.stack ? x.stack : x)));
    };
    if (trace) {
      console.trace = logFn.bind(null, log, 'trace'); // Suppress trace statements
    }
    if (debug) {
      console.debug = logFn.bind(null, log, 'debug'); // Suppress debug statements
    }
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

  computeNodeEnv() {
    const envs = ['node_env', 'env', 'profile'];
    const all = envs.reduce((acc, x) => acc.concat(EnvUtil.getList(x)), [] as string[]);
    return all.map(x => PROD_ENV_MAPPING[x] || x);
  }

  computeProfiles() {
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

  computeAppRoots() {
    let appRoots: string[] = [];
    if (!EnvUtil.isFalse('APP_ROOTS')) {
      appRoots.push(...EnvUtil.getList('APP_ROOTS'));

      if (appRoots.length === 0) {
        appRoots.push('.');
      }

      appRoots = appRoots
        .filter(x => !!x)
        .map(x => (!x || x === '.') ? './' : FsUtil.resolveUnix(FsUtil.cwd, x).replace(FsUtil.cwd, '.'));
    }
    return appRoots;
  }

  hasProfile(name: string) {
    return this.profileSet.has(name);
  }

  appRootMatcher(paths: string[]) {
    if (!paths.length) {
      return /^$/;
    } else {
      const finalPaths =
        paths.map(x => x.replace(/^[.]\//, '').replace(/^[.]$/g, ''));
      const re = new RegExp(`^(${finalPaths.map(x => `${x === '' ? '' : `${x}/`}(index|src\/)`).join('|')})`);
      return re;
    }
  }
}

export const Env = new $Env();