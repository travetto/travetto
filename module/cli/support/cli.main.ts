import fs from 'fs/promises';

import { ShutdownManager } from '@travetto/base';
import { BaseCliCommand, CliCommand, CliHelp } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';
import { MinLength } from '@travetto/schema';

/**
 * `npx trv main`
 *
 * Allows for running of main entry points
 */
@CliCommand()
export class MainCommand implements BaseCliCommand {

  async action(fileOrImport: string, @MinLength(0) args: string[]): Promise<void | CliHelp> {
    try {
      // If referenced file exists
      let file = fileOrImport;
      if (await (fs.stat(path.resolve(fileOrImport)).then(() => true, () => false))) {
        file = path.join(RootIndex.manifest.mainModule, fileOrImport);
      }

      const imp = RootIndex.getFromImport(file)?.import;
      if (!imp) {
        return new CliHelp(`Unknown file: ${file}`);
      }

      const mod = await import(imp);
      await ShutdownManager.exitWithResponse(await mod.main(...args));
    } catch (err) {
      await ShutdownManager.exitWithResponse(err, true);
    }
  }
}