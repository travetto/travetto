import { ConsoleManager, getClass, Runtime, ShutdownManager, Util } from '@travetto/runtime';

import { HelpUtil } from './help.ts';
import { CliCommandRegistryIndex } from './registry/registry-index.ts';
import { CliCommandSchemaUtil } from './schema.ts';
import { CliParseUtil } from './parse.ts';
import type { CliCommandShape } from './types.ts';

/**
 * Execution manager
 */
export class ExecutionManager {

  /** Command Execution */
  static async execute(instance: CliCommandShape, args: unknown[]): Promise<void> {
    const config = CliCommandRegistryIndex.get(getClass(instance));

    for (const item of config.preMain) {
      await item.handler(instance);
    }

    // Wait 50ms to allow stdout to flush on shutdown
    ShutdownManager.signal.addEventListener('abort', () => Util.blockingTimeout(50));
    ConsoleManager.debug(Runtime.debug);
    await instance.main(...args);
  }

  /** Extract configuration and show help as needed */
  static async getExecutionCommand(argv: string[]): Promise<(() => Promise<void>) | undefined> {
    let command: CliCommandShape | undefined;

    const { cmd, args, help } = CliParseUtil.getArgs(argv);
    if (!cmd) {
      console.info!(await HelpUtil.renderAllHelp());
      return;
    }

    try {
      const [{ instance, schema }] = await CliCommandRegistryIndex.load([cmd]);
      command = instance;
      const fullArgs = await CliParseUtil.expandArgs(schema, args);

      const state = await CliParseUtil.parse(schema, fullArgs);
      CliParseUtil.setState(instance, state);

      const boundArgs = CliCommandSchemaUtil.bindInput(instance, state);
      await instance.finalize?.(help);

      if (help) {
        console.log!(await HelpUtil.renderCommandHelp(instance));
        return;
      }

      await CliCommandSchemaUtil.validate(command, boundArgs);

      return this.execute.bind(this, instance, boundArgs);
    } catch (error) {
      await HelpUtil.renderError(error, cmd, command);
    }
  }

  /**
   * Execute the command line
   * @param args
   */
  static async run(argv: string[]): Promise<void> {
    try {
      const execute = await this.getExecutionCommand(argv);
      await execute?.();
    } catch (error) {
      console.error!(error);
      process.exitCode ??= 1;
    } finally {
      await ShutdownManager.shutdown();
    }
  }
}