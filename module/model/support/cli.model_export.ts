import { CliCommand } from '@travetto/cli';

import { BaseModelCommand } from './base-command.ts';
import { ModelExportUtil } from './bin/export.ts';
import { ModelCandidateUtil } from './bin/candidate.ts';

/**
 * Exports model schemas
 */
@CliCommand({ with: { env: true, module: true } })
export class ModelExportCommand extends BaseModelCommand {

  getOp(): 'exportModel' { return 'exportModel'; }

  async main(provider: string, models: string[]): Promise<void> {
    const resolved = await ModelCandidateUtil.resolve(provider, models);
    await ModelExportUtil.run(resolved.provider, resolved.models);
  }
}