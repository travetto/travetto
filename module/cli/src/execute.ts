import { ConsoleManager, Runtime, ShutdownManager, Util } from '@travetto/runtime';

import { HelpUtil } from './help.ts';
import { CliCommandRegistryIndex } from './registry/registry-index.ts';
import { CliCommandSchemaUtil } from './schema.ts';
import { CliParseUtil } from './parse.ts';
import type { CliCommandShape } from './types.ts';

/**
 * Execution manager
 */
export class ExecutionManager {

  /**
   * Execute the command line
   * @param args
   */
  static async run(argv: string[]): Promise<void> {
    let command: CliCommandShape | undefined;

    const { cmd, args, help } = CliParseUtil.getArgs(argv);
    if (!cmd) {
      return console.info!(await HelpUtil.renderAllHelp());
    }

    try {
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

      await CliCommandSchemaUtil.validate(command, boundArgs);

      // Wait 50ms to allow stdout to flush on shutdown
      ShutdownManager.signal.addEventListener('abort', () => Util.blockingTimeout(50));

      for (const { handler } of config.preMain) {
        await handler(instance);
      }

      ConsoleManager.debug(Runtime.debug);
      await instance.main(...boundArgs);
    } catch (error) {
      await HelpUtil.renderError(error, cmd, command);
    } finally {
      await ShutdownManager.shutdown();
    }
  }
}