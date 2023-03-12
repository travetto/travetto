import { BaseCliCommand, cliTpl } from '@travetto/cli';
import type { ModelStorageSupport } from '@travetto/model/src/service/storage';
import { Ignore } from '@travetto/schema';

import { ModelCandidateUtil } from './bin/candidate';

/**
 * CLI Entry point for exporting model schemas
 */
export abstract class BaseModelCommand implements BaseCliCommand {

  restoreEnv?: (err: Error) => unknown;

  @Ignore()
  resolve = ModelCandidateUtil.resolve.bind(ModelCandidateUtil);

  /** Application Environment */
  env?: string;

  abstract get op(): keyof ModelStorageSupport;

  usage({ providers, models }: { providers: string[], models: string[] }, err = ''): Promise<void> {
    return this.showHelp(err, cliTpl`   
${{ title: 'Providers' }}:
${providers.map(p => cliTpl`  * ${{ type: p }}`).join('\n')}

${{ title: 'Models' }}:
${models.map(p => cliTpl`  * ${{ param: p }}`).join('\n')}
`, false);
  }

  async validate(provider: string, models: string[]): Promise<true | void> {
    const candidates = await ModelCandidateUtil.getCandidates(this.op);
    if (!provider) {
      return this.usage(candidates);
    } else {
      if (!candidates.providers.includes(provider)) {
        return this.usage(candidates, cliTpl`${{ param: provider }} is not a valid provider`);
      }
      const badModel = models.find(x => x !== '*' && !candidates.models.includes(x));
      if (badModel) {
        return this.usage(candidates, cliTpl`${{ param: badModel }} is not a valid model`);
      }
    }
    return true;
  }

  abstract action(...args: unknown[]): ReturnType<BaseCliCommand['action']>;
}