import { BaseModelPlugin } from './lib/base-cli-plugin';
import { CliModelExportUtil } from './lib/export';

/**
 * CLI Entry point for exporting model schemas
 */
export class ModelExportPlugin extends BaseModelPlugin {
  name = 'model:export';

  async action(provider: string, models: string[]) {
    try {
      await this.validate(provider, models);
      await this.prepareEnv();
      const resolved = await this.resolve(provider, models);
      await CliModelExportUtil.run(resolved.provider, resolved.models);
    } catch (e) {
      console.error(e.message);
    }
  }
}