import { ConsoleManager } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';

import { BaseModelCommand } from './cli.base-command';
import { ModelExportUtil } from './bin/export';

/**
 * CLI Entry point for exporting model schemas
 */
export class ModelExportCommand extends BaseModelCommand {
  name = 'model:export';
  op = 'exportModel' as const;

  async action(provider: string, models: string[]): Promise<void> {
    try {
      ConsoleManager.setDebug(false);
      await RootRegistry.init();

      if (!await this.validate(provider, models)) {
        return this.exit(1);
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