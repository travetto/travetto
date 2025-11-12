import { Class, Runtime, RuntimeIndex } from '@travetto/runtime';
import { ClassOrId, RegistryAdapter, RegistryIndex, RegistryV2 } from '@travetto/registry';

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

  static getConfigByCommandName(cmd: string): CliCommandConfig | undefined {
    return RegistryV2.instance(CliCommandRegistryIndex).getConfigByCommandName(cmd);
  }

  static getCommandList(): string[] {
    return RegistryV2.instance(CliCommandRegistryIndex).getCommandList();
  }

  static hasCommand(name: string): boolean {
    return RegistryV2.instance(CliCommandRegistryIndex).hasCommand(name);
  }

  static async getInstance(name: string): Promise<CliCommandShape> {
    return RegistryV2.instance(CliCommandRegistryIndex).getInstance(name);
  }

  #fileMapping: Map<string, string>;

  /**
   * Get list of all commands available
   */
  get #commandMapping(): Map<string, string> {
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


  process(): void {
    // Do nothing for now?
  }

  getConfigByCommandName(cmd: string): CliCommandConfig | undefined {
    if (!this.hasCommand(cmd)) {
      return;
    }
    const found = this.#commandMapping.get(cmd)!;
    return RegistryV2.get(CliCommandRegistryIndex, found).get();
  }

  /**
   * Import command into an instance
   */
  async getInstance(name: string): Promise<CliCommandShape> {
    if (this.hasCommand(name)) {
      const found = this.#commandMapping.get(name)!;
      const values = Object.values(await Runtime.importFrom<Record<string, Class>>(found));
      const uninitialized = values.filter(v => typeof v === 'object' && !!v && 'Ⲑid' in v && !RegistryV2.has(CliCommandRegistryIndex, v));

      // Initialize any uninitialized commands
      if (uninitialized.length) {
        RegistryV2.manuallyInit(uninitialized);
      }

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

  getCommandList(): string[] {
    return [...this.#commandMapping.keys()].toSorted((a, b) => a.localeCompare(b));
  }

  hasCommand(name: string): boolean {
    return this.#commandMapping.has(name);
  }
}