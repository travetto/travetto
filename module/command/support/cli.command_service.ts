import { CliCommand } from '@travetto/cli';
import { CliUtil } from '@travetto/boot';

import { ServiceUtil } from './bin/service';

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
      const list = all.map(x => CliUtil.color` * ${{ identifier: x.name }}@${{ type: x.version }}`);
      await this.showHelp(undefined,
        CliUtil.color`\n${{ title: '   Available Services' }}\n${'-'.repeat(20)}\n${list.join('\n')}\n`);
    }

    const maxName = Math.max(...all.map(x => x.name.length), 'Service'.length) + 3;
    const maxVersion = Math.max(...all.map(x => x.version.length), 'Version'.length) + 3;

    const table = CliUtil.table(all.length);

    await table.init(
      '',
      CliUtil.color`   ${{ title: 'Service'.padEnd(maxName) }} ${{ title: 'Version'.padEnd(maxVersion) }} ${{ title: 'Status' }}`,
      '-'.repeat(maxName + maxVersion + 20)
    );

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
        for await (const status of (await message)) {
          const svc = all[i];
          await table.update(
            i,
            CliUtil.color` * ${{ identifier: svc.name.padEnd(maxName) }} ${{ type: svc.version.padStart(maxVersion - 3).padEnd(maxVersion) }} ${status}`
          );
        }
      });

    await Promise.allSettled(promises);

    await table.finish();
  }
}

