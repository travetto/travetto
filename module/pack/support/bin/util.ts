import { promises as fs } from 'fs';
import * as path from 'path';

// TODO: Get proper typings
const glob = require('picomatch');

import { CliUtil, FsUtil, Host, PathUtil, ScanFs } from '@travetto/boot';
import { ModuleIndex } from '@travetto/boot/src/internal/module';

import { CommonConfig, PackOperation } from './types';

/**
 * Shared packing utils
 */
export class PackUtil {

  static #modes: Partial<CommonConfig>[];

  /**
   * Build configuration object for an operation with a set of configs
   */
  static buildConfig<T extends CommonConfig>(
    op: { defaults?: Partial<T>, overrides?: Partial<T>, extend?(src: Partial<T>, dest: Partial<T>): Partial<T> },
    configs: Partial<T>[]
  ): T {
    const inputs = [
      op.defaults! ?? {},
      ...configs,
      op.overrides! ?? {}
    ].filter(x => Object.keys(x).length > 0);

    const res = inputs.reduce((out: Partial<T>, config: Partial<T>): Partial<T> => {
      const final = {
        active: config.active ?? out.active,
        workspace: config.workspace ?? out.workspace,
        preProcess: [...(config.preProcess! ?? []), ...(out.preProcess ?? [])],
        postProcess: [...(config.postProcess! ?? []), ...(out.postProcess ?? [])],
        ...op.extend?.(config, out)
      };
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return final as Partial<T>;
    }, {});
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return res as T;
  }

  /**
   * Find pack modes with associated metadata
   */
  static async modeList(): Promise<Partial<CommonConfig>[]> {
    if (!this.#modes) {
      this.#modes = await Promise.all(
        ModuleIndex.find({ folder: Host.PATH.support, filter: f => /\/pack[.].*[.]ts/.test(f) })
          .map(async (x) => {
            const req: Partial<CommonConfig> = (await import(x.file)).config;
            req.file = x.module.replace(/^node_modules\//, '');
            return req;
          })
      );
    }
    return this.#modes;
  }


  /**
   * Build file include/exclude lists/checker
   */
  static excludeChecker(files: string[], base: string): (file: string) => boolean {
    const all = files.map(x => {
      const negate = x.startsWith('!') || x.startsWith('^');
      x = negate ? x.substring(1) : x;
      x = x.replace(/^[.][/]/g, `${base}/`);
      const match: (f: string) => boolean = glob(x, { nocase: true, dot: true, basename: base, contains: true });
      Object.defineProperty(match, 'source', { value: x });
      return [match, negate] as const;
    });

    return (f: string): boolean => {
      let exclude = undefined;
      f = PathUtil.resolveUnix(base, f);
      for (const [match, n] of all) {
        if ((n || exclude === undefined) && match(f)) {
          if (n) { // Fast exit if negating
            return false;
          }
          exclude = match;
        }
      }
      return !!exclude;
    };
  }

  /**
   * Update .env.js with new env data
   */
  static async writeEnvJs(workspace: string, env: Record<string, string | undefined>): Promise<void> {
    const out = `${workspace}/.env.js`;
    let src = '';
    if (!!(await FsUtil.exists(out))) {
      src = await fs.readFile(out, 'utf8');
    }
    const lines = Object.entries(env).map(([k, v]) => v ? `process.env['${k}'] = \`${v.replace(/`/g, '\\`')}\`;` : '');
    const content = `${src}\n${lines.join('\n')}`;
    await fs.writeFile(PathUtil.resolveUnix(workspace, '.env.js'), content, { encoding: 'utf8' });
  }

  /**
   * Delete all empty folders
   */
  static async removeEmptyFolders(root: string): Promise<void> {
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
  static async runOperation<T extends CommonConfig>(op: PackOperation<T, string>, cfg: T, indent = 0): Promise<void> {
    const spacer = ' '.repeat(indent);
    const ctx = await op.context(cfg);
    const title = CliUtil.color`${{ title: op.title }} ${ctx}`;
    const width = Math.max(title.replace(/\x1b\[\d+m/g, '').length, 50); // eslint-disable-line

    let i = 0;
    function stdout(msg?: string): void {
      if (i++ > 0) {
        process.stdout.write(CliUtil.color`${spacer}${{ param: 'done' }}\n`);
      }
      if (msg) {
        process.stdout.write(CliUtil.color`${spacer}${{ output: '᳁' }} ${{ path: msg.padEnd(width - 15) }} ... `);
      }
    }

    async function runPhase(phase: 'preProcess' | 'postProcess'): Promise<void> {
      for (const el of cfg[phase] ?? []) {
        const [name, fn] = Object.entries(el)[0];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        await stdout(name as string);
        await fn(cfg);
      }
    }

    let message: string | undefined;

    process.stdout.write(`${spacer}${title}\n`);
    process.stdout.write(`${spacer}${'-'.repeat(width)}\n`);

    await runPhase('preProcess');

    for await (const msg of op.exec(cfg)) {
      if (msg.includes('Success')) { // We are done
        message = msg;
        break;
      } else {
        stdout(msg);
      }
    }

    await runPhase('postProcess');

    // Wrap up
    stdout();

    if (message !== undefined) {
      process.stdout.write(`${spacer}${'-'.repeat(width)}\n`);
      process.stdout.write(`${spacer}${message}\n`);
    }
  }
}