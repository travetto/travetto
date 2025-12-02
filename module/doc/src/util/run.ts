import os from 'node:os';
import util from 'node:util';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';

import { Env, ExecUtil, Runtime, RuntimeIndex } from '@travetto/runtime';
import { RunConfig } from './types.ts';

export const COMMON_DATE = new Date('2029-03-14T00:00:00.000').getTime();

class DocState {
  baseline = COMMON_DATE;
  _s = 37;
  ids: Record<string, string> = {};

  rng(): number {
    this._s = Math.sin(this._s) * 10000;
    return this._s - Math.floor(this._s);
  }

  getDate(d: string): string {
    this.baseline += this.rng() * 1000;
    return new Date(this.baseline).toISOString();
  }

  getId(id: string): string {
    if (!this.ids[id]) {
      this.ids[id] = ' '.repeat(id.length).split('').map(x => Math.trunc(this.rng() * 16).toString(16)).join('');
    }
    return this.ids[id];
  }
}

/**
 * Utils for running commands within a doc
 */
export class DocRunUtil {
  static #docState = new DocState();

  /** Build cwd from config */
  static cwd(cfg: RunConfig): string {
    return path.resolve(cfg.module ? RuntimeIndex.getModule(cfg.module)?.sourcePath! : Runtime.mainSourcePath);
  }

  /**
   * Clean run output
   */
  static cleanRunOutput(text: string, cfg: RunConfig): string {
    const cwd = this.cwd(cfg);
    text = util.stripVTControlCharacters(text.trim())
      .replaceAll(cwd, '.')
      .replaceAll(os.tmpdir(), '/tmp')
      .replaceAll(Runtime.workspace.path, '<workspace-root>')
      .replace(/[/]tmp[/][a-z_A-Z0-9\/\-]+/g, '/tmp/<temp-folder>')
      .replace(/^(\s*framework:\s*')(\d+[.]\d+)[^']*('[,]?\s*)$/gm, (_, pre, ver, post) => `${pre}${ver}.x${post}`)
      .replace(/^(\s*nodeVersion:\s*'v)(\d+)[^']*('[,]?\s*)$/gm, (_, pre, ver, post) => `${pre}${ver}.x.x${post}`)
      .replace(/^(.{1,4})?Compiling[.]*/, '') // Compiling message, remove
      .replace(/[A-Za-z0-9_.\-\/\\]+\/travetto\/module\//g, '@travetto/')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d{3})?Z?/g, this.#docState.getDate.bind(this.#docState))
      .replace(/\b[0-9a-f]{4}[0-9a-f\-]{8,40}\b/ig, this.#docState.getId.bind(this.#docState))
      .replace(/(\d+[.]\d+[.]\d+)-(alpha|rc)[.]\d+/g, (all, v) => v);
    if (cfg.filter) {
      text = text.split(/\n/g).filter(cfg.filter).join('\n');
    }
    if (cfg.rewrite) {
      text = cfg.rewrite(text);
    }
    return text;
  }

  /**
   * Spawn command with appropriate environment, and cwd
   */
  static spawn(cmd: string, args: string[], config: RunConfig = {}): ChildProcess {
    return spawn(cmd, args, {
      cwd: config.cwd ?? this.cwd(config),
      env: {
        ...process.env,
        ...Env.DEBUG.export(false),
        ...Env.TRV_CAN_RESTART.export(false),
        ...Env.TRV_CLI_IPC.export(undefined),
        ...Env.TRV_MANIFEST.export(''),
        ...Env.TRV_BUILD.export('none'),
        ...Env.TRV_ROLE.export(undefined),
        ...Env.TRV_MODULE.export(config.module ?? ''),
        ...(config.envName ? Env.TRV_ENV.export(config.envName) : {}),
        ...config.env
      }
    });
  }

  /**
   * Run command synchronously and return output
   */
  static async run(cmd: string, args: string[], config: RunConfig = {}): Promise<string> {
    let final: string;
    try {
      const proc = this.spawn(cmd, args, config);
      const result = await ExecUtil.getResult(proc, { catch: true });
      if (!result.valid) {
        throw new Error(result.stderr);
      }
      final = util.stripVTControlCharacters(result.stdout).trim() || util.stripVTControlCharacters(result.stderr).trim();
    } catch (error) {
      if (error instanceof Error) {
        final = error.message;
      } else {
        throw error;
      }
    }

    return this.cleanRunOutput(final, config);
  }
}