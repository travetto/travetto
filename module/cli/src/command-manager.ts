import { ModuleIndex } from '@travetto/boot/src/internal/module';
import { Host } from '@travetto/boot/src/host';
import { CliUtil } from '@travetto/boot/src/cli';

import { CliCommand } from './command';

const COMMAND_PACKAGE = [
  [/^run$/, 'app', true],
  [/^compile$/, 'compiler', true],
  [/^test$/, 'test', false],
  [/^command:service$/, 'command', true],
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
    for (const { file } of ModuleIndex.find({ folder: Host.PATH.support, filter: /\/cli[.]/ })) {
      all.set(file.split(`/${Host.PATH.support}/`)[1].replace(/^cli[.](.*?)[.][^.]+$/, (_, f) => f), file);
    }
    return all;
  }

  /**
   * Load command
   */
  static async loadCommand(cmd: string, op?: (p: CliCommand) => unknown): Promise<CliCommand> {
    const command = cmd.replace(/:/g, '_');
    const f = this.getCommandMapping().get(command)!;
    if (!f) {
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
    const values = Object.values<{ new(...args: unknown[]): unknown }>(await import(f));
    for (const v of values) {
      try {
        const inst = new v();
        if (inst instanceof CliCommand) {
          if (op) {
            await op(inst);
          }
          return inst;
        }
      } catch { }
    }
    throw new Error(`Not a valid command: ${cmd}`);
  }

  /**
   * Load all available commands
   */
  static async loadAllCommands(op?: (p: CliCommand) => unknown | Promise<unknown>): Promise<CliCommand[]> {
    return Promise.all(
      [...this.getCommandMapping().keys()]
        .sort((a, b) => a.localeCompare(b))
        .map(k => this.loadCommand(k, op).catch(() => undefined))
    ).then((values) =>
      values.filter((cmd): cmd is CliCommand => !!cmd)
    );
  }
}