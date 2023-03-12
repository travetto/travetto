import { Class, ConcreteClass } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { BaseCliCommand } from './command';

type CliCommandConfig = {
  name: string;
  cls: ConcreteClass<BaseCliCommand>;
};

class $CliCommandRegistry {
  #commands = new Map<Class, CliCommandConfig>();
  #fileMapping: Map<string, string>;

  /**
   * Get list of all commands available
   */
  getCommandMapping(): Map<string, string> {
    if (!this.#fileMapping) {
      const all = new Map<string, string>();
      for (const { outputFile: output, import: imp } of RootIndex.findSupport({ filter: /\/cli[.]/, checkProfile: false })) {
        all.set(output.match(/cli[.](.*?)[.][^.]+$/)![1].replace(/_/g, ':'), imp);
      }
      this.#fileMapping = all;
    }
    return this.#fileMapping;
  }

  async loadAll(): Promise<void> {
    await Promise.all([...this.getCommandMapping().values()].map(x => import(x)));
  }

  registerClass(cfg: CliCommandConfig): void {
    this.#commands.set(cfg.cls, cfg);
  }

  get(cls: Class): CliCommandConfig | undefined {
    return this.#commands.get(cls);
  }

  getByName(name: string): CliCommandConfig | undefined {
    for (const el of this.#commands.values()) {
      if (el.name === name) {
        return el;
      }
    }
  }
}

export const CliCommandRegistry = new $CliCommandRegistry();