import * as fs from 'fs/promises';
import * as path from '@travetto/path';

import { CliUtil, CliCommand, OptionConfig } from '@travetto/cli';

type Options = {
  full: OptionConfig<boolean>;
  quiet: OptionConfig<boolean>;
};

/**
 * `npx trv clean`
 *
 * Allows for cleaning of the cache dire
 */
export class BootCleanCommand extends CliCommand<Options> {

  name = 'clean';

  getOptions(): Options {
    return {
      full: this.boolOption({ desc: 'Remove compiler cache', def: false }),
      quiet: this.boolOption({ desc: 'Quiet operation' }),
    };
  }

  async action(): Promise<void> {
    const cwd = path.cwd();
    for (const el of await fs.readdir(cwd)) {
      if (el.startsWith('.trv') && (await fs.stat(el)).isDirectory() && (!el.startsWith('.trv_compiler') || this.cmd.full)) {
        try {
          await fs.rmdir(el, { recursive: true });
          if (!this.cmd.quiet) {
            console!.log(CliUtil.color`${{ success: 'Successfully' }} deleted temp dir ${{ path: path.join(cwd, el) }}`);
          }
        } catch {
          console!.error(CliUtil.color`${{ failure: 'Failed' }} to delete temp dir ${{ path: path.join(cwd, el) }}`);
        }
      }
    }
  }
}
