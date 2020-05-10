import * as commander from 'commander';
import { CliUtil, CompletionConfig } from '@travetto/cli/src/util';
import { WebServer } from '@travetto/cli/src/http';
import { color } from '@travetto/cli/src/color';


/**
 * CLI Entry point for running the email server
 */
export function init() {
  return CliUtil.program
    .command('email:dev')
    .option('-p, --port [port]', 'Port to serve ui on', 3839)
    .option('-r, --reload-rate [reloadRate]', 'The rate to reload the UI at', 1000)
    .option('-o, --open [open]', 'Open the ui automatically on start', CliUtil.BOOLEAN_RE, true)
    .action(async (cmd: commander.Command) => {
      process.env.RESOURCE_ROOTS = `${process.env.RESOURCE_ROOTS || ''},${__dirname}/lib`;

      const { PhaseManager } = await import('@travetto/base');
      await PhaseManager.bootstrap();

      const { TemplateUtil } = await import('./lib/util');
      const { DevServerUtil } = await import('./lib/server');

      const count = (await TemplateUtil.compileAllToDisk()).length;
      console.log(color`Successfully compiled ${{ param: count }} templates`);

      const server = new WebServer({ handler: DevServerUtil, port: cmd.port, open: cmd.open, reloadRate: cmd.reloadRate });
      const http = server.start();

      const { ShutdownManager } = await import('@travetto/base');
      ShutdownManager.onShutdown('dev.server', () => http.close());
    });
}

export function complete(c: CompletionConfig) {
  c.all.push('email:dev');
  c.task['email:dev'] = {
    '': ['-p', '--port', '-o', '--open', '-r', '--reload-rate']
  };
}