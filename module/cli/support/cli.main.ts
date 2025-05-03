import { Runtime } from '@travetto/runtime';
import { CliCommandShape, CliCommand, CliValidationError, ParsedState } from '@travetto/cli';
import { Ignore } from '@travetto/schema';

/**
 * Allows for running of main entry points
 */
@CliCommand({ hidden: true })
export class MainCommand implements CliCommandShape {

  @Ignore()
  _parsed: ParsedState;

  async validate(fileOrImport: string): Promise<CliValidationError | undefined> {
    try {
      await Runtime.importFrom(fileOrImport);
    } catch {
      return { message: `Unknown file: ${fileOrImport}` };
    }
  }

  async main(fileOrImport: string, args: string[] = []): Promise<void> {
    let result: unknown;
    try {
      const mod = await Runtime.importFrom<{ main(..._: unknown[]): Promise<unknown> }>(fileOrImport);
      result = await mod.main(...args, ...this._parsed.unknown);
    } catch (err) {
      result = err;
      process.exitCode = Math.max(process.exitCode ? +process.exitCode : 1, 1);
    }

    if (result !== undefined) {
      if (process.connected) { process.send?.(result); }
      const payload = typeof result === 'string' ? result : (result instanceof Error ? result.stack : JSON.stringify(result));
      process[process.exitCode ? 'stderr' : 'stdout'].write(`${payload}\n`);
    }
  }
}