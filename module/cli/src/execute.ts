import { ConsoleManager, Runtime, ShutdownManager } from '@travetto/runtime';

import { HelpUtil } from './help.ts';
import { CliCommandRegistryIndex } from './registry/registry-index.ts';
import { CliCommandSchemaUtil } from './schema.ts';
import { CliUnknownCommandError, CliValidationResultError } from './error.ts';
import { CliParseUtil } from './parse.ts';
import type { CliCommandShape } from './types.ts';

/**
 * Execution manager
 */
export class ExecutionManager {

  /** Error handler */
  static async #onError(error: unknown): Promise<void> {
    process.exitCode ??= 1;
    if (error instanceof CliValidationResultError) {
      console.error!(await HelpUtil.renderValidationError(error));
      console.error!(await HelpUtil.renderCommandHelp(error.command));
    } else if (error instanceof CliUnknownCommandError) {
      if (error.help) {
        console.error!(error.help);
      } else {
        console.error!(error.defaultMessage, '\n');
        console.error!(await HelpUtil.renderAllHelp(''));
      }
    } else {
      console.error!(error);
    }
    console.error!();
  }

  /** Bind command  */
  static async #bindCommand(cmd: string, args: string[]): Promise<{ command: CliCommandShape, boundArgs: unknown[] }> {
    const [{ instance: command, schema }] = await CliCommandRegistryIndex.load([cmd]);
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

    ConsoleManager.debug(Runtime.debug);
    await command.main(...boundArgs);
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
    } catch (error) {
      await this.#onError(error);
    } finally {
      await ShutdownManager.gracefulShutdown('@travetto/cli:execute');
    }
  }
}