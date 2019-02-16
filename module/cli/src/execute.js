//@ts-check
const commander = require('commander');

commander
  // @ts-ignore
  .version(require('../package.json').version);

const fs = require('fs');

const { FsUtil } = require('./fs-util');

const PREFIX = 'travetto-cli';

const Execute = {
  requireModule(f) {
    let p = FsUtil.toUnix(fs.realpathSync(`${FsUtil.cwd}/node_modules/.bin/${f}`));
    if (!p.startsWith(FsUtil.cwd)) {
      p = `${FsUtil.cwd}/node_modules/@travetto/${p.split('travetto/module/')[1]}`;
    }
    require(p).init();
  },
  loadAllPlugins() {
    const BIN_DIR = `${FsUtil.cwd}/node_modules/.bin`;
    if (fs.existsSync(BIN_DIR)) {
      const files = fs.readdirSync(BIN_DIR).filter(x => x.startsWith(`${PREFIX}-`));
      for (const f of files) {
        this.requireModule(f);
      }
    }
  },
  loadSinglePlugin(cmd) {
    try {
      this.requireModule(`${PREFIX}-${cmd.replace(/:.*$/, '')}`);
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
  run(args) {
    const cmd = args[2];

    if (!cmd) {
      this.showHelp();
    } else if (!cmd.startsWith('-')) {
      this.loadSinglePlugin(cmd);
    } else {
      this.loadAllPlugins();
    }

    commander.parse(args);
  }
}

module.exports = { Execute };