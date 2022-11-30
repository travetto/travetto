import { CliCommand, OptionConfig } from '@travetto/cli';

import { Exec } from './bin/exec';

type Options = {
  mode: OptionConfig<'changed' | 'all'>;
  watch: OptionConfig<boolean>;
  globalTests: OptionConfig<boolean>;
};

/**
 * Compile code, with support for watching
 */
export class RepoBuildCommand extends CliCommand<Options> {
  name = 'repo:build';

  getOptions(): Options {
    return {
      mode: this.choiceOption({ desc: 'Only build changed modules', def: 'changed', choices: ['all', 'changed'] }),
      watch: this.boolOption({ desc: 'Run in watch mode', def: false }),
      globalTests: this.boolOption({ desc: 'Include global tests?', def: false })
    };
  }

  async action(): Promise<void> {
    // Build all
    await Exec.build({ mode: this.cmd.mode, globalTests: this.cmd.globalTests });
  }
}