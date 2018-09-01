const commander = require('commander');
const path = require('path');
const fs = require('fs');

const cwd = (process.env['init_cwd'] || process.env['INIT_CWD'] || process.cwd()).replace(/[\\]+/g, path.sep).replace(/[\/\\]+$/, '');

module.exports = {
  Util: {
    cwd,
    program: commander,
    dependOn(cmd, args, s_cwd) {
      require('child_process').execSync(`${process.argv.slice(0, 2).join(' ')} ${cmd} ${(args||[]).join(' ')}`, {
        env: process.env,
        cwd: s_cwd || cwd,
        stdio: [0, 1, 2]
      });
    },
    loadModule(f) {
      let p = fs.realpathSync(`${cwd}/node_modules/.bin/${f}`);
      if (!p.startsWith(cwd)) {
        p = `${cwd}/node_modules/@travetto/${p.split('travetto/module/')[1]}`;
      }
      require(p)();
    },
    run(args) {
      const cmd = args[2];

      if (!cmd || cmd.startsWith('-')) {
        commander.version(require(`${__dirname}/../package.json`).version);

        const files = fs.readdirSync(`${cwd}/node_modules/.bin`).filter(x => x.startsWith('travetto-cli-'));
        for (const f of files) {
          this.loadModule(f);
        }
      } else {
        try {
          this.loadModule(`travetto-cli-${cmd.replace(/:.*$/,'')}`);
        } catch (e) {
          console.error('Unknown command', cmd);
          console.error(e);
          process.exit(1);
        }
      }

      const res = commander.parse(process.argv);

      if (!res.constructor !== commander.Command) {
        commander.help();
      }
    }
  }
};