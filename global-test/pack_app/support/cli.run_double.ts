import { CliCommand } from '@travetto/cli';
import { BaseRunCommand } from '@travetto/registry/support/base.run';
import { Min } from '@travetto/schema';

/**
 * Doubles a number
 */
@CliCommand()
export class DoubleCommand extends BaseRunCommand {
  async main(@Min(10) age: number): Promise<void> {
    console.log(`Result: ${age * 2}`);
  }
}