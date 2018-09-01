const { FsUtil } = require('@travetto/base/src/fs-util');

module.exports = function init(program, cwd, dependOn) {
  const path = require('path');
  const cp = require('child_process');
  const exec = (...args) => cp.execSync(...args);

  program
    .command('aws-lambda:build')
    .option('-o --output [output]', 'Output file')
    .option('-w --workspace [workspace]', 'Workspace directory')
    .action(async (cmd) => {

      if (!cmd.workspace) {
        cmd.workspace = FsUtil.tempDir('lambda-');
        console.log('Temp Workspace', cmd.workspace);
      }

      const DIST = path.resolve(cwd, cmd.workspace);
      const ZIP = path.resolve(cwd, cmd.output || 'lambda.zip');

      FsUtil.remove(DIST);
      FsUtil.remove(ZIP);
      FsUtil.mkdirp(DIST);

      exec(`cp -r * ${DIST}`, { cwd });

      FsUtil.writeFile(`${DIST}/index.js`,
        'process.env.TS_CACHE_DIR = `${__dirname}/cache`;\n' +
        FsUtil.readFile(`${__dirname}/lambda.js`));

      await dependOn('compile', ['-o', './cache', '-r', '/var/task'], DIST);

      // Removing baggage
      FsUtil.remove(`${DIST}/node_modules/typescript`);
      FsUtil.remove(`${DIST}/node_modules/@types`);
      FsUtil.remove(`${DIST}/node_modules/bson/browser_build`);
      FsUtil.remove(`${DIST}/.git`);

      FsUtil.remove(`${DIST}/node_modules/source-map-support/browser-source-map-support.js`);
      FsUtil.remove(`${DIST}/package-lock.json`);

      // Stub out ts
      FsUtil.mkdirp(`${DIST}/node_modules/typescript`);
      FsUtil.writeFile(`${DIST}/node_modules/typescript/index.js`,
        'module.exports = {};');

      for (const p of ['e2e', 'test', 'dist']) {
        for (const f of FsUtil.find(DIST, x => x.endsWith(`/${p}`), true)) {
          FsUtil.remove(f);
        }
      }

      for (const p of ['.d.ts', '.md', '.lock', 'bower.json',
          'apis/1_7.js', 'apis/0_9.js', 'apis/2_4.js',
          'apis/5.0.js', 'apis/5.1.js', 'apis/5.2.js',
          'apis/5.3.js', 'apis/5.4.js'
        ]) {
        for (const f of FsUtil.find(`${DIST}/node_modules`, x => x.endsWith(p))) {
          FsUtil.remove(f);
        }
      }

      try {
        FsUtil.move(
          `${DIST}/node_modules/lodash/lodash.min.js`,
          `${DIST}/node_modules/lodash/lodash.js`
        );
      } catch (e) {
        // Ignore
      }

      exec(`zip -qr ${ZIP} . `, { cwd: DIST });
      // remove(DIST);
    });

  program.command('aws-lambda:deploy')
    .action((config, cmd) => {
      if (!config) {
        cmd.help();
      }
    });

  return program;
};