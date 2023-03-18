import { CliRunCommand } from '@travetto/cli';
import { Min } from '@travetto/schema';

/**
 * Doubles a number
 */
@CliRunCommand()
export class DoubleCommand {
  async main(@Min(10) age: number): Promise<void> {
    console.log(`Result: ${age * 2}`);
  }
}