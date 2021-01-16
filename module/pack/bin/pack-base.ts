import * as os from 'os';
import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';
import { FsUtil } from '@travetto/boot';

import { PackUtil } from './lib/util';
import { CommonConfig, PackOperation } from './lib/types';

/**
 * Supports packing a project into a directory, ready for archiving
 */
export abstract class BasePackPlugin<C extends CommonConfig> extends BasePlugin {

  /**
   * Package stage name
   */
  abstract get operation(): PackOperation<C>;

  get name() {
    return this.operation.key ? `pack:${this.operation.key}` : 'pack';
  }

  async resolveConfigs(extra: Partial<C> | Record<string, C> = {}): Promise<C> {
    const out: C = [...(await PackUtil.getConfigs()), extra]
      .map(x => this.operation.key && this.operation.key in x ? ((x as Record<string, C>)[this.operation.key] as C) : x as C)
      .reduce((acc, l) => this.operation.extend(acc, l ?? {}), {} as C);
    out.workspace = out.workspace ?? FsUtil.resolveUnix(os.tmpdir(),
      `pack_${require(FsUtil.resolveUnix('package.json')).name}`
        .toLowerCase()
        .replace(/[^a-z]+/g, '_')
        .replace(/_+/, '_')
    );
    out.active = true;
    return out;
  }

  async init(cmd: commander.Command) {
    const flags = await this.resolveConfigs();

    cmd = cmd.arguments('[mode]');
    for (const [f, d, fn, prop] of this.operation.flags) {
      cmd = fn ? cmd.option<unknown>(f, d, fn, flags[prop]) : cmd.option(f, d, flags[prop] as unknown as string);
    }
    return cmd;
  }

  async help() {
    const lines = await PackUtil.modeList();

    const out = [];
    if (lines.length) {
      out.push('', color`${{ title: 'Available Pack Modes:' }}`);
      for (const { key, file } of lines) {
        out.push(color`  * ${{ input: `${key}` }} [${{ path: file }}]`);
      }
      out.push('');
    }
    return out.join('\n');
  }

  async complete() {
    return { '': (await PackUtil.modeList()).map(x => x.key) };
  }

  async action() {
    const resolved = await this.resolveConfigs(this.operation.key ? { [this.operation.key]: this._cmd.opts() } : this._cmd.opts());
    return PackUtil.runOperation(this.operation, resolved as C);
  }
}