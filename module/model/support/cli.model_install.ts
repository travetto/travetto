import { CliCommand, cliTpl } from '@travetto/cli';

import { BaseModelCommand } from './base-command.ts';
import { ModelInstallUtil } from './bin/install.ts';
import { ModelCandidateUtil } from './bin/candidate.ts';

/**
 * Installing models
 */
@CliCommand({ with: { env: true, module: true } })
export class ModelInstallCommand extends BaseModelCommand {

  getOp(): 'createModel' { return 'createModel'; }

  async main(provider: string, models: string[]): Promise<void> {
    const resolved = await ModelCandidateUtil.resolve(provider, models);
    await ModelInstallUtil.run(resolved.provider, resolved.models);
    console.log(cliTpl`${{ success: 'Successfully' }} installed ${{ param: models.length.toString() }} model(s)`);
  }
}