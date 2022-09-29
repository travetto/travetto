import * as fs from 'fs/promises';

import { CliCommand, OptionConfig } from '@travetto/cli/src/command';
import { color, FileCache, PathUtil } from '@travetto/boot';

type Options = {
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
    return { quiet: this.boolOption({ desc: 'Quiet operation' }) };
  }

  async action(): Promise<void> {
    for (const el of await fs.readdir(PathUtil.cwd)) {
      if (el.startsWith('.trv') && (await fs.stat(el)).isDirectory()) {
        const cache = new FileCache(el);
        try {
          cache.clear(true);
          if (!this.cmd.quiet) {
            console!.log(color`${{ success: 'Successfully' }} deleted temp dir ${{ path: cache.cacheDir }}`);
          }
        } catch {
          console!.error(color`${{ failure: 'Failed' }} to delete temp dir ${{ path: cache.cacheDir }}`);
        }
      }
    }
  }
}
