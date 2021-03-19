/**
 * Verify local installation
 */
async function verifyLocal() {
  if (process.env.TRV_DEV) { // Skip for dev
    return;
  }

  const { PathUtil } = await import('@travetto/boot/src/path');
  if (!PathUtil.toUnix(__filename).includes(PathUtil.cwd)) { // If the current file is not under the working directory
    console.error('The @travetto/cli is not intended to be installed globally.  Please install it within your local project');
    console.error('');
    console.error('npm i --save-dev @travetto/cli');
    console.error('');
    process.exit(1);
  }
}

/**
 * Compile CLI for usage
 */
async function build() {
  const { ModuleManager } = await import('@travetto/boot/src/internal/module');
  const { SourceIndex } = await import('@travetto/boot/src/internal/source');
  ModuleManager.transpileAll(SourceIndex.find({ folder: 'bin ' }));
}

/**
 * Entry point
 */
export async function main() {
  await verifyLocal();
  await build();
  const { ExecutionManager } = await import('@travetto/cli/src/execute');
  return ExecutionManager.run(process.argv); // Run cli
}