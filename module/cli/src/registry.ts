import { Class, ConcreteClass, GlobalEnv } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

import { CliCommandShape } from './types';
import { CliUnknownCommandError } from './error';

export type CliCommandConfigOptions = {
  runTarget?: boolean;
  hidden?: boolean;
  addModule?: boolean;
  addEnv?: boolean;
  runtimeModule?: 'current' | 'command';
  /** @deprecated */
  fields?: ('module' | 'env')[];
};

export type CliCommandConfig = {
  name: string;
  commandModule: string;
  cls: ConcreteClass<CliCommandShape>;
  preMain?: (cmd: CliCommandShape) => void | Promise<void>;
};

const CLI_FILE_REGEX = /\/cli[.](?<name>.*)[.]tsx?$/;
const getName = (s: string): string => (s.match(CLI_FILE_REGEX)?.groups?.name ?? s).replaceAll('_', ':');

class $CliCommandRegistry {
  #commands = new Map<Class, CliCommandConfig>();
  #fileMapping: Map<string, string>;

  #get(cls: Class): CliCommandConfig | undefined {
    return this.#commands.get(cls);
  }

  #getClass(cmd: CliCommandShape): Class<CliCommandShape> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cmd.constructor as Class;
  }

  /**
   * Get list of all commands available
   */
  getCommandMapping(): Map<string, string> {
    if (!this.#fileMapping) {
      const all = new Map<string, string>();
      for (const e of RootIndex.find({
        module: m => GlobalEnv.devMode || m.prod,
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
   * Registers a cli command
   */
  registerClass(cls: Class, cfg: Partial<CliCommandConfig>): CliCommandConfig {
    const source = RootIndex.getFunctionMetadata(cls)!.source;
    this.#commands.set(cls, {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      cls: cls as ConcreteClass,
      name: getName(source),
      commandModule: RootIndex.getModuleFromSource(source)!.name,
      ...cfg,
    });
    return this.#commands.get(cls)!;
  }

  /**
   * Get config for a given instance
   */
  getConfig(cmd: CliCommandShape): CliCommandConfig {
    return this.#get(this.#getClass(cmd))!;
  }

  /**
   * Get the name of a command from a given instance
   */
  getName(cmd: CliCommandShape, withModule = false): string | undefined {
    const cfg = this.getConfig(cmd);
    const prefix = withModule ? `${cfg.commandModule}:` : '';
    return `${prefix}${cfg.name}`;
  }

  /**
   * Import command into an instance
   */
  getInstance(name: string, failOnMissing: true): Promise<CliCommandShape>;
  async getInstance(name: string): Promise<CliCommandShape | undefined>;
  async getInstance(name: string, failOnMissing = false): Promise<CliCommandShape | undefined> {
    const found = this.getCommandMapping().get(name);
    if (found) {
      const values = Object.values<Class>(await import(found));
      for (const v of values) {
        const cfg = this.#get(v);
        if (cfg) {
          const inst = new cfg.cls();
          if (!inst.isActive || inst.isActive()) {
            return inst;
          }
        }
      }
      if (!failOnMissing) {
        return undefined;
      }
    }
    throw new CliUnknownCommandError(name);
  }
}

export const CliCommandRegistry = new $CliCommandRegistry();