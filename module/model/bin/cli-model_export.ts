import { BaseModelPlugin } from './lib/base-cli-plugin';
import { CliModelExportUtil } from './lib/export';

/**
 * CLI Entry point for exporting model schemas
 */
export class ModelExportPlugin extends BaseModelPlugin {
  name = 'model:export';

  async run(provider: string, models: string[]) {
    CliModelExportUtil.export(provider, models);
  }
}