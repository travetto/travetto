import * as os from 'os';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';
import { PathUtil, Package, FsUtil } from '@travetto/boot';

import { PackUtil } from './lib/util';
import { CommonConfig, PackOperation } from './lib/types';

const packName = `pack_${Package.name}`
  .toLowerCase()
  .replace(/[^a-z]+/g, '_')
  .replace(/_+/g, '_');

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

  defaultOptions() {
    return { workspace: this.option({ desc: 'Working directory' }) } as const;
  }

  async resolveConfigs(): Promise<C> {
    const extra = this.operation.key ? { [this.operation.key]: this.cmd } : this.cmd;
    const list = (await PackUtil.modeList());
    if (!this.args[0]) {
      this.showHelp('Missing config mode');
    }
    const cfg = list.find(c => c.name === this.args[0]);
    if (!cfg) {
      this.showHelp(`Unknown config mode: ${this.args[0]}`);
    }
    const def = list.find(c => c.name === 'default');
    const out: C = [def, cfg, extra]
      .map(x => this.operation.key && this.operation.key in (x ?? {}) ? ((x as Record<string, C>)[this.operation.key] as C) : x as C)
      .reduce((acc, l) => this.operation.extend(acc, l ?? {}), (this.operation.overrides ?? {}) as C);
    out.workspace ??= PathUtil.resolveUnix(os.tmpdir(), packName);
    out.active = true;
    return out;
  }

  getArgs() {
    return '[mode]';
  }

  async help() {
    const lines = await PackUtil.modeList();

    const out = [];
    if (lines.length) {
      out.push('', color`${{ title: 'Available Pack Modes:' }}`);
      for (const { name, file } of lines) {
        out.push(color`  * ${{ input: `${name}` }} [${{ path: file }}]`);
      }
      out.push('');
    }
    return out.join('\n');
  }

  override async complete() {
    return { '': (await PackUtil.modeList()).map(x => x.name!) };
  }

  async action() {
    const resolved = await this.resolveConfigs();
    if (await FsUtil.exists(PathUtil.resolveUnix(resolved.workspace, '.git'))) {
      throw new Error('Refusing to use workspace with a .git directory');
    }
    return PackUtil.runOperation(this.operation, resolved as C);
  }
}