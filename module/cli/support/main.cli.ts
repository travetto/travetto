import { ExecutionManager } from '@travetto/cli';

/**
 * Entry point
 */
export async function main(): Promise<void> {
  return ExecutionManager.run(process.argv); // Run cli
}
