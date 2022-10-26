import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

import { CliCommand, CliUtil, OptionConfig } from '@travetto/cli';
import { PackageUtil } from '@travetto/base';

import { PackUtil } from './bin/util';
import { CommonConfig, PackOperation } from './bin/types';

const packName = `pack_${PackageUtil.main.name}`
  .toLowerCase()
  .replace(/[^a-z]+/g, '_')
  .replace(/_+/g, '_');

export type BaseOptions = {
  workspace: OptionConfig<string>;
};

function getConfigFromOperationOrGlobal<C extends CommonConfig, K extends string>(key: K, config: Partial<C> | Record<K, Partial<C>> | undefined): Partial<C> | undefined {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return !config ? config : (key && key in config ? (config as Record<K, C>)[key] : config) as C;
}

/**
 * Supports packing a project into a directory, ready for archiving
 */
export abstract class BasePackCommand<V extends BaseOptions, C extends CommonConfig, K extends string> extends CliCommand<V> {

  /**
   * Package stage name
   */
  abstract get operation(): PackOperation<C, K>;

  get cmdOptions(): Partial<C> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return this.cmd as Partial<C>;
  }

  get name(): string {
    return this.operation.key ? `pack:${this.operation.key}` : 'pack';
  }

  commonOptions(): BaseOptions {
    return { workspace: this.option({ desc: 'Working directory' }) } as const;
  }

  async resolveConfigs(): Promise<C> {
    const list = (await PackUtil.modeList());
    if (!this.args[0]) {
      this.showHelp('Missing config mode');
    }
    const cfg = list.find(c => c.name === this.args[0]);
    if (!cfg) {
      this.showHelp(`Unknown config mode: ${this.args[0]}`);
    }
    const def = list.find(c => c.name === 'default');

    const configs = [
      { workspace: path.resolve(os.tmpdir(), packName).__posix },
      def,
      cfg,
      this.cmdOptions,
      { active: true }
    ]
      .map(x => getConfigFromOperationOrGlobal(this.operation.key, x))
      .filter((x): x is C => x !== undefined);

    return this.operation.buildConfig(configs);
  }

  getArgs(): string {
    return '[mode]';
  }

  async help(): Promise<string> {
    const lines = await PackUtil.modeList();

    const out: string[] = [];
    if (lines.length) {
      out.push('', CliUtil.color`${{ title: 'Available Pack Modes:' }}`);
      for (const { name, file } of lines) {
        out.push(CliUtil.color`  * ${{ input: `${name}` }} [${{ path: file }}]`);
      }
      out.push('');
    }
    return out.join('\n');
  }

  override async complete(): Promise<Record<string, string[]>> {
    return { '': (await PackUtil.modeList()).map(x => x.name!) };
  }

  async action(): Promise<void> {
    const resolved = await this.resolveConfigs();
    if (await fs.stat(path.resolve(resolved.workspace, '.git').__posix).catch(() => { })) {
      throw new Error('Refusing to use workspace with a .git directory');
    }
    return PackUtil.runOperation(this.operation, resolved);
  }
}