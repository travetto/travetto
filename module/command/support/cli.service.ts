import { CliCommand, cliTpl } from '@travetto/cli';
import { GlobalOutput } from '@travetto/terminal';

import { ServiceAction, ServiceUtil } from './bin/service';

/**
 * `npx trv service`
 *
 * Allows for running services
 */
export class CliServiceCommand extends CliCommand<{}> {
  name = 'service';

  getArgs(): string {
    return '[start|stop|restart|status] [...services]';
  }

  async action(action: ServiceAction, services: string[]): Promise<void> {
    const all = (await ServiceUtil.findAll())
      .filter(x => services?.length ? services.includes(x.name) : true)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!all.length) {
      this.showHelp('', '\nNo services found\n');
    }

    if (!action) {
      const list = all.map(x => cliTpl` * ${{ identifier: x.name }}@${{ type: x.version }}`);
      await this.showHelp(undefined,
        cliTpl`\n${{ title: '   Available Services' }}\n${'-'.repeat(20)}\n${list.join('\n')}`);
    }

    const maxName = Math.max(...all.map(x => x.name.length), 'Service'.length) + 3;
    const maxVersion = Math.max(...all.map(x => x.version.length), 'Version'.length) + 3;

    await GlobalOutput.makeList(
      ServiceUtil.triggerServices(action, all),
      ({ svc, statusText, status, idx }) => ({
        idx,
        text: cliTpl` * ${{ identifier: svc.name.padEnd(maxName) }} ${{ type: svc.version.padStart(maxVersion - 3).padEnd(maxVersion) }} ${statusText}`,
        done: status === 'started'
      }),
      {
        header: [
          '',
          cliTpl`   ${{ title: 'Service'.padEnd(maxName) }} ${{ title: 'Version'.padEnd(maxVersion) }} ${{ title: 'Status' }}`,
          '-'.repeat(maxName + maxVersion + 20)
        ]
      });
  }
}

