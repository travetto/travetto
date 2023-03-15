import fs from 'fs/promises';

import { ShutdownManager } from '@travetto/base';
import { CliCommandShape, CliCommand } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';
import { ValidationError } from '@travetto/schema';

/**
 * Allows for running of main entry points
 */
@CliCommand()
export class MainCommand implements CliCommandShape {

  #unknownArgs?: string[];

  async #getImport(fileOrImport: string): Promise<string | undefined> {
    // If referenced file exists
    let file = fileOrImport;
    if (await (fs.stat(path.resolve(fileOrImport)).then(() => true, () => false))) {
      file = path.join(RootIndex.manifest.mainModule, fileOrImport);
    }

    return RootIndex.getFromImport(file)?.import;
  }

  async validate(fileOrImport: string): Promise<ValidationError | undefined> {
    const imp = await this.#getImport(fileOrImport);
    if (!imp) {
      return {
        message: `Unknown file: ${fileOrImport}`,
        kind: 'required',
        path: 'fileOrImport'
      };
    }
  }

  finalize(unknownArgs?: string[] | undefined): void | Promise<void> {
    this.#unknownArgs = unknownArgs;
  }

  async main(fileOrImport: string, args: string[] = []): Promise<void> {
    const allArgs = [...args, ...this.#unknownArgs ?? []];
    try {
      const imp = await this.#getImport(fileOrImport);
      const mod = await import(imp!);
      await ShutdownManager.exitWithResponse(await mod.main(...allArgs));
    } catch (err) {
      await ShutdownManager.exitWithResponse(err, true);
    }
  }
}