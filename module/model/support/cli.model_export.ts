import { CliCommand } from '@travetto/cli';
import { MethodValidator } from '@travetto/schema';

import { BaseModelCommand } from './base-command.ts';
import { ModelCandidateUtil } from './bin/candidate.ts';
import { ModelExportUtil } from './bin/export.ts';

/**
 * Export model definitions for a selected provider and model set.
 *
 * The command resolves candidate models and delegates to provider-specific
 * export logic to produce schema/install artifacts.
 */
@CliCommand()
export class ModelExportCommand extends BaseModelCommand {
  getOperation(): 'exportModel' {
    return 'exportModel';
  }

  @MethodValidator(BaseModelCommand.validate.bind(null, 'exportModel'))
  async main(provider: string, models: string[]): Promise<void> {
    const resolved = await ModelCandidateUtil.resolve(provider, models);
    await ModelExportUtil.run(resolved.provider, resolved.models);
  }
}
