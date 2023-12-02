import os from 'os';

import { path, RootIndex } from '@travetto/manifest';
import { ExecUtil, ExecutionOptions, ExecutionState } from '@travetto/base';
import { stripAnsiCodes } from '@travetto/terminal';

export const COMMON_DATE = new Date('2029-03-14T00:00:00.000').getTime();

export type RunConfig = {
  filter?: (line: string) => boolean;
  rewrite?: (text: string) => string;
  module?: string;
  env?: Record<string, string>;
  envName?: string;
  cwd?: string;
};

type RunState = {
  cmd: string;
  args: string[];
  opts: ExecutionOptions;
};

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

  static runState(cmd: string, args: string[], config: RunConfig = {}): RunState {
    const cwd = config.cwd ?? (config.module ? RootIndex.getModule(config.module)! : RootIndex.mainModule).sourcePath;
    args = [...args];
    return {
      cmd,
      args,
      opts: {
        cwd: path.toPosix(cwd),
        shell: '/bin/bash',
        env: {
          ...process.env,
          DEBUG: '0',
          TRV_CAN_RESTART: '0',
          TRV_CLI_IPC: '',
          TRV_MANIFEST: '',
          TRV_BUILD: 'none',
          TRV_ROLE: '',
          TRV_MODULE: config.module ?? '',
          ...(config.envName ? { TRV_ENV: config.envName } : {}),
          ...(config.env ?? {})
        }
      }
    };
  }

  /**
   * Clean run output
   */
  static cleanRunOutput(text: string, cfg: RunConfig): string {
    const cwd = path.toPosix((cfg.module ? RootIndex.getModule(cfg.module)! : RootIndex.mainModule).sourcePath);
    text = stripAnsiCodes(text.trim())
      .replaceAll(cwd, '.')
      .replaceAll(os.tmpdir(), '/tmp')
      .replaceAll(RootIndex.manifest.workspacePath, '<workspace-root>')
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
   * Run process in the background
   */
  static runBackground(cmd: string, args: string[], config: RunConfig = {}): ExecutionState {
    const state = this.runState(cmd, args, config);
    return ExecUtil.spawn(state.cmd, state.args, { ...state.opts, stdio: 'pipe' });
  }

  /**
   * Run command synchronously and return output
   */
  static async run(cmd: string, args: string[], config: RunConfig = {}): Promise<string> {
    let final: string;
    try {
      const state = this.runState(cmd, args, config);
      const res = await ExecUtil.spawn(state.cmd, state.args, { stdio: 'pipe', ...state.opts, catchAsResult: true }).result;
      if (!res.valid) {
        throw new Error(res.stderr);
      }
      final = stripAnsiCodes(res.stdout.toString()).trim() || stripAnsiCodes(res.stderr.toString()).trim();
    } catch (err) {
      if (err instanceof Error) {
        final = err.message;
      } else {
        throw err;
      }
    }

    return this.cleanRunOutput(final, config);
  }
}