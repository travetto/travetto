import '@travetto/boot/support/init'; // Special b/c trv is run before proper compilation
import { PathUtil, EnvUtil } from '@travetto/boot';

/**
 * Entry point
 */
export async function main(): Promise<void> {
  if (!EnvUtil.isFalse('TRV_CLI_LOCAL') && !PathUtil.toUnix(__filename).includes(PathUtil.cwd)) { // If the current file is not under the working directory
    console.error(`
The @travetto/cli is not intended to be installed globally.  Please install it within your local project

  npm i --save-dev @travetto/cli

and invoke it locally using

  npx trv
`);
    process.exit(1);
  }

  const { ExecutionManager } = await import('@travetto/cli');
  return ExecutionManager.run(process.argv); // Run cli
}