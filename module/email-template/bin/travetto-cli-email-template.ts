import * as commander from 'commander';
import { Util, CompletionConfig } from '@travetto/cli/src/util';

// TODO: Document
export function init() {
  return Util.program.command('email-template').action(async (cmd: commander.Command) => {
    const { WebServer } = await import('@travetto/cli/src/http');
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.bootstrap();

    const { serverHandler } = await import('./email-server');

    new WebServer({
      handler: await serverHandler(),
      port: 3839,
      open: true
    }).run();
  });
}

// TODO: Document
export function complete(c: CompletionConfig) {
  c.all.push('email-template');
}