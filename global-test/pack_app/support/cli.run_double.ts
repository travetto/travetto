import { CliCommand } from '@travetto/cli';
import { Min } from '@travetto/schema';

/**
 * Doubles a number
 */
@CliCommand({ runTarget: true })
export class DoubleCommand {

  async main(@Min(10).Param age: number): Promise<void> {
    console.log(`Result: ${age * 2}`);
  }
}