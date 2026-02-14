import { JSONUtil, Runtime } from '@travetto/runtime';
import { type CliCommandShape, CliCommand, type CliValidationError, type ParsedState } from '@travetto/cli';
import { Ignore, IsPrivate } from '@travetto/schema';

/**
 * Allows for running of main entry points
 */
@CliCommand()
@IsPrivate()
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
      const module = await Runtime.importFrom<{ main(..._: unknown[]): Promise<unknown> }>(fileOrImport);
      result = await module.main(...args, ...this._parsed.unknown);
    } catch (error) {
      result = error;
      process.exitCode = Math.max(process.exitCode ? +process.exitCode : 1, 1);
    }

    if (result !== undefined) {
      if (process.connected) { process.send?.(result); }
      const payload = typeof result === 'string' ? result : (result instanceof Error ? result.stack : JSONUtil.toUTF8(result));
      process[process.exitCode ? 'stderr' : 'stdout'].write(`${payload}\n`);
    }
  }
}