import { Class, ConcreteClass } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';

import { cliTpl } from './color';
import { CliCommandShape } from './types';

type CliCommandConfig = {
  name: string;
  module: string;
  cls: ConcreteClass<CliCommandShape>;
  runTarget?: boolean;
  hidden?: boolean;
  preMain?: (cmd: CliCommandShape) => void | Promise<void>;
};

const COMMAND_PACKAGE = [
  [/^test(:watch)?$/, 'test', false],
  [/^service$/, 'command', true],
  [/^lint(:register)?$/, 'lint', true],
  [/^model:(install|export)$/, 'model', true],
  [/^openapi:(spec|client)$/, 'openapi', true],
  [/^email:(compile|editor)$/, 'email-compiler', false],
  [/^pack(:zip|:docker)?$/, 'pack', false],
] as const;

const CLI_REGEX = /\/cli[.]([^.]+)[.][^.]+?$/;

class $CliCommandRegistry {
  #commands = new Map<Class, CliCommandConfig>();
  #fileMapping: Map<string, string>;

  #getMissingCommandHelp(cmd: string): string {
    const matchedCfg = COMMAND_PACKAGE.find(([re]) => re.test(cmd));
    if (matchedCfg) {
      const [, pkg, prod] = matchedCfg;
      let install: string;
      switch (RootIndex.manifest.packageManager) {
        case 'npm': install = `npm i ${prod ? '' : '--save-dev '}@travetto/${pkg}`; break;
        case 'yarn': install = `yarn add ${prod ? '' : '--dev '}@travetto/${pkg}`; break;
      }
      return cliTpl`
${{ title: 'Missing Package' }}\n${'-'.repeat(20)}\nTo use ${{ input: cmd }} please run:\n
${{ identifier: install }}
`;
    } else {
      return `Unknown command: ${cmd}`;
    }
  }

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
      for (const { outputFile: output, import: imp } of RootIndex.findSupport({ filter: CLI_REGEX, checkProfile: false })) {
        all.set(output.match(CLI_REGEX)![1].replace(/_/g, ':'), imp);
      }
      this.#fileMapping = all;
    }
    return this.#fileMapping;
  }

  /**
   * Registers a cli command
   */
  registerClass(cfg: CliCommandConfig): void {
    this.#commands.set(cfg.cls, cfg);
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
    const prefix = withModule ? `${cfg.module}:` : '';
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
    throw new Error(this.#getMissingCommandHelp(name));
  }
}

export const CliCommandRegistry = new $CliCommandRegistry();