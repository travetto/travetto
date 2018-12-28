//@ts-check
const commander = require('commander');
const path = require('path');
const fs = require('fs');

const cwd = (process.env['init_cwd'] || process.env['INIT_CWD'] || process.cwd()).replace(/[\\]+/g, path.sep).replace(/[\/\\]+$/, '');

commander
  // @ts-ignore
  .version(require('../package.json').version);

module.exports = {
  Util: {
    cwd,
    program: commander,
    dependOn(cmd, args, s_cwd) {
      require('child_process').execSync(`${process.argv.slice(0, 2).join(' ')} ${cmd} ${(args || []).join(' ')}`, {
        env: process.env,
        cwd: s_cwd || cwd,
        stdio: [0, 1, 2]
      });
    },
    requireModule(f) {
      let p = fs.realpathSync(`${cwd}/node_modules/.bin/${f}`);
      if (!p.startsWith(cwd)) {
        p = `${cwd}/node_modules/@travetto/${p.split('travetto/module/')[1]}`;
      }
      require(p)();
    },
    loadAllPlugins() {
      const BIN_DIR = `${cwd}/node_modules/.bin`;
      if (fs.existsSync(BIN_DIR)) {
        const files = fs.readdirSync(BIN_DIR).filter(x => x.startsWith('travetto-cli-'));
        for (const f of files) {
          this.requireModule(f);
        }
      }
    },
    loadSinglePlugin(cmd) {
      try {
        this.requireModule(`travetto-cli-${cmd.replace(/:.*$/, '')}`);
      } catch (e) {
        console.error('Unknown command', cmd);
        this.showHelp(1);
      }
    },
    showHelp(code = 0) {
      this.loadAllPlugins();
      commander.help();
      process.exit(code);
    },
    execute(args) {
      const cmd = args[2];

      if (!cmd) {
        this.showHelp();
      } else if (!cmd.startsWith('-')) {
        this.loadSinglePlugin(cmd);
      } else {
        this.loadAllPlugins();
      }

      commander.parse(args);
    },
    fork(cmd, args) {
      return new Promise((resolve, reject) => {
        let text = [];
        let err = [];
        const proc = require('child_process').fork(cmd, args || [], {
          env: process.env,
          cwd: cwd,
          stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        });
        proc.stdout.on('data', v => text.push(v));
        proc.stderr.on('data', v => err.push(v));
        proc.on('close', v => resolve(Buffer.concat(text).toString()));
        proc.on('error', v => reject(Buffer.concat(err).toString()));
      });
    }
  }
};