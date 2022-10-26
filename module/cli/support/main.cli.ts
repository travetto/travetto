import { EnvUtil } from '@travetto/base';

/**
 * Entry point
 */
export async function main(): Promise<void> {
  const cwd = process.cwd().__posix;
  if (!EnvUtil.isFalse('TRV_CLI_LOCAL') && !__source.folder.startsWith(cwd)) { // If the current file is not under the working directory
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