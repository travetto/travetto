import { ConsoleManager, Runtime, ShutdownManager, Util } from '@travetto/runtime';
import { ValidationResultError } from '@travetto/schema';

import { HelpUtil } from './help.ts';
import { CliCommandRegistryIndex } from './registry/registry-index.ts';
import { CliCommandSchemaUtil } from './schema.ts';
import { CliUnknownCommandError } from './error.ts';
import { CliParseUtil } from './parse.ts';
import type { CliCommandShape } from './types.ts';

/**
 * Execution manager
 */
export class ExecutionManager {

  /** Error handler */
  static async #onError(error: unknown, command?: CliCommandShape): Promise<void> {
    process.exitCode ??= 1;
    if (error instanceof ValidationResultError) {
      console.error!(HelpUtil.renderValidationError(error));
      if (command) {
        console.error!(await HelpUtil.renderCommandHelp(command));
      }
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

  /**
   * Execute the command line
   * @param args
   */
  static async run(argv: string[]): Promise<void> {
    let command: CliCommandShape | undefined;
    try {
      const { cmd, args, help } = CliParseUtil.getArgs(argv);
      if (!cmd) {
        return console.info!(await HelpUtil.renderAllHelp());
      }

      const [{ instance, schema, config }] = await CliCommandRegistryIndex.load([cmd]);
      command = instance;
      const fullArgs = await CliParseUtil.expandArgs(schema, args);

      const state = await CliParseUtil.parse(schema, fullArgs);
      CliParseUtil.setState(instance, state);

      const boundArgs = CliCommandSchemaUtil.bindInput(instance, state);
      await instance.finalize?.(help);

      if (help) {
        return console.log!(await HelpUtil.renderCommandHelp(instance));
      }

      // Wait 50ms to allow stdout to flush on shutdown
      ShutdownManager.signal.addEventListener('abort', () => Util.blockingTimeout(50));

      for (const preMain of config.preMain ?? []) {
        await preMain(instance);
      }

      ConsoleManager.debug(Runtime.debug);
      await instance.main(...boundArgs);
    } catch (error) {
      await this.#onError(error, command);
    } finally {
      await ShutdownManager.shutdown();
    }
  }
}