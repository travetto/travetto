import fs from 'node:fs/promises';
import path from 'node:path';

import { CliCommandShape, CliCommand, CliValidationError, ParsedState } from '@travetto/cli';
import { RuntimeIndex, RuntimeContext } from '@travetto/manifest';
import { Ignore } from '@travetto/schema';

/**
 * Allows for running of main entry points
 */
@CliCommand({ hidden: true })
export class MainCommand implements CliCommandShape {

  @Ignore()
  _parsed: ParsedState;

  async #getImport(fileOrImport: string): Promise<string | undefined> {
    // If referenced file exists
    let file = fileOrImport;
    if (await (fs.stat(path.resolve(fileOrImport)).then(() => true, () => false))) {
      file = path.join(RuntimeContext.main.name, fileOrImport);
    }

    return RuntimeIndex.getFromImport(file)?.import;
  }

  async validate(fileOrImport: string): Promise<CliValidationError | undefined> {
    const imp = await this.#getImport(fileOrImport);
    if (!imp) {
      return { message: `Unknown file: ${fileOrImport}` };
    }
  }

  async main(fileOrImport: string, args: string[] = []): Promise<void> {
    let res: unknown;
    try {
      const imp = await this.#getImport(fileOrImport);
      const mod = await import(imp!);
      res = await mod.main(...args, ...this._parsed.unknown);
    } catch (err) {
      res = err;
      process.exitCode = Math.max(process.exitCode ? +process.exitCode : 1, 1);
    }

    if (res !== undefined) {
      if (process.connected) { process.send?.(res); }
      const payload = typeof res === 'string' ? res : (res instanceof Error ? res.stack : JSON.stringify(res));
      process[process.exitCode ? 'stderr' : 'stdout'].write(`${payload}\n`);
    }
  }
}