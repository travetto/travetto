import { GlobalTerminal } from '@travetto/terminal';
import { ConsoleManager, defineEnv, ShutdownManager, GlobalEnv } from '@travetto/base';

import { HelpUtil } from './help';
import { CliCommandShape } from './types';
import { CliCommandRegistry } from './registry';
import { CliCommandSchemaUtil } from './schema';
import { CliUnknownCommandError, CliValidationResultError } from './error';

/**
 * Execution manager
 */
export class ExecutionManager {

  static async #envInit(cmd: CliCommandShape): Promise<void> {
    if (cmd.envInit) {
      defineEnv(await cmd.envInit());
      ConsoleManager.setDebug(GlobalEnv.debug, GlobalEnv.devMode);
    }
  }

  static async #bindAndValidateArgs(cmd: CliCommandShape, args: string[]): Promise<unknown[]> {
    await cmd.initialize?.();
    const remainingArgs = await CliCommandSchemaUtil.bindFlags(cmd, args);
    const [known, unknown] = await CliCommandSchemaUtil.bindArgs(cmd, remainingArgs);
    await cmd.finalize?.(unknown);
    await CliCommandSchemaUtil.validate(cmd, known);
    return known;
  }

  /**
   * Run help
   */
  static async help(cmd: CliCommandShape, args: string[]): Promise<void> {
    await cmd.initialize?.();
    await this.#envInit(cmd);
    console.log!(await HelpUtil.renderHelp(cmd));
  }

  /**
   * Run the given command object with the given arguments
   */
  static async command(cmd: CliCommandShape, args: string[]): Promise<void> {
    const known = await this.#bindAndValidateArgs(cmd, args);
    await this.#envInit(cmd);
    const cfg = CliCommandRegistry.getConfig(cmd);
    await cfg?.preMain?.(cmd);

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
      console.info!(await HelpUtil.renderHelp());
    } else {
      let command: CliCommandShape | undefined;
      try {
        // Load a single command
        command = (await CliCommandRegistry.getInstance(cmd, true));
        if (args.some(a => /^(-h|--help)$/.test(a))) {
          await this.help(command, args);
        } else {
          await this.command(command, args);
        }
      } catch (err) {
        process.exitCode ||= 1; // Trigger error state
        if (!(err instanceof Error)) {
          throw err;
        } else if (err instanceof CliValidationResultError) {
          console.error!(await HelpUtil.renderValidationError(command!, err));
          console.error!(await HelpUtil.renderHelp(command));
        } else if (err instanceof CliUnknownCommandError) {
          if (err.help) {
            console.error!(err.help);
          } else {
            console.error!(err.defaultMessage, '\n');
            console.error!(await HelpUtil.renderAllHelp(''));
          }
        } else {
          console.error!(err);
          console.error!();
        }
      }
    }
  }
}