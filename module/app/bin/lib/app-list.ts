import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { FsUtil } from '@travetto/boot/src/fs';
import { ExecUtil } from '@travetto/boot/src/exec';
import { CachedAppConfig, handleFailure } from './util';

/**
 * Utilities to fetch list of applications
 */
export class AppListUtil {

  private static cacheConfig = 'app-cache.json';
  private static fsLstat = util.promisify(fs.lstat);

  /**
   * Find latest timestamp between creation and modification
   */
  static maxTime(stat: fs.Stats) {
    return Math.max(stat.ctimeMs, stat.mtimeMs); // Do not include atime
  }

  static async getByName(name: string) {
    return (await this.getList()).find(x => x.name === name);
  }

  /**
   * Determine app root form filename
   */
  static determineRootFromFile(filename: string) {
    const [, root] = filename.split(`${FsUtil.cwd}/`);
    const [first] = root.split('/');
    // If root is in node_modules or is 'src', default to local
    // * This supports apps being run from modules vs locally
    return (first === 'node_modules' || first === 'src') ? '.' : first;
  }

  /**
   * Compile code, and look for `@Application` annotations
   */
  static async discover() {
    // Initialize up to compiler
    const { PhaseManager, ScanApp } = await import('@travetto/base');
    await PhaseManager.init('compile-all');

    // Load app files
    ScanApp.findAppSourceFiles()
      .filter(x => fs.readFileSync(x.file, 'utf-8').includes('@Application'))
      .forEach(x => require(x.file)); // Only load files that are candidates

    // Load all packaged applications
    for (const { file } of ScanApp.findFiles({ folder: 'support', filter: /application[.].*[.]ts/ })) {
      try {
        require(file);
      } catch { }
    }

    // Get applications
    const { ApplicationRegistry } = await import('../../src/registry');
    const res = await ApplicationRegistry.getAll();

    // Convert each application into an `AppConfig`
    const items = Promise.all(res.map(async x => ({
      watchable: x.watchable,
      description: x.description,
      params: x.params,
      appRoot: this.determineRootFromFile(x.target.__file),
      name: x.name,
      generatedTime: this.maxTime(await this.fsLstat(x.target.__file)),
      filename: x.target.__file,
      id: x.target.__id
    })));

    let resolved = await items;

    // Sort by local first, and name second
    resolved = resolved.sort((a, b) =>
      a.appRoot === b.appRoot ?
        a.name.localeCompare(b.name) :
        (a.appRoot === '.' ? -1 : 1)
    );

    return resolved;
  }

  /**
   * Request list of applications
   */
  static async getList(): Promise<CachedAppConfig[]> {
    const { AppCache } = await import('@travetto/boot/src/app-cache'); // Should not init the app, only load cache
    try {
      // Read cache it
      let text: string;
      if (!AppCache.hasEntry(this.cacheConfig)) {
        text = (await ExecUtil.fork(path.resolve(__dirname, '..', 'find-apps'), [], {
          env: {
            DEBUG: '0',
            TRACE: '0'
          }
        }).result).stdout;
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

  /**
   * Run discover code and return as JSON
   */
  static async discoverAsJson() {
    try {
      const resolved = await this.discover();
      console.log(JSON.stringify(resolved));
    } catch (err) {
      handleFailure(err, 1);
      throw err;
    }
  }
}
