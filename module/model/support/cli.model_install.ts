import { CliCommand, cliTpl } from '@travetto/cli';
import { MethodValidator } from '@travetto/schema';

import { BaseModelCommand } from './base-command.ts';
import { ModelInstallUtil } from './bin/install.ts';
import { ModelCandidateUtil } from './bin/candidate.ts';

/**
 * Installing models
 */
@CliCommand()
export class ModelInstallCommand extends BaseModelCommand {

  getOperation(): 'upsertModel' { return 'upsertModel'; }

  @MethodValidator(BaseModelCommand.validate.bind(null, 'upsertModel'))
  async main(provider: string, models: string[]): Promise<void> {
    const resolved = await ModelCandidateUtil.resolve(provider, models);
    await ModelInstallUtil.run(resolved.provider, resolved.models);
    console.log(cliTpl`${{ success: 'Successfully' }} installed ${{ param: models.length.toString() }} model(s)`);
  }
}