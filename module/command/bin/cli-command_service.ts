import * as commander from 'commander';
import * as rl from 'readline';

import { BasePlugin } from '@travetto/cli/src/plugin-base';
import { ServiceUtil } from './lib/service';
import { color } from '@travetto/cli/src/color';


/**
 * `npx trv service`
 *
 * Allows for running services
 */
export class CliServicePlugin extends BasePlugin {
  name = 'command:service';

  init(cmd: commander.Command) {
    return cmd.arguments('[mode] [...services]');
  }

  async action(mode: string, services: string[]) {
    const all = ServiceUtil.findAll()
      .filter(x => services && services.length && !services.includes('all') ? services.includes(x.name) : true);

    if (all.length) {
      const maxName = Math.max(...all.map(x => x.name.length), 'Service'.length) + 3;
      const maxVersion = Math.max(...all.map(x => x.version.length), 'Version'.length) + 3;

      process.stdout.write('\x1B[?25l\n');
      console.log(color`${{ title: 'Service'.padEnd(maxName) }} ${{ title: 'Version'.padEnd(maxVersion) }} ${{ title: 'Status' }}`);
      console.log('-'.repeat(maxName + maxVersion + 10));
      console.log('\n'.repeat(all.length));

      let y = all.length + 1;

      const promises = all
        .map(async svc => {
          switch (mode) {
            case 'stop': return ServiceUtil.stop(svc);
            case 'start': return ServiceUtil.start(svc);
            case 'restart': return ServiceUtil.restart(svc);
            default: return ServiceUtil.status(svc);
          }
        })
        .map(async (message, i) => {
          const svc = all[i];
          let c = 0;
          for await (const line of (await message)) {
            if (c > 0) {
              await new Promise(r => setTimeout(r, 500));
            }
            c += 1;
            rl.moveCursor(process.stdout, 0, i - y);
            rl.clearLine(process.stdout, 1);
            y = i + 1;
            console.log(color`${{ subtitle: svc.name.padEnd(maxName) }} ${{ path: svc.version.padStart(maxVersion - 3).padEnd(maxVersion) }} ${line}`);
          }
        });

      await Promise.allSettled(promises);
      rl.moveCursor(process.stdout, 0, all.length - y);
      process.stdout.write('\x1B[?25h\n');

    } else {
      console.log(`\nNo services found\n`);
    }
  }
}

