import * as path from 'path';
import * as fs from 'fs';
import * as commander from 'commander';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { FsUtil } from '@travetto/boot/src/fs';
import { ExecUtil } from '@travetto/boot/src/exec';

/**
 * Supports building the aws lambda zip file
 */
export class RestAwsLambdaBuildZipPlugin extends BasePlugin {
  name = 'rest-aws-lambda:build-zip';

  init(cmd: commander.Command) {
    return cmd
      .option('-o --output [output]', 'Output file', 'dist/lambda.zip')
      .option('-w --workspace [workspace]', 'Workspace directory');
  }

  async action() {
    let { workspace, output } = this._cmd;

    if (!workspace) {
      workspace = fs.mkdtempSync('lambda-');
      console!.log('Temp Workspace', workspace);
    }

    workspace = FsUtil.resolveUnix(FsUtil.cwd, workspace);
    output = FsUtil.resolveUnix(FsUtil.cwd, output);

    FsUtil.mkdirpSync(path.dirname(output));

    FsUtil.unlinkRecursiveSync(workspace);
    FsUtil.unlinkRecursiveSync(output);
    FsUtil.mkdirpSync(workspace);

    await ExecUtil.spawn('cp', ['-r', '*', workspace]).result;

    const dirVar = 'process.env.TRV_CACHE = __dirname + "/cache";';
    const lambda = fs.readFileSync(path.resolve(__dirname, '..', 'resources', 'lambda.js'), 'utf-8');

    fs.writeFileSync(`${workspace}/index.js`, `${dirVar}\n${lambda}`);

    await ExecUtil.spawn('npx', ['trv', 'compile', '-o', './cache', '-r', '/var/task'], { cwd: workspace }).result;

    // Removing baggage
    FsUtil.unlinkRecursiveSync(`${workspace}/node_modules/typescript`);
    FsUtil.unlinkRecursiveSync(`${workspace}/node_modules/@types`);
    FsUtil.unlinkRecursiveSync(`${workspace}/node_modules/bson/browser_build`);
    FsUtil.unlinkRecursiveSync(`${workspace}/.git`);

    FsUtil.unlinkRecursiveSync(`${workspace}/node_modules/source-map-support/browser-source-map-support.js`);
    FsUtil.unlinkRecursiveSync(`${workspace}/package-lock.json`);

    // Stub out ts
    FsUtil.mkdirpSync(`${workspace}/node_modules/typescript`);
    fs.writeFileSync(`${workspace}/node_modules/typescript/index.js`,
      'module.exports = {};');

    const { ScanFs } = await import('@travetto/boot');

    // Invert
    for (const p of ['test', 'dist']) {
      for (const f of ScanFs.scanDirSync({ testFile: x => false }, workspace)) {
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
      for (const f of ScanFs.scanDirSync({ testFile: x => false, testDir: x => true }, `${workspace}/node_modules`)) {
        if (f.file.endsWith(p)) {
          FsUtil.unlinkRecursiveSync(f.file);
        }
      }
    }

    try {
      fs.renameSync(
        `${workspace}/node_modules/lodash/lodash.min.js`,
        `${workspace}/node_modules/lodash/lodash.js`
      );
    } catch (e) {
      // Ignore
    }

    await ExecUtil.spawn('zip', ['-qr', output, '.'], { cwd: workspace }).result;
    // remove(DIST);
  }
}