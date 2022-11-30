import { CliCommand } from '@travetto/cli';

import { Exec } from './bin/exec';
import { ServiceRunner } from './bin/service';

/**
 * Run all available command services
 */
export class RepoServiceCommand extends CliCommand {
  name = 'repo:service';

  async action(): Promise<void> {
    // Build all
    await Exec.build({ mode: 'all' });
    await ServiceRunner.runService(process.argv.slice(3));
  }
}