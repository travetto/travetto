import { PathUtil } from '@travetto/boot/src/path';
import { ModuleManager } from '@travetto/boot/src/internal/module';
import { SourceIndex } from '@travetto/boot/src/internal/source';
import { EnvUtil } from '@travetto/boot';

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

  // Compile CLI for usage
  ModuleManager.transpileAll(SourceIndex.find({ folder: 'bin' }));

  const { ExecutionManager } = await import('@travetto/cli/src/execute');
  return ExecutionManager.run(process.argv); // Run cli
}