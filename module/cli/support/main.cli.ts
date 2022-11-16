import { ExecutionManager } from '@travetto/cli';
import { path } from '@travetto/boot';

/**
 * Entry point
 */
export async function main(): Promise<void> {
  if (!__output.startsWith(path.cwd())) { // If the current file is not under the working directory
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