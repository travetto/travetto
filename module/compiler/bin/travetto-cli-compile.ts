import * as commander from 'commander';
import * as fs from 'fs';

import { Util, CompletionConfig } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';

async function rewriteRuntimeDir(runtimeDir: string = process.cwd()) {
  const { FsUtil, AppCache } = await import(`@travetto/boot`);

  const files = fs.readdirSync(AppCache.cacheDir).map(x => FsUtil.resolveUnix(AppCache.cacheDir, x));

  // Rewrite files to allow for presume different path
  const FILES = `ScanApp.setFileEntries('.ts', [
    ${files.map(x => `'${AppCache.toEntryName(x)}'`).join(',')}
])`;

  for (const file of files) {
    const contents = fs.readFileSync(file, 'utf-8')
      .replace(/ScanApp\.cache =.*/, x => `${x};\n${FILES}`) // Only for scan-app
      .replace(/[/][/]#.*$/, '') // Drop source maps
      .replace(new RegExp(FsUtil.cwd, 'g'), runtimeDir); // Rewrite paths
    fs.writeFileSync(file, contents);
  }
}

export function init() {

  return Util.program
    .command('compile')
    .option('-c, --clean', 'Indicates if the cache dir should be cleaned')
    .option('-o, --output <output>', 'Output directory')
    .option('-r, --runtime-dir [runtimeDir]', 'Expected path during runtime')
    .option('-q, --quiet', 'Quiet operation')
    .action(async (cmd: commander.Command) => {

      if (cmd.output) {
        process.env.TRV_CACHE = cmd.output;
      }

      if (cmd.clean) {
        Util.dependOn('clean');
      }

      //  Compile
      try {
        await Util.fork(`${__dirname}/compile-target.js`, [], process.env);
      } catch (err) {
        console.error(color`${{ failure: 'Failed' }} to compile to ${{ path: cmd.output ?? 'default' }}`, err);
        process.exit(1);
      }

      if (cmd.runtimeDir) {
        await rewriteRuntimeDir(cmd.runtimeDir);
      }

      if (!cmd.quiet) {
        console.log(color`${{ success: 'Successfully' }} wrote to ${{ path: cmd.output ?? 'default' }}`);
      }
    });
}

export function complete(c: CompletionConfig) {
  c.all.push('compile');
  c.task.compile = {
    '': ['--clean', '--quiet', '--runtime-dir', '--output']
  };
}