// @ts-check
const commander = require('commander');

commander
  // @ts-ignore
  .version(require('../package.json').version);

const fs = require('fs');

const { FsUtil } = require('./fs-util');
const { Util } = require('./util');

const PREFIX = 'travetto-cli';

const Execute = {
  requireModule(f) {
    let p = FsUtil.toUnix(fs.realpathSync(`${FsUtil.cwd}/node_modules/.bin/${f}`));
    if (!p.startsWith(FsUtil.cwd)) {
      p = `${FsUtil.cwd}/node_modules/@travetto/${p.split('travetto/module/')[1]}`;
    }
    return require(p).init();
  },
  loadAllPlugins() {
    const BIN_DIR = `${FsUtil.cwd}/node_modules/.bin`;
    if (fs.existsSync(BIN_DIR)) {
      const files = fs.readdirSync(BIN_DIR).filter(x => x.startsWith(`${PREFIX}-`));
      for (const f of files) {
        Execute.requireModule(f);
      }
    }
  },
  loadSinglePlugin(cmd) {
    try {
      return Execute.requireModule(`${PREFIX}-${cmd.replace(/:/g, '_')}`);
    } catch (e) {
      console.error('Unknown command', cmd);
      Util.showHelp(commander, 1);
    }
  },
  run(args) {
    const cmd = args[2];
    const hasCmd = cmd && !cmd.startsWith('-');
    const wantsHelp = args.includes('-h') || args.includes('--help');

    if (hasCmd) {
      const prog = Execute.loadSinglePlugin(cmd);
      if (wantsHelp) {
        Util.showHelp(prog);
      }
    } else {
      Execute.loadAllPlugins();
      if (!cmd || wantsHelp) {
        Util.showHelp(commander);
      }
    }

    commander.parse(args);
  }
};

module.exports = { Execute };