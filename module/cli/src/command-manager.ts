import { ModuleIndex } from '@travetto/boot';

import { CliUtil } from './util';
import { CliCommand } from './command';

const COMMAND_PACKAGE = [
  [/^run$/, 'app', true],
  [/^test$/, 'test', false],
  [/^service$/, 'command', true],
  [/^model:(install|export)$/, 'model', true],
  [/^openapi:(spec|client)$/, 'openapi', true],
  [/^email:(compile|dev)$/, 'email-template', false],
  [/^pack(:assemble|:zip|:docker)?$/, 'pack', false],
] as const;

/**
 * Manages loading and finding all commands
 */
export class CliCommandManager {

  /**
   * Get list of all commands available
   */
  static getCommandMapping(): Map<string, string> {
    const all = new Map<string, string>();
    for (const { output } of ModuleIndex.findSupport({ filter: /\/cli[.]/, checkProfile: false })) {
      all.set(output.replace(/^.*\/cli[.](.*?)[.][^.]+$/, (_, f) => f), output);
    }
    return all;
  }

  /**
   * Load command
   */
  static async loadCommand(
    cmd: string,
    cfg: {
      filter?: (p: CliCommand) => boolean,
      failOnMissing?: boolean
    } = {}
  ): Promise<CliCommand | undefined> {
    const command = cmd.replace(/:/g, '_');
    const found = this.getCommandMapping().get(command)!;
    if (!found) {
      const cfg = COMMAND_PACKAGE.find(([re]) => re.test(cmd));
      if (cfg) {
        const [, pkg, prod] = cfg;
        console.error(CliUtil.color`
${{ title: 'Missing Package' }}\n${'-'.repeat(20)}\nTo use ${{ input: cmd }} please run:\n
${{ identifier: `npm i ${prod ? '' : '--save-dev '}@travetto/${pkg}` }}`);
        process.exit(1);
      }
      throw new Error(`Unknown command: ${cmd}`);
    }
    try {
      const values = Object.values<{ new(...args: unknown[]): unknown }>(await import(found));
      for (const v of values) {
        try {
          const inst = new v();
          if (inst instanceof CliCommand && (!cfg.filter || cfg.filter(inst))) {
            return inst;
          }
        } catch { }
      }
    } catch (importErr) {
      console.error(`Import error: ${cmd}`, importErr);
    }
    if (cfg.failOnMissing ?? false) {
      throw new Error(`Not a valid command: ${cmd}`);
    }
  }

  /**
   * Load all available commands
   */
  static async loadAllCommands(op?: (p: CliCommand) => unknown | Promise<unknown>): Promise<CliCommand[]> {
    const commands = await Promise.all(
      [...this.getCommandMapping().keys()]
        .map(k => this.loadCommand(k, {
          filter(cmd: CliCommand) {
            return cmd.constructor.Ⲑmeta?.abstract !== true && cmd.isActive?.() !== false;
          }
        }))
    );

    return await Promise.all(commands
      .filter((x): x is Exclude<typeof x, undefined> => !!x)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async x => {
        await op?.(x);
        return x;
      }));
  }
}