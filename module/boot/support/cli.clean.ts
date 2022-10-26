import * as fs from 'fs/promises';
import * as path from 'path';

import { CliCommand, OptionConfig } from '@travetto/cli';
import { CliUtil } from '@travetto/boot';

type Options = {
  full: OptionConfig<boolean>;
  quiet: OptionConfig<boolean>;
};

/**
 * `npx trv clean`
 *
 * Allows for cleaning of the cache dire
 */
export class BaseCleanCommand extends CliCommand<Options> {

  name = 'clean';

  override async build(): Promise<void> { }

  getOptions(): Options {
    return {
      full: this.boolOption({ desc: 'Remove compiler cache', def: false }),
      quiet: this.boolOption({ desc: 'Quiet operation' }),
    };
  }

  async action(): Promise<void> {
    const cwd = process.cwd().__posix;
    for (const el of await fs.readdir(cwd)) {
      if (el.startsWith('.trv') && (await fs.stat(el)).isDirectory() && (!el.startsWith('.trv_compiler') || this.cmd.full)) {
        try {
          await fs.rmdir(el, { recursive: true, force: true });
          if (!this.cmd.quiet) {
            console!.log(CliUtil.color`${{ success: 'Successfully' }} deleted temp dir ${{ path: path.join(cwd, el).__posix }}`);
          }
        } catch {
          console!.error(CliUtil.color`${{ failure: 'Failed' }} to delete temp dir ${{ path: path.join(cwd, el).__posix }}`);
        }
      }
    }
  }
}
