import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { WebServer } from '@travetto/cli/src/http';
import { color } from '@travetto/cli/src/color';
import { BasePlugin } from '@travetto/cli/src/plugin-base';

/**
 * CLI Entry point for running the email server
 */
export class EmailDevPlugin extends BasePlugin {
  name = 'email:dev';

  init(cmd: commander.Command) {
    return cmd
      .option('-p, --port [port]', 'Port to serve ui on', '3839')
      .option('-r, --reload-rate [reloadRate]', 'The rate to reload the UI at', '1000')
      .option('-o, --open [open]', 'Open the ui automatically on start', CliUtil.isBoolean, true);
  }

  async action() {
    const { TemplateUtil } = await import('./lib/util');
    await TemplateUtil.initApp();

    const { DevServerUtil } = await import('./lib/server');

    const count = (await TemplateUtil.compileAllToDisk()).length;
    console!.log(color`Successfully compiled ${{ param: count }} templates`);

    const server = new WebServer({
      handler: DevServerUtil,
      port: this._cmd.port,
      open: CliUtil.isTrue(this._cmd.open),
      reloadRate: this._cmd.reloadRate
    });
    const http = server.start();

    const { ShutdownManager } = await import('@travetto/base');
    ShutdownManager.onShutdown('dev.server', () => http.close());
  }

  complete() {
    return {
      '': ['-p', '--port', '-o', '--open', '-r', '--reload-rate']
    };
  }
}