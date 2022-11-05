import { Env } from '@travetto/base';
import { ExecutionManager } from '@travetto/cli';
import * as path from '@travetto/path';

/**
 * Entry point
 */
export async function main(): Promise<void> {
  if (!Env.isFalse('TRV_CLI_LOCAL') && !__output.startsWith(path.cwd())) { // If the current file is not under the working directory
    console.error(`
The @travetto/cli is not intended to be installed globally.  Please install it within your local project

  npm i --save-dev @travetto/cli

and invoke it locally using

  npx trv
`);
    process.exit(1);
  }

  return ExecutionManager.run(process.argv); // Run cli
}