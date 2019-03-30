// @ts-check

async function rewriteRuntimeDir(runtimeDir) {
  const fs = require('fs');
  const { FsUtil, AppCache } = require(`@travetto/boot`);

  const files = fs.readdirSync(AppCache.cacheDir).map(x => FsUtil.resolveUnix(AppCache.cacheDir, x));

  // Rewrite files to allow for presume different path
  const FILES = `ScanApp.setFileEntries('.ts', [${files.map(x => `'${x.replace(/node_modules\/@travetto/g, '#')}'`).join(', ')}])`;

  for (const file of files) {
    let contents = fs.readFileSync(file).toString();
    contents = contents.replace(/[/][/]#.*$/, '');
    contents = contents.replace('ScanApp.cache = {}', x => `${x};\n${FILES}`);
    contents = contents.replace(new RegExp(FsUtil.cwd, 'g'), runtimeDir || process.cwd());
    fs.writeFileSync(file, contents);
  }
}

function init() {

  const { Util } = require('@travetto/cli/src/util');

  return Util.program
    .command('compile')
    .option('-c, --clean', 'Indicates if the cache dir should be cleaned')
    .option('-o, --output <output>', 'Output directory')
    .option('-r, --runtime-dir [runtimeDir]', 'Expected path during runtime')
    .option('-q, --quiet', 'Quiet operation')
    .action(async (cmd) => {

      process.env.DEBUG = '0';
      process.env.QUIET_INIT = '1';
      process.env.TRV_CACHE_DIR = cmd.output || '-';

      if (cmd.clean) {
        Util.dependOn('clean');
      }

      await require(`@travetto/base/bin/start`);
      const { Compiler } = require('../src/compiler');
      const count = Compiler.compileAll();

      if (cmd.runtimeDir) {
        await rewriteRuntimeDir(cmd.runtimeDir);
      }

      if (!cmd.quiet) {
        console.log(`${Util.colorize.success('Successfully')} wrote ${Util.colorize.output(count)} files to ${Util.colorize.path(cmd.output || 'default')}`);
      }
    });
}

function complete(c) {
  c.all.push('compile');
  c.compile = {
    '': ['--clean', '--quiet', '--runtime-dir', '--output']
  };
}

module.exports = { init, complete };