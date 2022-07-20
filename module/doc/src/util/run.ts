import { spawnSync } from 'child_process';

import { PathUtil, ExecUtil, EnvUtil } from '@travetto/boot';

export type RunConfig = {
  filter?: (line: string) => boolean;
  module?: 'base' | 'boot';
  env?: Record<string, string>;
  cwd?: string;
};

class DocState {
  baseline = new Date(`${new Date().getFullYear()}-03-14T00:00:00.000`).getTime();
  _s = 37;
  ids: Record<string, string> = {};

  rng() {
    this._s = Math.sin(this._s) * 10000;
    return this._s - Math.floor(this._s);
  }

  getDate(d: string) {
    this.baseline += this.rng() * 1000;
    return new Date(this.baseline).toISOString();
  }

  getId(id: string) {
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

  static runState(cmd: string, args: string[], config: RunConfig = {}) {
    args = [...args];
    if (cmd.endsWith('.ts')) {
      const mod = config.module ?? 'base';
      args.unshift(require.resolve(`@travetto/${mod}/bin/main`), cmd);
      cmd = process.argv0;
    }
    return {
      cmd,
      args,
      opts: {
        cwd: config.cwd ?? PathUtil.cwd,
        shell: '/bin/bash',
        env: {
          ...EnvUtil.getAll(),
          DEBUG: '',
          TRV_DEBUG: '0',
          ...(config.env ?? {})
        }
      }
    };
  }

  /**
   * Clean run output
   */
  static cleanRunOutput(text: string, cfg: RunConfig) {
    text = text.trim()
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[?]?[0-9]{1,2}[a-z]/gi, '')
      .replace(/[A-Za-z0-9_.\-\/\\]+\/travetto\/module\//g, '@trv:')
      .replace(new RegExp(PathUtil.cwd, 'g'), '.')
      .replace(/([.]trv_cache)[_A-Za-z0-9]+/g, (_, b) => b)
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
  static runBackground(cmd: string, args: string[], config: RunConfig = {}) {
    const state = this.runState(cmd, args, config);
    return ExecUtil.spawn(state.cmd, state.args, {
      ...state.opts,
      stdio: 'pipe'
    });
  }

  /**
   * Run command synchronously and return output
   */
  static run(cmd: string, args: string[], config: RunConfig = {}) {
    let final: string;
    try {
      const state = this.runState(cmd, args, config);
      const res = spawnSync(state.cmd, state.args, {
        ...state.opts,
        stdio: 'pipe' as const,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 20,
      });

      if (res.error) {
        throw res.error;
      }
      final = res.stdout.toString() || res.stderr.toString();
    } catch (err: any) {
      console.log('Found!', cmd, args, '\n', err);
      final = err.message;
    }

    return this.cleanRunOutput(final, config);
  }
}