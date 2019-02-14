//@ts-check

async function loadFiles() {
  await require(`@travetto/base/bin/bootstrap`).run();
  const { ScanApp } = require(`@travetto/base`);

  // TODO: Need to refine this
  // Collect all files to force compilation
  const files = ScanApp.findFiles('.ts', x =>
    // Allow specific files
    (
      x.endsWith('index.ts') ||
      (
        (x.includes('support/') || /^src\//.test(x)) &&
        !x.endsWith('.d.ts')
      )
    )
  ).filter(x => !x.file.includes('@travetto/test'));

  // Require them
  for (const f of files) {
    require(f.file);
  }

  return files;
}

async function writeToOutput(cmd, files) {
  const fs = require('fs');
  const { FsUtil } = require('@travetto/cli/src/fs-util');
  const { AppCache } = require(`@travetto/base/src/cache`);

  // Clear out cache if specified
  if (cmd.output) {
    try {
      FsUtil.unlinkDirSync(FsUtil.resolveNative(FsUtil.cwd, cmd.output));
    } catch (e) {
      // Ignore
    }
    FsUtil.mkdirp(cmd.output);
  }

  // Find final destination
  let outDir = FsUtil.resolveUnix(FsUtil.cwd, cmd.output || AppCache.cacheDir);

  const FILES = `ScanApp.setFileEntries('.ts', [${files.map(x => `'${x.module.replace(/node_modules\/@travetto/g, '#')}'`).join(', ')}])`;

  // Rewrite files to allow for presume different path
  for (const f of fs.readdirSync(AppCache.cacheDir)) {
    const inp = FsUtil.resolveUnix(AppCache.cacheDir, f);
    const out = FsUtil.resolveUnix(outDir, f);

    let contents = fs.readFileSync(inp).toString();
    contents = contents.replace(/[/][/]#.*$/, '');
    contents = contents.replace('ScanApp.cache = {}', x => `${x};\n${FILES}`);
    contents = contents.replace(new RegExp(FsUtil.cwd, 'g'), cmd.runtimeDir || process.cwd());
    fs.writeFileSync(out, contents);
  }
}

function init() {

  const { Util: { dependOn, program, colorize } } = require('@travetto/cli/src/util');

  program
    .command('compile')
    .option('-o, --output <output>', 'Output directory')
    .option('-r, --runtime-dir [runtimeDir]', 'Expected path during runtime')
    .action(async (cmd) => {

      process.env.DEBUG = '0';
      process.env.QUIET_INIT = '1';

      dependOn('clean');

      const files = await loadFiles();

      if (cmd.output) {
        await writeToOutput(cmd, files);
        console.log(`${colorize('Successfully', 'green')} wrote ${colorize(''+files.length, 'yellow')} files to ${colorize(cmd.output, 'white')}`);
      }
    });
}

module.exports = { init };