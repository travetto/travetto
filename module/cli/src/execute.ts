import { ConsoleManager, Env, ShutdownManager } from '@travetto/base';

import { HelpUtil } from './help';
import { CliCommandRegistry } from './registry';
import { CliCommandSchemaUtil } from './schema';
import { CliUnknownCommandError, CliValidationResultError } from './error';
import { CliParseUtil } from './parse';
import { CliUtil } from './util';
import { CliCommandShape } from './types';

/**
 * Execution manager
 */
export class ExecutionManager {

  /** Error handler */
  static async #onError(err: unknown): Promise<void> {
    process.exitCode ??= 1;
    if (err instanceof CliValidationResultError) {
      console.error!(await HelpUtil.renderValidationError(err));
      console.error!(await HelpUtil.renderCommandHelp(err.command));
    } else if (err instanceof CliUnknownCommandError) {
      if (err.help) {
        console.error!(err.help);
      } else {
        console.error!(err.defaultMessage, '\n');
        console.error!(await HelpUtil.renderAllHelp(''));
      }
    } else {
      console.error!(err);
    }
    console.error!();
  }

  /** Bind command  */
  static async #bindCommand(cmd: string, args: string[]): Promise<{ command: CliCommandShape, boundArgs: unknown[] }> {
    const command = await CliCommandRegistry.getInstance(cmd, true);
    const schema = await CliCommandSchemaUtil.getSchema(command);
    const fullArgs = await CliParseUtil.expandArgs(schema, args);
    const state = command._parsed = await CliParseUtil.parse(schema, fullArgs);

    await command.preBind?.();
    const boundArgs = await CliCommandSchemaUtil.bindInput(command, state);
    return { command, boundArgs };
  }

  /** Run command */
  static async #runCommand(cmd: string, args: string[]): Promise<void> {
    const { command, boundArgs } = await this.#bindCommand(cmd, args);

    await command.preValidate?.();
    await CliCommandSchemaUtil.validate(command, boundArgs);

    await command._cfg!.preMain?.(command);
    await command.preMain?.();

    ConsoleManager.debug(Env.debug);
    const result = await command.main(...boundArgs);
    await CliUtil.listenForResponse(result);
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
      } else if (help) {
        const { command } = await this.#bindCommand(cmd, args);
        console.log!(await HelpUtil.renderCommandHelp(command));
      } else {
        await this.#runCommand(cmd, args);
      }
    } catch (err) {
      await this.#onError(err);
    } finally {
      await ShutdownManager.gracefulShutdown();
    }
  }
}