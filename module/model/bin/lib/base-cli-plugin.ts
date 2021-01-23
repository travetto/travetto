import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { color } from '@travetto/cli/src/color';
import { CliModelCandidateUtil } from './candidate';
import { CliUtil } from '@travetto/cli/src/util';

/**
 * CLI Entry point for exporting model schemas
 */
export abstract class BaseModelPlugin extends BasePlugin {

  restoreEnv?: (err: Error) => unknown;

  resolve = CliModelCandidateUtil.resolve.bind(CliModelCandidateUtil);

  init(cmd: commander.Command) {
    return cmd
      .option('-e, --env [env]', 'Application environment (dev|prod|<other>)')
      .arguments('[provider] [models...]');
  }

  async usage({ providers, models }: { providers: string[], models: string[] }, err = '') {
    await this.showHelp(err, color`   
${{ title: 'Proivders' }}:
${providers.map(p => color`  * ${{ type: p }}`).join('\n')}

${{ title: 'Models' }}:
${models.map(p => color`  * ${{ param: p }}`).join('\n')}
`);
  }

  async validate(provider: string, models: string[]) {
    const candidates = await CliModelCandidateUtil.getCandidates();
    if (!provider) {
      return await this.usage(candidates);
    } else {
      if (!candidates.providers.includes(provider)) {
        await this.usage(candidates, color`${{ param: provider }} is not a valid provider`);
      }
      const badModel = models.find(x => x !== '*' && !candidates.models.includes(x));
      if (badModel) {
        await this.usage(candidates, color`${{ param: badModel }} is not a valid model`);
      }
    }
  }

  async prepareEnv() {
    CliUtil.initEnv({ watch: false });
    const { PhaseManager, ConsoleManager } = await import('@travetto/base');
    ConsoleManager['exclude'].add('debug');

    // Init
    await PhaseManager.init();
  }
}