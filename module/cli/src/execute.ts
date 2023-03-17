import { appendFile, mkdir } from 'fs/promises';

import { GlobalTerminal } from '@travetto/terminal';
import { path } from '@travetto/manifest';
import { ConsoleManager, defineGlobalEnv } from '@travetto/base';

import { HelpUtil } from './help';
import { CliCommandMetaⲐ, CliCommandShape, CliValidationResultError } from './types';
import { CliCommandRegistry } from './registry';
import { cliTpl } from './color';
import { CliCommandSchemaUtil } from './schema';

/**
 * Execution manager
 */
export class ExecutionManager {

  static async #bindAndValidateArgs(cmd: CliCommandShape, args: string[]): Promise<unknown[]> {
    await cmd.initialize?.();
    const remainingArgs = await CliCommandSchemaUtil.bindFlags(cmd, args);
    const [known, unknown] = await CliCommandSchemaUtil.bindArgs(cmd, remainingArgs);
    await cmd.finalize?.(unknown);
    await CliCommandSchemaUtil.validate(cmd, known);
    return known;
  }

  static #getAction(cmd: CliCommandShape, args: string[]): 'help' | 'ipc' | 'command' {
    return args.find(a => /^(-h|--help)$/.test(a)) ?
      'help' :
      (process.env.TRV_CLI_IPC && cmd.runTarget?.()) ? 'ipc' : 'command';
  }

  /**
   * Run help
   */
  static async help(cmd: CliCommandShape, args: string[]): Promise<void> {
    console.log!(await HelpUtil.renderHelp(cmd));
  }

  /**
   * Append IPC payload to provided file
   */
  static async ipc(cmd: CliCommandShape, args: string[]): Promise<void> {
    await this.#bindAndValidateArgs(cmd, args);
    const file = process.env.TRV_CLI_IPC!;
    const payload = JSON.stringify({
      type: '@travetto/cli:run', data: {
        name: cmd[CliCommandMetaⲐ]!.name,
        args: process.argv.slice(3)
      }
    });
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, `${payload}\n`);
  }

  /**
   * Run the given command object with the given arguments
   */
  static async command(cmd: CliCommandShape, args: string[]): Promise<void> {
    const known = await this.#bindAndValidateArgs(cmd, args);

    if (cmd.envInit) {
      defineGlobalEnv(await cmd.envInit());
      ConsoleManager.setDebugFromEnv();
    }

    return await cmd.main(...known);
  }

  /**
   * Execute the command line
   * @param args
   */
  static async run(argv: string[]): Promise<void> {
    await GlobalTerminal.init();

    const [, , cmd, ...args] = argv;
    if (!cmd || /^(-h|--help)$/.test(cmd)) {
      console.log!(await HelpUtil.renderHelp());
    } else {
      let command: CliCommandShape | undefined;
      try {
        // Load a single command
        command = (await CliCommandRegistry.getInstance(cmd, true));
        const action = this.#getAction(command, args);
        await this[action](command, args);
      } catch (err) {
        if (!(err instanceof Error)) {
          throw err;
        } else if (command && err instanceof CliValidationResultError) {
          console.error(await HelpUtil.renderValidationError(command, err));
          console.error!(await HelpUtil.renderHelp(command));
        } else {
          console.error!(cliTpl`${{ failure: err.message }}`);
        }
      }
    }
  }
}