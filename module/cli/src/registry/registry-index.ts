import { Class, Runtime, RuntimeIndex } from '@travetto/runtime';
import { ChangeEvent, ClassOrId, RegistryAdapter, RegistryIndex, RegistryV2 } from '@travetto/registry';

import { CliCommandConfig, CliCommandShape } from '../types.ts';
import { CliUnknownCommandError } from '../error.ts';
import { CliCommandRegistryAdapter } from './registry-adapter.ts';

const CLI_FILE_REGEX = /\/cli[.](?<name>.{0,100}?)([.]tsx?)?$/;
const getName = (s: string): string => (s.match(CLI_FILE_REGEX)?.groups?.name ?? s).replaceAll('_', ':');

export class CliCommandRegistryIndex implements RegistryIndex<CliCommandConfig> {

  static adapterCls = CliCommandRegistryAdapter;

  static getForRegister(clsOrId: ClassOrId): RegistryAdapter<CliCommandConfig> {
    return RegistryV2.getForRegister(CliCommandRegistryIndex, clsOrId);
  }

  static getConfig(clsOrId: ClassOrId): CliCommandConfig {
    return RegistryV2.get(CliCommandRegistryIndex, clsOrId).get();
  }

  static getCommandMapping(): Map<string, string> {
    return RegistryV2.instance(CliCommandRegistryIndex).getCommandMapping();
  }

  static async getInstance(name: string): Promise<CliCommandShape> {
    return RegistryV2.instance(CliCommandRegistryIndex).getInstance(name);
  }

  #fileMapping: Map<string, string>;

  process(events: ChangeEvent<Class>[]): void {
    // Do nothing for now?
  }

  /**
   * Get list of all commands available
   */
  getCommandMapping(): Map<string, string> {
    if (!this.#fileMapping) {
      const all = new Map<string, string>();
      for (const e of RuntimeIndex.find({
        module: m => !Runtime.production || m.prod,
        folder: f => f === 'support',
        file: f => f.role === 'std' && CLI_FILE_REGEX.test(f.sourceFile)
      })) {
        all.set(getName(e.sourceFile), e.import);
      }
      this.#fileMapping = all;
    }
    return this.#fileMapping;
  }

  /**
   * Get the name of a command from a given instance
   */
  getName(cmd: CliCommandShape, withModule = false): string | undefined {
    return RegistryV2.get(CliCommandRegistryIndex, cmd).getName(withModule);
  }

  /**
   * Import command into an instance
   */
  async getInstance(name: string): Promise<CliCommandShape> {
    const found = this.getCommandMapping().get(name);
    if (found) {
      const values = Object.values(await Runtime.importFrom<Record<string, Class>>(found));
      for (const v of values) {
        const cfg = RegistryV2.getOptional(CliCommandRegistryIndex, v);
        if (!cfg) {
          continue;
        }
        const result = cfg.getInstance();
        if (result.isActive !== undefined && !result.isActive()) {
          continue;
        }
        return result;
      }
    }
    throw new CliUnknownCommandError(name);
  }
}