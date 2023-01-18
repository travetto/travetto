import os from 'os';

import { path, RootIndex } from '@travetto/manifest';
import { CliCommand, CliScmUtil, cliTpl, OptionConfig } from '@travetto/cli';

import { PackUtil } from './bin/util';
import { CommonConfig, PackOperation } from './bin/types';

const packName = `pack_${RootIndex.mainPackage.name}`
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

  async resolveConfigs(cfg: Partial<CommonConfig>, def?: Partial<CommonConfig>): Promise<C> {
    const configs = [
      { workspace: path.resolve(os.tmpdir(), packName) },
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
      out.push('', cliTpl`${{ title: 'Available Pack Modes:' }}`);
      for (const { name, file } of lines) {
        out.push(cliTpl`  * ${{ input: `${name}` }} [${{ path: file }}]`);
      }
      out.push('');
    }
    return out.join('\n');
  }

  async action(): Promise<void> {
    if (!this.args[0]) {
      return this.showHelp('Missing config mode');
    }

    const list = (await PackUtil.modeList());
    const cfg = list.find(c => c.name === this.args[0]);
    if (!cfg) {
      return this.showHelp(`Unknown config mode: ${this.args[0]}`);
    }

    const def = list.find(c => c.name === 'default');

    const resolved = await this.resolveConfigs(cfg, def);
    if (await CliScmUtil.isRepoRoot(resolved.workspace)) {
      throw new Error('Refusing to use workspace with a .git directory');
    }
    return PackUtil.runOperation(this.operation, resolved);
  }
}