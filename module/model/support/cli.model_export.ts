import { ConsoleManager } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { CliCommand } from '@travetto/cli';

import { BaseModelCommand } from './cli.base-command';
import { ModelExportUtil } from './bin/export';

/**
 * CLI Entry point for exporting model schemas
 */
@CliCommand()
export class ModelExportCommand extends BaseModelCommand {

  get op(): this['op'] {
    return 'exportModel' as const;
  }

  async action(provider: string, models: string[]): Promise<void | 1> {
    try {
      ConsoleManager.setDebug(false);
      await RootRegistry.init();

      if (!await this.validate(provider, models)) {
        return 1;
      }

      const resolved = await this.resolve(provider, models);
      await ModelExportUtil.run(resolved.provider, resolved.models);
    } catch (err) {
      if (err instanceof Error) {
        console.error(err.message);
      } else {
        console.error((err && err instanceof Error) ? err.message : err);
      }
    }
  }
}