import * as commander from 'commander';
import { CliUtil, CompletionConfig } from '@travetto/cli/src/util';

/**
 * CLI Entry point for running the email server
 */
export function init() {
  return CliUtil.program.command('email:compile').action(async (cmd: commander.Command) => {


    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.bootstrap();
  });
}

export function complete(c: CompletionConfig) {
  c.all.push('email:compile');
}