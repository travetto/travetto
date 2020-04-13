import * as commander from 'commander';
import * as fs from 'fs';

import { Util, CompletionConfig } from '@travetto/cli/src/util';
import { color } from '@travetto/cli/src/color';

async function rewriteRuntimeDir(runtimeDir: string) {
  const { FsUtil, AppCache } = await import(`@travetto/boot`);

  const files = fs.readdirSync(AppCache.cacheDir).map(x => FsUtil.resolveUnix(AppCache.cacheDir, x));

  // Rewrite files to allow for presume different path
  const FILES = `ScanApp.setFileEntries('.ts', [${
    files.map(x => `'${
      x.replace(/node_modules\/@travetto/g, '#')
      // eslint-disable-next-line @typescript-eslint/indent
      }'`).join(', ')
    // eslint-disable-next-line @typescript-eslint/indent
    }])`;

  for (const file of files) {
    let contents = fs.readFileSync(file, 'utf-8');
    contents = contents.replace(/[/][/]#.*$/, '');
    contents = contents.replace('ScanApp.cache = {}', x => `${x};\n${FILES}`);
    contents = contents.replace(new RegExp(FsUtil.cwd, 'g'), runtimeDir || process.cwd());
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

      // process.env.DEBUG = '0';
      process.env.TRV_CACHE_DIR = cmd.output || '-';

      if (cmd.clean) {
        Util.dependOn('clean');
      }

      //  Compile
      await Util.fork(`${__dirname}/compile-target.js`, [], process.env);

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