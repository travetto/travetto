import { GlobalTerminal } from '@travetto/terminal';
import { ConsoleManager, Env, Runtime } from '@travetto/base';

import { HelpUtil } from './help';
import { CliCommandShape } from './types';
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
   * Prepare command for execution
   */
  static async #prepareAndBind(cmd: CliCommandShape, args: string[]): Promise<unknown[]> {
    const schema = await CliCommandSchemaUtil.getSchema(cmd);
    args = await CliParseUtil.expandArgs(schema, args);
    cmd._parsed = await CliParseUtil.parse(schema, args);

    await cmd.preBind?.();
    const known = await CliCommandSchemaUtil.bindInput(cmd, cmd._parsed);

    await cmd.preValidate?.();
    await CliCommandSchemaUtil.validate(cmd, known);

    await cmd._cfg!.preMain?.(cmd);
    await cmd.preMain?.();

    return known;
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
    ConsoleManager.setup(false);

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
        const known = await this.#prepareAndBind(command, args);
        ConsoleManager.setup(Env.DEBUG.val, Runtime.production);
        const result = await command.main(...known);
        await CliUtil.listenForResponse(result);
      }
    } catch (err) {
      await this.#onError(command, err);
    }
  }
}