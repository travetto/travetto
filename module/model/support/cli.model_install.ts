import { CliCommand, cliTpl } from '@travetto/cli';

import { BaseModelCommand } from './base-command';
import { ModelInstallUtil } from './bin/install';
import { ModelCandidateUtil } from './bin/candidate';

/**
 * Installing models
 */
@CliCommand()
export class ModelInstallCommand extends BaseModelCommand {

  op = 'createModel' as const;

  async main(provider: string, models: string[]): Promise<void> {
    const resolved = await ModelCandidateUtil.resolve(provider, models);
    await ModelInstallUtil.run(resolved.provider, resolved.models);
    console.log(cliTpl`${{ success: 'Successfully' }} installed ${{ param: models.length.toString() }} model(s)`);
  }
}