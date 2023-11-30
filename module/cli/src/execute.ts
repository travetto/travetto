import { GlobalTerminal } from '@travetto/terminal';
import { ConsoleManager, GlobalEnv } from '@travetto/base';

import { HelpUtil } from './help';
import { CliCommandShape, RunResponse } from './types';
import { CliCommandRegistry } from './registry';
import { CliCommandSchemaUtil } from './schema';
import { CliUnknownCommandError, CliValidationResultError } from './error';
import { CliParseUtil } from './parse';
import { CliUtil } from './util';

/**
 * Execution manager
 */
export class ExecutionManager {

  /**
   * Run the given command object with the given arguments
   */
  static async #runCommand(cmd: CliCommandShape, args: string[]): Promise<RunResponse> {
    const schema = await CliCommandSchemaUtil.getSchema(cmd);
    args = await CliParseUtil.expandArgs(schema, args);
    cmd._parsed = await CliParseUtil.parse(schema, args);
    const cfg = CliCommandRegistry.getConfig(cmd);

    await cmd.preBind?.();
    const known = await CliCommandSchemaUtil.bindInput(cmd, cmd._parsed);

    await cmd.preValidate?.();
    await CliCommandSchemaUtil.validate(cmd, known);

    await cfg.preMain?.(cmd);
    await cmd.preMain?.();
    ConsoleManager.setDebug(GlobalEnv.debug, GlobalEnv.devMode);
    return cmd.main(...known);
  }

  /**
   * On error, handle response
   */
  static async #onError(command: CliCommandShape | undefined, err: unknown): Promise<void> {
    process.exitCode ||= 1; // Trigger error state
    switch (true) {
      case !(err instanceof Error): {
        throw err;
      }
      case command && err instanceof CliValidationResultError: {
        console.error!(await HelpUtil.renderValidationError(command, err));
        console.error!(await HelpUtil.renderCommandHelp(command));
        break;
      }
      case err instanceof CliUnknownCommandError: {
        if (err.help) {
          console.error!(err.help);
        } else {
          console.error!(err.defaultMessage, '\n');
          console.error!(await HelpUtil.renderAllHelp(''));
        }
        break;
      }
      default: {
        console.error!(err);
        console.error!();
      }
    }
  }

  /**
   * Execute the command line
   * @param args
   */
  static async run(argv: string[]): Promise<void> {
    await GlobalTerminal.init();

    let command: CliCommandShape | undefined;
    try {
      const { cmd, args, help } = CliParseUtil.getArgs(argv);

      if (!cmd) {
        console.info!(await HelpUtil.renderAllHelp());
        return;
      }

      // Load a single command
      command = await CliCommandRegistry.getInstance(cmd, true);
      if (help) {
        console.log!(await HelpUtil.renderCommandHelp(command));
      } else {
        const result = await this.#runCommand(command, args);
        await CliUtil.listenForResponse(result);
      }
    } catch (err) {
      await this.#onError(command, err);
    }
  }
}