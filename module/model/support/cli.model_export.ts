import { CliCommand } from '@travetto/cli';

import { BaseModelCommand } from './base-command';
import { ModelExportUtil } from './bin/export';
import { ModelCandidateUtil } from './bin/candidate';

/**
 * Exports model schemas
 */
@CliCommand({ fields: ['env', 'module'] })
export class ModelExportCommand extends BaseModelCommand {

  getOp(): 'exportModel' { return 'exportModel'; }

  async main(provider: string, models: string[]): Promise<void> {
    const resolved = await ModelCandidateUtil.resolve(provider, models);
    await ModelExportUtil.run(resolved.provider, resolved.models);
  }
}