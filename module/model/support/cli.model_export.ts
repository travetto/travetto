import { ConsoleManager, PhaseManager } from '@travetto/boot';

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
      ConsoleManager.exclude('debug');
      await PhaseManager.run('init');

      await this.validate(provider, models);
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