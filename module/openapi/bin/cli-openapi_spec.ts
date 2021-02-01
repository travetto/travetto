import * as commander from 'commander';
import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { ExecUtil, FsUtil } from '@travetto/boot';
import { CliUtil } from '@travetto/cli/src/util';

/**
 * CLI for outputting the open api spec to a local file
 */
export class OpenApiSpecPlugin extends BasePlugin {
  name = 'openapi:spec';

  init(cmd: commander.Command) {
    return cmd.option('-o, --output [output]', 'Output files', './openapi.yml');
  }

  async action() {
    CliUtil.initEnv({ watch: false, debug: '0', envExtra: { API_SPEC_OUTPUT: this._cmd.output } });
    const result = await ExecUtil.worker(require.resolve('./plugin-openapi_spec.js')).message;

    if (this._cmd.output === '-' || !this._cmd.output) {
      console.log!(result);
    }
  }
}