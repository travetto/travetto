import * as rl from 'readline';
import * as timers from 'timers/promises';

import { CliCommand } from '@travetto/cli/src/command';
import { color } from '@travetto/boot';

import { ServiceUtil } from '../support/bin/service';

/**
 * `npx trv service`
 *
 * Allows for running services
 */
export class CliServiceCommand extends CliCommand<{}> {
  name = 'command:service';

  getArgs(): string {
    return '[start|stop|restart|status] [...services]';
  }

  async action(mode: 'start' | 'stop' | 'status' | 'restart', services: string[]): Promise<void> {
    const all = (await ServiceUtil.findAll())
      .filter(x => services && services.length && !services.includes('all') ? services.includes(x.name) : true)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!all.length) {
      this.showHelp('', '\nNo services found\n');
    }

    if (!mode) {
      const list = all.map(x => color` * ${{ identifier: x.name }}@${{ type: x.version }}`);
      await this.showHelp(undefined,
        color`\n${{ title: '   Available Services' }}\n${'-'.repeat(20)}\n${list.join('\n')}\n`);
    }

    const maxName = Math.max(...all.map(x => x.name.length), 'Service'.length) + 3;
    const maxVersion = Math.max(...all.map(x => x.version.length), 'Version'.length) + 3;

    if (process.stdout.isTTY) {
      process.stdout.write('\x1B[?25l\n');
    }
    console.log(color`   ${{ title: 'Service'.padEnd(maxName) }} ${{ title: 'Version'.padEnd(maxVersion) }} ${{ title: 'Status' }}`);
    console.log('-'.repeat(maxName + maxVersion + 20));
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
          if (process.stdout.isTTY) {
            if (c > 0) {
              await timers.setTimeout(500);
            }
            c += 1;
            rl.moveCursor(process.stdout, 0, i - y);
            rl.clearLine(process.stdout, 1);
            y = i + 1;
            console.log(color` * ${{ identifier: svc.name.padEnd(maxName) }} ${{ type: svc.version.padStart(maxVersion - 3).padEnd(maxVersion) }} ${line}`);
          } else {
            return color` * ${{ identifier: svc.name.padEnd(maxName) }} ${{ type: svc.version.padStart(maxVersion - 3).padEnd(maxVersion) }} ${line}`;
          }
        }
      });

    const resolved = await Promise.allSettled(promises);
    if (process.stdout.isTTY) {
      rl.moveCursor(process.stdout, 0, all.length - y);
      process.stdout.write('\x1B[?25h\n');
    } else {
      for (const res of resolved) {
        if (res.status === 'fulfilled') {
          console.log(res.value);
        } else {
          console.log(res.reason);
        }
      }
    }
  }
}

