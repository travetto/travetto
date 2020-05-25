// @ts-check

import * as path from 'path';
import * as fs from 'fs';
import * as commander from 'commander';

import { CliUtil } from '@travetto/cli/src/util';
import { FsUtil } from '@travetto/boot/src/fs';
import { ExecUtil } from '@travetto/boot/src/exec';

/**
 * Supports building the aws lambda zip file
 */
export function init() {
  return CliUtil.program
    .command('rest-aws-lambda:build-zip')
    .option('-o --output [output]', 'Output file', 'dist/lambda.zip')
    .option('-w --workspace [workspace]', 'Workspace directory')
    .action(async (cmd: commander.Command) => {

      if (!cmd.workspace) {
        cmd.workspace = fs.mkdtempSync('lambda-');
        console!.log('Temp Workspace', cmd.workspace);
      }

      cmd.workspace = FsUtil.resolveUnix(FsUtil.cwd, cmd.workspace);
      cmd.output = FsUtil.resolveUnix(FsUtil.cwd, cmd.output);

      FsUtil.mkdirpSync(path.dirname(cmd.output));

      FsUtil.unlinkRecursiveSync(cmd.workspace);
      FsUtil.unlinkRecursiveSync(cmd.output);
      FsUtil.mkdirpSync(cmd.workspace);

      await ExecUtil.spawn('cp', ['-r', '*', cmd.workspace]).result;

      const dirVar = 'process.env.TRV_CACHE = __dirname + "/cache";';
      const lambda = fs.readFileSync(path.resolve(__dirname, '..', 'resources', 'lambda.js'), 'utf-8');

      fs.writeFileSync(`${cmd.workspace}/index.js`, `${dirVar}\n${lambda}`);

      await CliUtil.dependOn('compile', ['-o', './cache', '-r', '/var/task'], cmd.workspace);

      // Removing baggage
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/node_modules/typescript`);
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/node_modules/@types`);
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/node_modules/bson/browser_build`);
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/.git`);

      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/node_modules/source-map-support/browser-source-map-support.js`);
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/package-lock.json`);

      // Stub out ts
      FsUtil.mkdirpSync(`${cmd.workspace}/node_modules/typescript`);
      fs.writeFileSync(`${cmd.workspace}/node_modules/typescript/index.js`,
        'module.exports = {};');

      const { ScanFs } = await import('@travetto/boot');

      // Invert
      for (const p of ['test', 'dist']) {
        for (const f of ScanFs.scanDirSync({ testFile: x => false }, cmd.workspace)) {
          if (f.file.endsWith(`/${p}`)) {
            FsUtil.unlinkRecursiveSync(f.file);
          }
        }
      }

      for (const p of ['.d.ts', '.md', '.lock', 'bower.json',
        'apis/1_7.js', 'apis/0_9.js', 'apis/2_4.js',
        'apis/5.0.js', 'apis/5.1.js', 'apis/5.2.js',
        'apis/5.3.js', 'apis/5.4.js'
      ]) {
        for (const f of ScanFs.scanDirSync({ testFile: x => false, testDir: x => true }, `${cmd.workspace}/node_modules`)) {
          if (f.file.endsWith(p)) {
            FsUtil.unlinkRecursiveSync(f.file);
          }
        }
      }

      try {
        fs.renameSync(
          `${cmd.workspace}/node_modules/lodash/lodash.min.js`,
          `${cmd.workspace}/node_modules/lodash/lodash.js`
        );
      } catch (e) {
        // Ignore
      }

      await ExecUtil.spawn('zip', ['-qr', cmd.output, '.'], { cwd: cmd.workspace }).result;
      // remove(DIST);
    });
}