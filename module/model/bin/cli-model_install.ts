import { color } from '@travetto/cli/src/color';
import { BaseModelPlugin } from './lib/base-cli-plugin';
import { ModelInstallUtil } from './lib/install';

/**
 * CLI Entry point for installing models
 */
export class ModelInstallPlugin extends BaseModelPlugin {
  name = 'model:install';
  op = 'createModel' as const;

  async action(provider: string, models: string[]) {
    try {
      await this.validate(provider, models);
      const resolved = await this.resolve(provider, models);
      await ModelInstallUtil.run(resolved.provider, resolved.models);
      console.log(color`${{ success: 'Successfully' }} installed ${{ param: models.length.toString() }} model(s)`);
    } catch (e) {
      console.error(e.message);
    }
  }
}