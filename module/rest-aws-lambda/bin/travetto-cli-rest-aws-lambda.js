//@ts-check

const path = require('path');
const fs = require('fs');
const readFile = f => fs.readFileSync(f, 'utf-8');
const writeFile = (f, c) => fs.writeFileSync(f, c, 'utf-8');

const { Util: { program, dependOn } } = require('@travetto/cli/src/util');
const { FsUtil } = require('@travetto/base/src/bootstrap/fs-util');
const { ScanFs } = require('@travetto/base/src/bootstrap/scan-fs');

function init() {
  const cp = require('child_process');
  const exec = (arg, ...args) => cp.execSync(arg, ...args);

  program
    .command('rest-lambda:build-zip')
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

      writeFile(`${cmd.workspace}/index.js`,
        'process.env.TRV_CACHE_DIR = `${__dirname}/cache`;\n' +
        readFile(`${__dirname}/../resources/lambda.js`));

      await dependOn('compile', ['-o', './cache', '-r', '/var/task'], cmd.workspace);

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

  program
    .command('rest-lambda:build-sam')
    .option('-e --env [env]', 'Environment name', 'prod')
    .option('-o --output [output]', 'Output file', 'dist/template.yml')
    .action(async (cmd) => {
      process.env.ENV = cmd.env;

      cmd.output = FsUtil.resolveUnix(FsUtil.cwd, cmd.output);

      FsUtil.mkdirp(path.dirname(cmd.output));

      await require('@travetto/base/bin/bootstrap').run()
      const { ControllerRegistry } = require('@travetto/rest');

      await ControllerRegistry.init()
      const controllers = ControllerRegistry.getClasses().map(x => ControllerRegistry.get(x));

      const { template } = require(FsUtil.resolveUnix(__dirname, '../resources/template.yml.js'));
      const sam = template(controllers, FsUtil.resolveUnix(__dirname, '../resources'));

      writeFile(cmd.output, sam);
    });

  program.command('rest-lambda:deploy')
    .action((config, cmd) => {
      if (!config) {
        cmd.help();
      }
      console.log('To be implemented...');
    });
}

module.exports = { init };