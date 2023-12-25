import { ConsoleManager, Env, ShutdownManager } from '@travetto/base';

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

  /** Prepare command for execution */
  static async #prepareAndBind(cmd: CliCommandShape, args: string[]): Promise<unknown[]> {
    const schema = await CliCommandSchemaUtil.getSchema(cmd);
    args = await CliParseUtil.expandArgs(schema, args);
    cmd._parsed = await CliParseUtil.parse(schema, args);

    await cmd.preBind?.();
    try {
      const known = await CliCommandSchemaUtil.bindInput(cmd, cmd._parsed);

      await cmd.preValidate?.();
      await CliCommandSchemaUtil.validate(cmd, known);

      await cmd._cfg!.preMain?.(cmd);
      await cmd.preMain?.();

      return known;
    } catch (err) {
      if (err instanceof CliValidationResultError) {
        console.error!(await HelpUtil.renderValidationError(cmd, err));
        console.error!(await HelpUtil.renderCommandHelp(cmd));
        process.exit(1);
      } else {
        throw err;
      }
    }
  }

  /** Fetch a single command */
  static async #getCommand(cmd: string): Promise<CliCommandShape> {
    try {
      return await CliCommandRegistry.getInstance(cmd, true);
    } catch (err) {
      if (err instanceof CliUnknownCommandError) {
        if (err.help) {
          console.error!(err.help);
        } else {
          console.error!(err.defaultMessage, '\n');
          console.error!(await HelpUtil.renderAllHelp(''));
        }
        process.exit(1);
      } else {
        throw err;
      }
    }
  }

  /**
   * Execute the command line
   * @param args
   */
  static async run(argv: string[]): Promise<void> {
    try {
      const { cmd, args, help } = CliParseUtil.getArgs(argv);

      if (!cmd) {
        console.info!(await HelpUtil.renderAllHelp());
        return;
      }

      const command = await this.#getCommand(cmd);

      if (help) {
        console.log!(await HelpUtil.renderCommandHelp(command));
        return;
      } else {
        const known = await this.#prepareAndBind(command, args);
        ConsoleManager.debug(Env.debug);
        const result = await command.main(...known);
        await CliUtil.listenForResponse(result);
      }
    } catch (err) {
      console.error!(err);
      console.error!();
    } finally {
      await ShutdownManager.gracefulShutdown(process.exitCode);
    }
  }
}