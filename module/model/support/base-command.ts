import { ConsoleManager } from '@travetto/base';
import { CliCommandShape, cliTpl } from '@travetto/cli';
import { RootRegistry } from '@travetto/registry';
import { Ignore, ValidationError } from '@travetto/schema';

import { ModelCandidateUtil } from './bin/candidate';

/**
 * CLI Entry point for exporting model schemas
 */
export abstract class BaseModelCommand implements CliCommandShape {

  /** Application Environment */
  env?: string;

  @Ignore()
  op: 'exportModel' | 'createModel';

  async help(): Promise<string> {
    const candidates = await ModelCandidateUtil.getCandidates(this.op);
    return cliTpl`   
${{ title: 'Providers' }}:
${candidates.providers.map(p => cliTpl`  * ${{ type: p }}`).join('\n')}

${{ title: 'Models' }}:
${candidates.models.map(p => cliTpl`  * ${{ param: p }}`).join('\n')}
`;
  }

  async validate(provider: string, models: string[]): Promise<ValidationError | undefined> {
    ConsoleManager.setDebug(false);
    await RootRegistry.init();

    const candidates = await ModelCandidateUtil.getCandidates(this.op);
    if (!candidates.providers.includes(provider)) {
      return {
        message: `${provider} is not a valid provider`,
        path: 'provider',
        kind: 'invalid'
      };
    }
    const badModel = models.find(x => x !== '*' && !candidates.models.includes(x));
    if (badModel) {
      return {
        message: `${badModel} is not a valid model`,
        path: 'models',
        kind: 'invalid'
      };
    }
  }

  abstract main(...args: unknown[]): ReturnType<CliCommandShape['main']>;
}