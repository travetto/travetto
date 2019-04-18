import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import { Util } from '@travetto/base';
import { ConfigSource } from '@travetto/config';

import { ApplicationParameter, ApplicationConfig } from '../src/types';

export interface CachedAppConfig extends ApplicationConfig {
  appRoot: string;
  generatedTime: number;
}

export function handleFailure(err?: Error, exitCode?: number) {
  console.error(err && err.toConsole ? err : (err && err.stack ? err.stack : err));
  if (exitCode) {
    process.exit(exitCode);
  }
}

/**
 * Re-implement fork b/c the cli may not be installed, but this is used by the vscode plugin
 */
function fork(cmd: string, args: string[] = []) {
  return new Promise<string>((resolve, reject) => {
    const text: Buffer[] = [];
    const err: Buffer[] = [];
    const proc = child_process.spawn(process.argv0, [cmd, ...args], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      shell: false
    });
    proc.stdout!.on('data', v => text.push(v));
    proc.stderr!.on('data', v => err.push(v));
    proc.on('exit', v => {
      if (v === 0) {
        resolve(Buffer.concat(text).toString());
      } else {
        reject(Buffer.concat(err).toString());
      }
    });
  });
}

export class AppListUtil {

  private static pCwd = process.cwd().replace(/[\\\/]+/g, '/');
  private static cacheConfig = 'di-app-cache.json';
  private static fsLstat = util.promisify(fs.lstat);

  static maxTime(stat: fs.Stats) {
    return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
  }

  static async getByName(name: string) {
    return (await this.getList()).find(x => x.name === name);
  }

  static determineRootFromFile(filename: string) {
    const [, root] = filename.split(this.pCwd);
    const [, first] = root.split('/');
    return (first === 'node_modules' || first === 'src') ? '.' : first;
  }

  static async discover() {
    // Initialize up to compiler
    const { PhaseManager, ScanApp } = await import('@travetto/base');
    await PhaseManager.init('bootstrap', 'compiler').run();

    // Load app files
    ScanApp.requireFiles('.ts', x => {
      return /^([^/]+\/)?(src[\/])/.test(x) && x.endsWith('.ts') && !x.endsWith('d.ts') &&
        fs.readFileSync(x).toString().includes('@Application');
    }); // Only load files that are candidates

    // Get applications
    const { DependencyRegistry } = await import('../src/registry');
    DependencyRegistry.loadApplicationsFromConfig();
    const res = await DependencyRegistry.getApplications();

    const items = Promise.all(res.map(async x => ({
      watchable: x.watchable,
      description: x.description,
      standalone: x.standalone,
      params: x.params,
      appRoot: this.determineRootFromFile(x.target.__filename),
      name: x.name,
      generatedTime: this.maxTime(await this.fsLstat(x.target.__filename)),
      filename: x.target.__filename,
      id: x.target.__id
    })));

    let resolved = await items;

    resolved = resolved.sort((a, b) => {
      return a.appRoot === b.appRoot ? a.name.localeCompare(b.name) : (a.appRoot === '' ? -1 : 1);
    });

    return resolved;
  }

  static async getList(): Promise<CachedAppConfig[]> {
    const { AppCache } = await import('@travetto/boot/src/app-cache'); // Should not init the app, only load cache
    try {
      // Read cache it
      let text: string;
      if (!AppCache.hasEntry(this.cacheConfig)) {
        text = await fork(path.resolve(__dirname, 'find-apps'));
        AppCache.writeEntry(this.cacheConfig, text);
      } else {
        text = AppCache.readEntry(this.cacheConfig);
      }
      const res = JSON.parse(text);

      for (const el of res) {
        const elStat = (await this.fsLstat(el.filename).catch(e => { delete el.generatedTime; }));
        // invalidate cache if changed
        if (elStat && (!el.generatedTime || this.maxTime(elStat) > el.generatedTime)) {
          AppCache.removeExpiredEntry(this.cacheConfig, true);
          return this.getList();
        }
      }
      return res;
    } catch (e) {
      AppCache.removeExpiredEntry(this.cacheConfig, true);
      throw e;
    }
  }

  static async discoverAsJson() {
    try {
      const resolved = await this.discover();
      (console as any).raw.log(JSON.stringify(resolved));
    } catch (err) {
      handleFailure(err, 1);
      throw err;
    }
  }
}

export class RunUtil {

  static getParamType(config: ApplicationParameter) {
    return (config.meta && config.meta.choices) ? config.meta.choices.join('|') : config.type!;
  }

  static enforceParamType(config: ApplicationParameter, param: string) {
    if (
      (config.type === 'boolean' && !/^(true|false|1|0|yes|no|on|off)/i.test(param)) ||
      (config.type === 'number' && !/^[-]?[0-9]*[.]?[0-9]*$/.test(param)) ||
      (config.meta && config.meta.choices && !config.meta.choices.find(c => `${c}` === param))
    ) {
      throw new Error(`Invalid parameter ${config.name}: Received ${param} expected ${this.getParamType(config)}`);
    }
    let out: number | string | boolean = param;
    switch (config.type) {
      case 'number': out = Util.coerceType(param, 0); break;
      case 'boolean': out = Util.coerceType(param, false); break;
    }
    return out;
  }

  static async run(args: string[]) {
    const name = args[0];
    const [, ...sub] = args;
    const app = await AppListUtil.getByName(name);

    let typedSub: (string | number | boolean)[] = sub;

    if (app) {
      const appParams = app.params || [];
      typedSub = sub.map((x, i) => appParams[i] === undefined ? x : this.enforceParamType(appParams[i], x));
      const reqCount = appParams.filter(x => !x.optional).length;
      if (typedSub.length < reqCount) {
        throw new Error(`Invalid parameter count: received ${typedSub.length} but needed ${reqCount}`);
      }

      process.env.APP_ROOTS = [
        process.env.APP_ROOTS || app.appRoot || '',
        !app.standalone && app.appRoot ? '.' : ''
      ].join(',');
      process.env.ENV = process.env.ENV || 'dev';
      process.env.PROFILE = process.env.PROFILE || '';
      process.env.WATCH = process.env.WATCH || `${app.watchable}`;
    }

    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.init('bootstrap').run();

    const { DependencyRegistry } = await import('../src/registry');
    await DependencyRegistry.runApplication(name, typedSub);
  }

  static async runDirect() {
    try {
      return this.run(process.argv.slice(2));
    } catch (err) {  // If loaded directly as main entry, run, idx 2 is where non-node arguments start at
      handleFailure(err, 1);
      throw err;
    }
  }
}

export const getAppList = AppListUtil.getList.bind(AppListUtil);