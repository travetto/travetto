import { promises as fs } from 'fs';
import * as path from 'path';

// TODO: Get proper typings
const glob = require('picomatch');

import { FsUtil, PathUtil, ScanFs } from '@travetto/boot';
import { SourceIndex } from '@travetto/boot/src/internal/source';
import { color } from '@travetto/cli/src/color';

import { CommonConfig, PackOperation } from './types';

/**
 * Shared packing utils
 */
export class PackUtil {

  static #defaultConfigs: Partial<CommonConfig>[];
  static #modes: Partial<CommonConfig>[];

  static commonExtend<T extends CommonConfig>(a: T, b: Partial<T>): T {
    return {
      active: b.active ?? a.active,
      workspace: b.workspace ?? a.workspace,
      preProcess: [...(b.preProcess ?? []), ...(a.preProcess ?? [])],
      postProcess: [...(b.postProcess ?? []), ...(a.postProcess ?? [])],
    } as T;
  }

  /**
   * Find pack modes with associated metadata
   */
  static async modeList() {
    if (!this.#modes) {
      this.#modes = await Promise.all(
        SourceIndex.find({ folder: 'support', filter: f => /\/pack[.].*[.]ts/.test(f) })
          .map(async (x) => {
            const req = (await import(x.file)).config as Partial<CommonConfig>;
            req.file = x.module.replace(/^node_modules\//, '');
            return req;
          })
      );
    }
    return this.#modes;
  }

  /**
   * Get Config
   */
  static async getConfigs(): Promise<Partial<CommonConfig>[]> {
    if (!this.#defaultConfigs) {
      const allModes = await this.modeList();
      const mode = allModes.find(x => process.argv.find(a => a === x.name))!;
      this.#defaultConfigs = [allModes.find(x => x.name === 'default')!, mode!];
    }
    return this.#defaultConfigs;
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
      f = PathUtil.resolveUnix(base, f);
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
    await fs.writeFile(PathUtil.resolveUnix(workspace, '.env.js'), content, { encoding: 'utf8' });
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
    const spacer = ' '.repeat(indent);
    const ctx = await op.context(cfg);
    const title = color`${{ title: op.title }} ${ctx}`;
    const width = title.replace(/\x1b\[\d+m/g, '').length; // eslint-disable-line

    let i = 0;
    function stdout(msg?: string) {
      if (i++ > 0) {
        process.stdout.write(color`${spacer}${{ param: 'done' }}\n`);
      }
      if (msg) {
        process.stdout.write(color`${spacer}${{ output: '᳁' }} ${{ path: msg.padEnd(width - 15) }} ... `);
      }
    }

    async function runPhase(phase: 'preProcess' | 'postProcess') {
      for (const el of cfg[phase] ?? []) {
        const [name, fn] = Object.entries(el)[0];
        await stdout(name);
        await fn(cfg);
      }
    }

    let message: string | undefined;

    process.stdout.write(`${spacer}${title}\n`);
    process.stdout.write(`${spacer}${'-'.repeat(width)}\n`);

    runPhase('preProcess');

    for await (const msg of op.exec(cfg)) {
      if (msg.includes('Success')) { // We are done
        message = msg;
        break;
      } else {
        stdout(msg);
      }
    }

    runPhase('postProcess');

    // Wrap up
    stdout();

    if (message !== undefined) {
      process.stdout.write(`${spacer}${'-'.repeat(width)}\n`);
      process.stdout.write(`${spacer}${message}\n`);
    }
  }
}