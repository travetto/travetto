import { spawnSync } from 'child_process';

import { path, RootIndex } from '@travetto/manifest';
import { ExecUtil, ExecutionOptions, ExecutionState } from '@travetto/base';
import { stripAnsiCodes } from '@travetto/terminal';

export const COMMON_DATE = new Date('2029-03-14T00:00:00.000').getTime();

export type RunConfig = {
  filter?: (line: string) => boolean;
  module?: string;
  env?: Record<string, string>;
  profiles?: string[];
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
    args = [...args];
    return {
      cmd,
      args,
      opts: {
        cwd: path.toPosix(config.cwd ?? path.cwd()),
        shell: '/bin/bash',
        env: {
          DEBUG: '0',
          TRV_MANIFEST: '',
          TRV_BUILD: 'warn',
          TRV_MODULE: config.module ?? '',
          ...(config.profiles ? { TRV_PROFILES: config.profiles.join(' ') } : {}),
          ...(config.env ?? {})
        }
      }
    };
  }

  /**
   * Clean run output
   */
  static cleanRunOutput(text: string, cfg: RunConfig): string {
    text = stripAnsiCodes(text.trim())
      .replace(new RegExp(path.cwd(), 'g'), '.')
      .replaceAll(RootIndex.manifest.workspacePath, '<workspace-root>')
      .replace(/^(.{1,4})?Compiling[.]*/, '') // Compiling message, remove
      .replace(/[A-Za-z0-9_.\-\/\\]+\/travetto\/module\//g, '@travetto/')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d{3})?Z?/g, this.#docState.getDate.bind(this.#docState))
      .replace(/\b[0-9a-f]{4}[0-9a-f\-]{8,40}\b/ig, this.#docState.getId.bind(this.#docState))
      .replace(/(\d+[.]\d+[.]\d+)-(alpha|rc)[.]\d+/g, (all, v) => v);
    if (cfg.filter) {
      text = text.split(/\n/g).filter(cfg.filter).join('\n');
    }
    return text;
  }

  /**
   * Run process in the background
   */
  static runBackground(cmd: string, args: string[], config: RunConfig = {}): ExecutionState {
    const state = this.runState(cmd, args, config);
    return ExecUtil.spawn(state.cmd, state.args, {
      ...state.opts,
      stdio: 'pipe'
    });
  }

  /**
   * Run command synchronously and return output
   */
  static run(cmd: string, args: string[], config: RunConfig = {}): string {
    let final: string;
    try {
      const state = this.runState(cmd, args, config);
      const spawnCfg = {
        ...state.opts,
        stdio: 'pipe' as const,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 20,
      } as const;

      const res = spawnSync(state.cmd, state.args, spawnCfg);

      if (res.error) {
        throw res.error;
      }
      final = stripAnsiCodes(res.stdout.toString()).trim() || stripAnsiCodes(res.stderr.toString()).trim();
    } catch (err) {
      if (err instanceof Error) {
        console.log('Found!', cmd, args, '\n', err);
        final = err.message;
      } else {
        throw err;
      }
    }

    return this.cleanRunOutput(final, config);
  }
}