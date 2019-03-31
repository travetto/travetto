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
    return require(p);
  },
  loadAllPlugins() {
    const BIN_DIR = `${FsUtil.cwd}/node_modules/.bin`;
    if (fs.existsSync(BIN_DIR)) {
      const files = fs.readdirSync(BIN_DIR).filter(x => x.startsWith(`${PREFIX}-`));
      const all = [];
      for (const f of files) {
        all.push(Execute.requireModule(f));
      }
      return all;
    }
  },
  loadSinglePlugin(cmd) {
    return Execute.requireModule(`${PREFIX}-${cmd.replace(/:/g, '_')}`);
  },
  async getCompletion(args) {
    const compl = { all: [] };
    const cmd = args.shift() || '';
    await Promise.all(Execute.loadAllPlugins().map(x => x.complete(compl)));

    let last = cmd;
    let opts = [];

    if (!compl[cmd]) {
      opts = compl.all;
    } else {
      last = args.pop() || '';
      const second = args.pop() || '';
      let flag = '';

      if (last in compl[cmd]) {
        flag = last;
        last = '';
      } else if (second in compl[cmd]) {
        if (compl[cmd][second].includes(last)) {
          flag = '';
          last = '';
        } else {
          flag = second;
        }
      }
      opts = compl[cmd][flag];
    }

    return last ? opts.filter(x => x.startsWith(last)) : opts.filter(x => !x.startsWith('-'));
  },
  run(args) {
    const cmd = args[2];
    const hasCmd = cmd && !cmd.startsWith('-');
    const wantsHelp = args.includes('-h') || args.includes('--help');

    if (cmd === 'complete') {
      this.getCompletion(args.slice(3)).then(x => console.log((x || []).join(' ')));
      return;
    }

    if (hasCmd) {
      try {
        const prog = Execute.loadSinglePlugin(cmd).init();
        if (wantsHelp) {
          Util.showHelp(prog);
        }
      } catch (err) {
        Util.showHelp(commander, `Unknown command ${cmd}`);
      }
    } else {
      Execute.loadAllPlugins().map(x => x.init());
      if (!cmd || wantsHelp) {
        Util.showHelp(commander);
      }
    }

    commander.parse(args);
  }
};

module.exports = { Execute };