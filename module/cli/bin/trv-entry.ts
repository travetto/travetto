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
async function compile() {
  const { AppCache, EnvUtil, } = await import('@travetto/boot');
  const { CompileUtil, SourceCodeIndex } = await import('@travetto/boot/src/internal');

  if (!EnvUtil.isReadonly()) {
    for (const { file } of SourceCodeIndex.find({ folder: 'bin' })) {
      if (!AppCache.hasEntry(file)) {
        CompileUtil.transpile(file);
      }
    }
  }
}

/**
 * Entry point
 */
export async function main() {
  await verifyLocal();
  await compile();
  (await import('@travetto/cli/src/execute'))
    .ExecutionManager.run(process.argv); // Run cli
}