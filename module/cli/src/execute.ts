import { appendFile, mkdir } from 'fs/promises';

import { GlobalTerminal } from '@travetto/terminal';
import { path } from '@travetto/manifest';
import { ConsoleManager, defineGlobalEnv } from '@travetto/base';
import { ValidationResultError } from '@travetto/schema';

import { HelpUtil } from './help';
import { CliCommandShape } from './types';
import { CliCommandRegistry } from './registry';
import { cliTpl } from './color';
import { CliCommandSchemaUtil } from './schema';

/**
 * Execution manager
 */
export class ExecutionManager {

  static #getAction(cmd: CliCommandShape, args: string[]): 'runHelp' | 'runIpc' | 'runCommand' {
    return args.find(a => /^(-h|--help)$/.test(a)) ?
      'runHelp' :
      (process.env.TRV_CLI_IPC && cmd.jsonIpc) ? 'runIpc' : 'runCommand';
  }

  /**
   * Run help
   */
  static async runHelp(cmd: CliCommandShape, args: string[]): Promise<void> {
    console.log!(await HelpUtil.renderHelp(cmd));
  }

  /**
   * Append IPC payload to provided file
   */
  static async runIpc(cmd: CliCommandShape, args: string[]): Promise<void> {
    const file = process.env.TRV_CLI_IPC!;
    const data = await cmd.jsonIpc!(...args);
    const name = CliCommandRegistry.getName(cmd);
    const payload = JSON.stringify({ type: name, data });
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, `${payload}\n`);
  }

  /**
   * Run the given command object with the given arguments
   */
  static async runCommand(cmd: CliCommandShape, args: string[]): Promise<void> {
    if (cmd.envInit) {
      defineGlobalEnv(await cmd.envInit());
      ConsoleManager.setDebugFromEnv();
    }

    const remainingArgs = await CliCommandSchemaUtil.bindFlags(cmd, args);
    const finalArgs = await CliCommandSchemaUtil.getArgs(cmd, remainingArgs);
    await CliCommandSchemaUtil.validate(cmd, finalArgs);
    return await cmd.main(...finalArgs);
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
        } else if (command && err instanceof ValidationResultError) {
          console.error(await HelpUtil.renderValidationError(command, err));
        } else {
          console.error!(cliTpl`${{ failure: err.message }}`);
        }
        console.error!(await HelpUtil.renderHelp(command));
      }
    }
  }
}