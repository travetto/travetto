import { appendFile, mkdir } from 'fs/promises';

import { GlobalTerminal } from '@travetto/terminal';
import { path } from '@travetto/manifest';
import { ConsoleManager, defineGlobalEnv, ShutdownManager } from '@travetto/base';

import { HelpUtil } from './help';
import { CliCommandShape, CliValidationResultError } from './types';
import { CliCommandRegistry } from './registry';
import { cliTpl } from './color';
import { CliCommandSchemaUtil } from './schema';

/**
 * Execution manager
 */
export class ExecutionManager {

  static async #prepareRun(cmd: CliCommandShape): Promise<void> {
    if (cmd.envInit) {
      defineGlobalEnv({
        debug: process.env.DEBUG || false,
        ...await cmd.envInit(),
      });
      ConsoleManager.setDebugFromEnv();
    }

    const cfg = CliCommandRegistry.getConfig(cmd);
    await cfg?.preMain?.(cmd);
  }

  static async #bindAndValidateArgs(cmd: CliCommandShape, args: string[]): Promise<unknown[]> {
    await cmd.initialize?.();
    const remainingArgs = await CliCommandSchemaUtil.bindFlags(cmd, args);
    const [known, unknown] = await CliCommandSchemaUtil.bindArgs(cmd, remainingArgs);
    await cmd.finalize?.(unknown);
    await CliCommandSchemaUtil.validate(cmd, known);
    return known;
  }

  static #getAction(cmd: CliCommandShape, args: string[]): 'help' | 'ipc' | 'command' {
    const cfg = CliCommandRegistry.getConfig(cmd);
    return args.find(a => /^(-h|--help)$/.test(a)) ?
      'help' :
      (process.env.TRV_CLI_IPC && cfg.runTarget) ? 'ipc' : 'command';
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
    const cfg = CliCommandRegistry.getConfig(cmd);
    const payload = JSON.stringify({
      type: '@travetto/cli:run', data: {
        name: cfg.name,
        module: cfg.module,
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
    await this.#prepareRun(cmd);
    const result = await cmd.main(...known);

    // Listen to result if non-empty
    if (result !== undefined && result !== null) {
      if ('close' in result) {
        ShutdownManager.onShutdown(result, result); // Tie shutdown into app close
      }
      if ('wait' in result) {
        await result.wait(); // Wait for close signal
      } else if ('on' in result) {
        await new Promise<void>(res => result.on('close', res)); // Wait for callback
      }
    }
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