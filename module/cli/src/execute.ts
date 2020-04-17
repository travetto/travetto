
import * as commander from 'commander';
import * as fs from 'fs';
import { FsUtil } from '@travetto/boot';

import { Util, CompletionConfig } from './util';

commander.version(require('../package.json').version);

const PREFIX = 'travetto-cli';

export class Execute {

  static getPluginMapping() {
    const all: Record<string, string> = {};
    const ROOT_DIR = `${FsUtil.cwd}/node_modules/@travetto`;
    if (fs.existsSync(ROOT_DIR)) { // If installed and not a dev checkout
      const folders = fs.readdirSync(ROOT_DIR)
        .map(x => `${ROOT_DIR}/${x}/bin`)
        .filter(x => fs.existsSync(x));

      for (const folder of folders) {
        const files = fs.readdirSync(folder)
          .filter(x => x.startsWith(PREFIX));

        for (const f of files) {
          all[f.replace(/[.]ts$/, '')] = `${folder}/${f}`;
        }
      }
    }
    const LOCAL_BIN = `${FsUtil.cwd}/bin`; // Support local dev
    if (fs.existsSync(LOCAL_BIN)) {
      const files = fs.readdirSync(LOCAL_BIN)
        .filter(x => x.startsWith(PREFIX));

      for (const f of files) {
        all[f.replace(/[.]ts$/, '')] = `${LOCAL_BIN}/${f}`;
      }
    }
    return all;
  }

  static requireModule(f: string) {
    return require(FsUtil.toUnix(fs.realpathSync(f)));
  }

  static loadAllPlugins() {
    return Object.values(this.getPluginMapping()).map(f => this.requireModule(f));
  }

  static loadSinglePlugin(cmd: string) {
    const mapping = this.getPluginMapping();
    const command = `${PREFIX}-${cmd.replace(/:/g, '_')}`;
    return this.requireModule(mapping[command]);
  }

  static async getCompletion(args: string[]) {
    const compl: CompletionConfig = { all: [], task: {} };

    const cmd = args.shift() ?? '';
    await Promise.all(this.loadAllPlugins().map(x => x.complete(compl)));

    let last = cmd;
    let opts: string[] = [];

    if (!compl.task[cmd]) {
      opts = compl.all;
    } else {
      last = args.pop() ?? '';
      const second = args.pop() ?? '';
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
      this.getCompletion(args.slice(3)).then(x => console.log((x ?? []).join(' ')));
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