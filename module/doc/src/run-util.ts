import { spawnSync } from 'child_process';

import { PathUtil, ExecUtil } from '@travetto/boot';

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
  static DOC_STATE = new DocState();

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
        cwd: config.cwd ?? process.cwd(),
        shell: '/bin/bash',
        env: {
          ...Object.fromEntries(Object.entries(process.env).filter(([a, b]) => a.startsWith('TRV') || a === 'PATH')),
          TRV_DEBUG: '0',
          ...(config.env ?? {})
        }
      }
    };
  }

  static cleanRunOutput(text: string, cfg: RunConfig) {
    text = text.trim()
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[?]?[0-9]{1,2}[a-z]/gi, '')
      .replace(new RegExp(PathUtil.cwd, 'g'), '.')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d{3})?Z?/g, this.DOC_STATE.getDate.bind(this.DOC_STATE))
      .replace(/\b[0-9a-f]{4}[0-9a-f\-]{8,40}\b/ig, this.DOC_STATE.getId.bind(this.DOC_STATE))
      .replace(/(\d+[.]\d+[.]\d+)-(alpha|rc)[.]\d+/g, (all, v) => v);
    if (cfg.filter) {
      text = text.split(/\n/g).filter(cfg.filter).join('\n');
    }
    return text;
  }

  static runBackground(cmd: string, args: string[], config: RunConfig = {}) {
    const state = this.runState(cmd, args, config);
    return ExecUtil.spawn(state.cmd, state.args, {
      ...state.opts,
      stdio: 'pipe'
    });
  }

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
    } catch (err) {
      console.log('Found!', cmd, args, '\n', err);
      final = err.message;
    }

    return this.cleanRunOutput(final, config);
  }
}