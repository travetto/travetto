import { color } from '@travetto/cli/src/color';

import { BaseModelCommand } from './cli-base-command';
import { ModelInstallUtil } from '../support/bin/install';

/**
 * CLI Entry point for installing models
 */
export class ModelInstallCommand extends BaseModelCommand {
  name = 'model:install';
  op = 'createModel' as const;

  async action(provider: string, models: string[]): Promise<void> {
    try {
      await this.validate(provider, models);
      const resolved = await this.resolve(provider, models);
      await ModelInstallUtil.run(resolved.provider, resolved.models);
      console.log(color`${{ success: 'Successfully' }} installed ${{ param: models.length.toString() }} model(s)`);
    } catch (err) {
      console.error((err && err instanceof Error) ? err.message : err);
    }
  }
}