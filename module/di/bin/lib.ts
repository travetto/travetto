import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import { ApplicationParameter, ApplicationConfig } from '../src/types';

const pCwd = process.cwd().replace(/[\\\/]+/g, '/');
const cacheConfig = 'di-app-cache.json';
const fsLstat = util.promisify(fs.lstat);

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

export function maxTime(stat: fs.Stats) {
  return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
}

export function getParamType(config: ApplicationParameter) {
  return (config.meta && config.meta.choices) ? config.meta.choices.join('|') : config.type!;
}

export async function getAppList(killOnFail: boolean = true) {
  try {
    return await getCachedAppList();
  } catch (err) {
    handleFailure(err, killOnFail ? 1 : 0);
    throw err;
  }
}

export function processApplicationParam(config: ApplicationParameter, param: string) {
  if (
    (config.type === 'boolean' && !/^(true|false|1|0|yes|no|on|off)/i.test(param)) ||
    (config.type === 'number' && !/^[-]?[0-9]*[.]?[0-9]*$/.test(param)) ||
    (config.meta && config.meta.choices && !config.meta.choices.find(c => `${c}` === param))
  ) {
    throw new Error(`Invalid parameter ${config.name}: Received ${param} expected ${getParamType(config)}`);
  }
  let out: number | string | boolean = param;
  switch (config.type) {
    case 'number':
      out = param.includes('.') ? parseFloat(param) : parseInt(param, 10);
      break;
    case 'boolean':
      out = /^(true|1|yes|on)$/i.test(param);
      break;
  }
  return out;
}

export async function getAppByName(name: string) {
  return (await getAppList()).find(x => x.name === name);
}

export async function runApp(args: string[]) {
  const name = args[0];
  const [, ...sub] = args;
  const app = await getAppByName(name);

  let typedSub: (string | number | boolean)[] = sub;

  if (app) {
    const appParams = app.params || [];
    typedSub = sub.map((x, i) => appParams[i] === undefined ? x : processApplicationParam(appParams[i], x));
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
  await PhaseManager.init('bootstrap', 'compiler').run();

  const { DependencyRegistry } = await import('../src/registry');
  await DependencyRegistry.runApplication(name, typedSub);
}

/**
 * @param {string} filename
 */
export function determineAppFromFile(filename: string) {
  const [, root] = filename.split(pCwd);
  const [, first] = root.split('/');
  return first === 'src' ? '.' : first;
}

export async function computeApps() {
  // Suppress all output
  console.warn = console.debug = console.log = function () { };

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
  const res = await DependencyRegistry.getApplications();

  const items = Promise.all(res.map(async x => ({
    watchable: x.watchable,
    description: x.description,
    standalone: x.standalone,
    params: x.params,
    appRoot: determineAppFromFile(x.target.__filename),
    name: x.name,
    generatedTime: maxTime(await fsLstat(x.target.__filename)),
    filename: x.target.__filename,
    id: x.target.__id
  })));

  let resolved = await items;

  resolved = resolved.sort((a, b) => {
    return a.appRoot === b.appRoot ? a.name.localeCompare(b.name) : (a.appRoot === '' ? -1 : 1);
  });

  return resolved;
}

/**
 * Re-implement fork b/c the cli may not be installed, but this is used by the vscode plugin
 */
export function fork(cmd: string, args: string[] = []) {
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

export async function getCachedAppList(): Promise<CachedAppConfig[]> {
  const { AppCache } = await import('@travetto/boot'); // Should not init the app, only load cache
  try {
    // Read cache it
    let text: string;
    if (!AppCache.hasEntry(cacheConfig)) {
      text = await fork(path.resolve(__dirname, 'find-apps'));
      AppCache.writeEntry(cacheConfig, text);
    } else {
      text = AppCache.readEntry(cacheConfig);
    }
    const res = JSON.parse(text);

    for (const el of res) {
      const elStat = (await fsLstat(el.filename).catch(e => { delete el.generatedTime; }));
      // invalidate cache if changed
      if (elStat && (!el.generatedTime || maxTime(elStat) > el.generatedTime)) {
        AppCache.removeExpiredEntry(cacheConfig, true);
        return getCachedAppList();
      }
    }
    return res;
  } catch (e) {
    AppCache.removeExpiredEntry(cacheConfig, true);
    throw e;
  }
}

export function findApps() {
  computeApps()
    .then(resolved => require('fs').writeSync(1, `${JSON.stringify(resolved)}\n`))
    .catch(err => handleFailure(err, 1));
}