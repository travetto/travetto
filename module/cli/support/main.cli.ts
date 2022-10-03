import { PathUtil, EnvUtil, Host } from '@travetto/boot';
import { TranspileManager } from '@travetto/boot/src/internal/transpile';
import { SourceIndex } from '@travetto/boot/src/internal/source';

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

  if (!EnvUtil.isCompiled()) {
    // Compile CLI for usage
    TranspileManager.transpileAll(SourceIndex.find({ folder: Host.PATH.support }));
  }

  const { ExecutionManager } = await import('@travetto/cli');
  return ExecutionManager.run(process.argv); // Run cli
}