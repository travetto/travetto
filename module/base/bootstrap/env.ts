import { FsUtil } from './fs-util';

const PROD_KEY = 'prod';

const PROD_ENV_MAPPING: { [key: string]: string } = {
  production: PROD_KEY
};

class $Env {

  private profileSet: Set<string>;

  readonly dev: boolean;
  readonly prod: boolean;
  readonly watch: boolean;
  readonly debug: boolean | string;
  readonly trace: boolean | string;
  readonly quietInit: boolean;
  readonly cwd = FsUtil.cwd;
  readonly profiles: string[];
  readonly appRoots: string[];

  constructor() {
    this.prod = this.computeNodeEnv().includes(PROD_KEY);
    this.dev = !this.prod;

    this.profiles = this.computeProfiles();
    this.profileSet = new Set(this.profiles);
    this.appRoots = this.computeAppRoots();

    this.watch = this.isTrue('watch');
    this.debug = this.computeLogLevel('debug', this.dev ? '*' : '');
    this.trace = this.computeLogLevel('trace', '');
    this.quietInit = this.isTrue('quiet_init');

    this.initLogging();
  }

  private computeLogLevel(key: string, def?: string) {
    return !this.isFalse(key) && (this.isTrue(key) || /,(@trv:)?[*],/.test(`,${this.get(key, def)},`) || !!this.get(key));
  }

  private computeNodeEnv() {
    const envs = ['node_env', 'env', 'profile'];
    const all = envs.reduce((acc, x) => acc.concat(x), [] as string[]);
    return all.map(x => PROD_ENV_MAPPING[x] || x);
  }

  private computeProfiles() {
    const nodeEnv = this.computeNodeEnv();
    const seen = new Set();
    return ['application', this.prod ? PROD_KEY : '', ...nodeEnv]
      .filter(x => !!x)
      .filter(x => {
        const isNew = !seen.has(x);
        seen.add(x);
        return isNew;
      });
  }

  private computeAppRoots() {
    let appRoots: string[] = [];
    if (!this.isFalse('APP_ROOTS')) {
      appRoots.push(...this.getList('APP_ROOTS'));

      if (appRoots.length === 0) {
        appRoots.push('.');
      }

      appRoots = appRoots
        .filter(x => !!x)
        .map(x => (!x || x === '.') ? './' : FsUtil.resolveUnix(FsUtil.cwd, x).replace(FsUtil.cwd, '.'));
    }
    return appRoots;
  }

  private initLogging() {
    const cl = console.log.bind(console);
    const ce = console.error.bind(console);
    (console as any).raw = { log: cl, error: ce };

    const log = this.isFalse('log_time') ? (op: typeof cl, ...args: string[]) => op(...args) :
      (this.trace ?
        (op: typeof cl, ...args: any[]) => op(new Date().toISOString(), ...args) :
        (op: typeof cl, ...args: any[]) => op(new Date().toISOString().split(/[.]/)[0], ...args));

    console.log = log.bind(null, cl, 'info ');
    console.warn = log.bind(null, cl, 'warn ');
    console.info = log.bind(null, cl, 'info ');
    console.error = (...args) => {
      log(ce, 'error', ...args.map(x => x && x.toConsole ? x.toConsole() : (x && x.stack ? x.stack : x)));
    };
    console.trace = !this.trace ? () => { } : log.bind(null, cl, 'trace'); // Suppress trace statements
    console.debug = !this.debug ? () => { } : log.bind(null, cl, 'debug'); // Suppress debug statements
  }

  get(k: string, def: string): string;
  get(k: string, def?: string) {
    const temp = process.env[k] || process.env[k.toLowerCase()] || process.env[k.toUpperCase()];
    return temp === undefined ? def : temp;
  }

  getList(k: string) {
    return (this.get(k) || '').split(/[, ]+/g).filter(x => !!x);
  }

  getInt(k: string, def: number | string) {
    return parseInt(this.get(k, `${def}`) || '', 10);
  }

  isTrue(k: string) {
    const val = this.get(k);
    return val !== undefined && /^(1|true|on|yes)$/i.test(val);
  }

  isFalse(k: string) {
    const val = this.get(k);
    return val !== undefined && /^(0|false|off|no)$/i.test(val);
  }

  show() {
    if (!this.quietInit) {
      console.info('Env',
        JSON.stringify(this, (e: string, v: any) =>
          (typeof v === 'boolean' && !v) ||
            (typeof v === 'string' && v === '') ||
            (typeof v === 'function') ? undefined : v, 2
        )
      );
    }
  }

  hasProfile(name: string) {
    return this.profileSet.has(name);
  }
}

export const Env = new $Env();