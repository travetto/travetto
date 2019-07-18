import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { CachedAppConfig, fork, handleFailure } from './util';

export class AppListUtil {

  private static pCwd = process.cwd().replace(/[\\\/]+/g, '/');
  private static cacheConfig = '@travetto/di/app-cache.json';
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
    const { DependencyRegistry } = await import('../../src/registry');
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
      return a.appRoot === b.appRoot ? a.name.localeCompare(b.name) : (a.appRoot === '.' ? -1 : 1);
    });

    return resolved;
  }

  static async getList(): Promise<CachedAppConfig[]> {
    const { AppCache } = await import('@travetto/boot/src/app-cache'); // Should not init the app, only load cache
    try {
      // Read cache it
      let text: string;
      if (!AppCache.hasEntry(this.cacheConfig)) {
        text = await fork(path.resolve(__dirname, '..', 'find-apps'));
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
