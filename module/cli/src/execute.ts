
import { Command } from 'commander';
import * as fs from 'fs';
import { FsUtil } from '@travetto/boot';

import { Util, CompletionConfig } from './util';

const commander = new Command();
commander.version(require('../package.json').version);

const PREFIX = 'travetto-cli';

export class Execute {
  static requireModule(f: string) {
    let p = FsUtil.toUnix(fs.realpathSync(`${FsUtil.cwd}/node_modules/.bin/${f}`));
    if (!p.startsWith(FsUtil.cwd)) {
      p = `${FsUtil.cwd}/node_modules/@travetto/${p.split(/travetto[^/]*\/module\//)[1]}`;
    }
    const res = require(p);
    return res;
  }

  static loadAllPlugins() {
    const BIN_DIR = `${FsUtil.cwd}/node_modules/.bin`;
    if (fs.existsSync(BIN_DIR)) {
      const files = fs.readdirSync(BIN_DIR).filter(x => x.startsWith(`${PREFIX}-`));
      const all = [];
      for (const f of files) {
        all.push(this.requireModule(f));
      }
      return all;
    }
    return [];
  }

  static loadSinglePlugin(cmd: string) {
    return this.requireModule(`${PREFIX}-${cmd.replace(/:/g, '_')}`);
  }

  static async getCompletion(args: string[]) {
    const compl: CompletionConfig = { all: [], task: {} };

    const cmd = args.shift() || '';
    await Promise.all(this.loadAllPlugins().map(x => x.complete(compl)));

    let last = cmd;
    let opts = [];

    if (!compl.task[cmd]) {
      opts = compl.all;
    } else {
      last = args.pop() || '';
      const second = args.pop() || '';
      let flag = '';

      if (last in compl.task[cmd]) {
        flag = last;
        last = '';
      } else if (second in compl.task[cmd]) {
        if (compl.task[cmd][second].includes(last)) {
          flag = '';
          last = '';
        } else {
          flag = second;
        }
      }
      opts = compl.task[cmd][flag];
    }

    return last ? opts.filter(x => x.startsWith(last)) : opts.filter(x => !x.startsWith('-'));
  }

  static async run(args: string[]) {
    const cmd = args[2];
    const hasCmd = cmd && !cmd.startsWith('-');
    const wantsHelp = args.includes('-h') || args.includes('--help');

    if (cmd === 'complete') {
      this.getCompletion(args.slice(3)).then(x => console.log((x || []).join(' ')));
      return;
    }

    if (hasCmd) {
      try {
        const plugin = await this.loadSinglePlugin(cmd);
        if (plugin.setup) {
          await plugin.setup();
        }
        const prog = plugin.init();
        if (wantsHelp) {
          Util.showHelp(prog);
        }
      } catch (err) {
        Util.showHelp(commander, `Unknown command ${cmd}`);
      }
    } else {
      this.loadAllPlugins().map(x => x.init());
      if (!cmd || wantsHelp) {
        Util.showHelp(commander);
      }
    }

    commander.parse(args);
  }
}