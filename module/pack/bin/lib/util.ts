import { promises as fs } from 'fs';
import * as util from 'util';
import * as path from 'path';

const glob = require('picomatch');

import { FsUtil, ScanFs, SourceIndex } from '@travetto/boot';
import { color } from '@travetto/cli/src/color';

import { CommonConfig, PackOperation } from './types';

/**
 * Shared packing utils
 */
export class PackUtil {

  private static _defaultConfigs: Partial<CommonConfig>[];
  private static _modes: Partial<CommonConfig>[];

  /**
   * Find pack modes with associated metadata
   */
  static async modeList() {
    if (!this._modes) {
      this._modes = SourceIndex.find({ folder: 'support', filter: f => /\/pack[.].*[.]ts/.test(f) })
        .map(x => {
          const req = require(x.file).config as Partial<CommonConfig>;
          req.file = x.file;
          return req;
        });
    }
    return this._modes;
  }

  /**
   * Get Config
   */
  static async getConfigs(): Promise<Partial<CommonConfig>[]> {
    if (!this._defaultConfigs) {
      const allModes = await this.modeList();
      const mode = allModes.find(x => process.argv.find(a => a === x.name))!;
      this._defaultConfigs = [allModes.find(x => x.name === 'default')!, mode!];
    }
    return this._defaultConfigs;
  }

  /**
   * Build file include/exclude lists/checker
   */
  static excludeChecker(files: string[], base: string) {
    const all = files.map(x => {
      const negate = x.startsWith('!') || x.startsWith('^');
      x = negate ? x.substring(1) : x;
      x = x.replace(/^[.][/]/g, `${base}/`);
      const re = glob(x, { nocase: true, dot: true, basename: base, contains: true });
      Object.defineProperty(re, 'source', { value: x });
      return [re, negate] as const;
    });

    return (f: string) => {
      let exclude = undefined;
      f = FsUtil.resolveUnix(base, f);
      for (const [p, n] of all) {
        if ((n || exclude === undefined) && p(f)) {
          if (n) { // Fast exit if negating
            return false;
          }
          exclude = p;
        }
      }
      return exclude;
    };
  }

  /**
   * Update .env.js with new env data
   */
  static async writeEnvJs(workspace: string, env: Record<string, string | undefined>) {
    const out = `${workspace}/.env.js`;
    let src = '';
    if (!!(await FsUtil.exists(out))) {
      src = await fs.readFile(out, 'utf8');
    }
    const lines = Object.entries(env).filter(([, v]) => !!v).map(([k, v]) => `process.env['${k}'] = ${v};`);
    const content = `${src}\n${lines.join('\n')}`;
    await fs.writeFile(FsUtil.resolveUnix(workspace, '.env.js'), content, { encoding: 'utf8' });
  }

  /**
   * Delete all empty folders
   */
  static async removeEmptyFolders(root: string) {
    for (const el of await ScanFs.scanDir({ testDir: x => true, testFile: x => false, withHidden: true }, root)) {
      let dir = el.file;
      while ((await fs.readdir(dir)).length === 0) { // empty
        await fs.rmdir(dir);
        dir = path.dirname(dir);
      }
    }
  }

  /**
   * Run operation with logging
   */
  static async runOperation<T extends CommonConfig>(op: PackOperation<T>, cfg: T, indent = 0) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const spacer = ' '.repeat(indent);
    const flags = Object.fromEntries(op.flags.map(([, , , f]) => [f, cfg[f]]).filter(x => x[0] !== 'workspace'));
    const ctx = op.context ? (await op.context(cfg)) : util.inspect(flags, false, undefined, true).replace(/\{/g, '[').replace(/}/g, ']');
    const title = color`${{ title: op.title }} ${ctx}`;
    const width = title.replace(/\x1b\[\d+m/g, '').length; // eslint-disable-line

    console.log();
    console.log(`${spacer}${title}`);
    console.log(`${spacer}${'-'.repeat(width)}`);

    let i = 0;
    for await (const msg of op.exec(cfg)) {
      if (i++ > 0) {
        process.stdout.write(color`${spacer}${{ param: 'done' }}\n`);
      }
      if (msg.includes('Success')) {
        console.log(`${spacer}${'-'.repeat(width)}`);
        console.log(`${spacer}${msg}`);
      } else if (msg) {
        process.stdout.write(color`${spacer}${{ output: '᳁' }} ${{ path: msg.padEnd(width - 15) }} ... `);
      } else {
        process.stdout.write('\n');
      }
    }
    console.log();
  }
}