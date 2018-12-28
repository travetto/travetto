//@ts-check

// @ts-ignore
const { FsUtil } = require('@travetto/cli/src/fs-util');
// @ts-ignore
const { Util: { cwd, program, dependOn } } = require('@travetto/cli/src/util');

module.exports = function () {
  const path = require('path');
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

      cmd.workspace = path.resolve(cwd, cmd.workspace);
      cmd.output = path.resolve(cwd, cmd.output);

      FsUtil.mkdirp(path.dirname(cmd.output));

      FsUtil.remove(cmd.workspace);
      FsUtil.remove(cmd.output);
      FsUtil.mkdirp(cmd.workspace);

      exec(`cp -r * ${cmd.workspace}`, { cwd });

      FsUtil.writeFile(`${cmd.workspace}/index.js`,
        'process.env.TS_CACHE_DIR = `${__dirname}/cache`;\n' +
        FsUtil.readFile(`${__dirname}/../resources/lambda.js`));

      await dependOn('compile', ['-o', './cache', '-r', '/var/task'], cmd.workspace);

      // Removing baggage
      FsUtil.remove(`${cmd.workspace}/node_modules/typescript`);
      FsUtil.remove(`${cmd.workspace}/node_modules/@types`);
      FsUtil.remove(`${cmd.workspace}/node_modules/bson/browser_build`);
      FsUtil.remove(`${cmd.workspace}/.git`);

      FsUtil.remove(`${cmd.workspace}/node_modules/source-map-support/browser-source-map-support.js`);
      FsUtil.remove(`${cmd.workspace}/package-lock.json`);

      // Stub out ts
      FsUtil.mkdirp(`${cmd.workspace}/node_modules/typescript`);
      FsUtil.writeFile(`${cmd.workspace}/node_modules/typescript/index.js`,
        'module.exports = {};');

      for (const p of ['e2e', 'test', 'dist']) {
        for (const f of FsUtil.find(cmd.workspace, x => x.endsWith(`/${p}`), true)) {
          FsUtil.remove(f);
        }
      }

      for (const p of ['.d.ts', '.md', '.lock', 'bower.json',
        'apis/1_7.js', 'apis/0_9.js', 'apis/2_4.js',
        'apis/5.0.js', 'apis/5.1.js', 'apis/5.2.js',
        'apis/5.3.js', 'apis/5.4.js'
      ]) {
        for (const f of FsUtil.find(`${cmd.workspace}/node_modules`, x => x.endsWith(p))) {
          FsUtil.remove(f);
        }
      }

      try {
        FsUtil.move(
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

      cmd.output = path.resolve(cwd, cmd.output);

      FsUtil.mkdirp(path.dirname(cmd.output));

      await require('@travetto/base/bin/bootstrap').run()
      const { ControllerRegistry } = require('@travetto/rest');

      await ControllerRegistry.init()
      const controllers = ControllerRegistry.getClasses().map(x => ControllerRegistry.get(x));

      const { template } = require(`${__dirname}/../resources/template.yml.js`);
      const sam = template(controllers, path.resolve(`${__dirname}/../resources`));

      FsUtil.writeFile(cmd.output, sam);
    });

  program.command('rest-lambda:deploy')
    .action((config, cmd) => {
      if (!config) {
        cmd.help();
      }
      console.log('To be implemented...');
    });
};