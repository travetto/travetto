import { BaseModelPlugin } from './lib/base-cli-plugin';
import { ModelExportUtil } from './lib/export';

/**
 * CLI Entry point for exporting model schemas
 */
export class ModelExportPlugin extends BaseModelPlugin {
  name = 'model:export';
  op = 'exportModel' as const;

  async action(provider: string, models: string[]) {
    try {
      await this.validate(provider, models);
      const resolved = await this.resolve(provider, models);
      await ModelExportUtil.run(resolved.provider, resolved.models);
    } catch (e) {
      console.error(e.message);
    }
  }
}