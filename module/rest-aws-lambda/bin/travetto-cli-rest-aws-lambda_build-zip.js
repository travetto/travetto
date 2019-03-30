// @ts-check

const path = require('path');
const fs = require('fs');
const readFile = f => fs.readFileSync(f, 'utf-8');
const writeFile = (f, c) => fs.writeFileSync(f, c, 'utf-8');

const { Util } = require('@travetto/cli/src/util');
const { FsUtil } = require('@travetto/boot/src/fs-util');
const { ScanFs } = require('@travetto/boot/src/scan-fs');

function init() {
  const cp = require('child_process');
  const exec = (arg, ...args) => cp.execSync(arg, ...args);

  return Util.program
    .command('rest-aws-lambda:build-zip')
    .option('-o --output [output]', 'Output file', 'dist/lambda.zip')
    .option('-w --workspace [workspace]', 'Workspace directory')
    .action(async (cmd) => {

      if (!cmd.workspace) {
        cmd.workspace = FsUtil.tempDir('lambda-');
        console.log('Temp Workspace', cmd.workspace);
      }

      cmd.workspace = FsUtil.resolveUnix(FsUtil.cwd, cmd.workspace);
      cmd.output = FsUtil.resolveUnix(FsUtil.cwd, cmd.output);

      FsUtil.mkdirp(path.dirname(cmd.output));

      FsUtil.unlinkRecursiveSync(cmd.workspace);
      FsUtil.unlinkRecursiveSync(cmd.output);
      FsUtil.mkdirp(cmd.workspace);

      exec(`cp -r * ${cmd.workspace}`, { cwd: FsUtil.cwd });

      // tslint:disable-next-line: no-invalid-template-strings
      const dirVar = 'process.env.TRV_CACHE_DIR = `${__dirname}/cache`;';
      const lambda = readFile(`${__dirname}/../resources/lambda.js`);

      writeFile(`${cmd.workspace}/index.js`, `${dirVar}\n${lambda}`);

      await Util.dependOn('compile', ['-o', './cache', '-r', '/var/task'], cmd.workspace);

      // Removing baggage
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/node_modules/typescript`);
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/node_modules/@types`);
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/node_modules/bson/browser_build`);
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/.git`);

      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/node_modules/source-map-support/browser-source-map-support.js`);
      FsUtil.unlinkRecursiveSync(`${cmd.workspace}/package-lock.json`);

      // Stub out ts
      FsUtil.mkdirp(`${cmd.workspace}/node_modules/typescript`);
      writeFile(`${cmd.workspace}/node_modules/typescript/index.js`,
        'module.exports = {};');

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

      exec(`zip -qr ${cmd.output} . `, { cwd: cmd.workspace });
      // remove(DIST);
    });
}

module.exports = { init };