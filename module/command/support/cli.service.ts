import { BaseCliCommand, CliCommand, CliHelp, cliTpl } from '@travetto/cli';
import { MinLength } from '@travetto/schema';
import { GlobalTerminal } from '@travetto/terminal';

import { ServiceUtil } from './bin/service';
import { ServiceAction } from './bin/types';

/**
 * `npx trv service`
 *
 * Allows for running services
 */
@CliCommand()
export class CliServiceCommand implements BaseCliCommand {

  async action(action: ServiceAction, @MinLength(0) services: string[]): Promise<CliHelp | void> {
    const all = (await ServiceUtil.findAll())
      .filter(x => services?.length ? services.includes(x.name) : true)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!all.length) {
      return new CliHelp('No services found\n');
    }

    if (!action) {
      const list = all.map(x => cliTpl` * ${{ identifier: x.name }}@${{ type: x.version }}`);
      return new CliHelp(cliTpl`\n${{ title: '   Available Services' }}\n${'-'.repeat(20)}\n${list.join('\n')}`);
    }

    const maxName = Math.max(...all.map(x => x.name.length), 'Service'.length) + 3;
    const maxVersion = Math.max(...all.map(x => `${x.version}`.length), 'Version'.length) + 3;
    const maxStatus = 20;

    await GlobalTerminal.streamList(
      ServiceUtil.triggerServices(action, all),
      ({ svc, statusText, status, idx }) => ({
        idx,
        text: cliTpl`${{ identifier: svc.name.padEnd(maxName) }} ${{ type: `${svc.version}`.padStart(maxVersion - 3).padEnd(maxVersion) }} ${statusText}`,
        done: status === 'started'
      }),
      {
        header: [
          '',
          cliTpl`${{ title: 'Service'.padEnd(maxName) }} ${{ title: 'Version'.padEnd(maxVersion) }} ${{ title: 'Status' }}`,
          ''.padEnd(maxName + maxVersion + maxStatus + 3, '-')
        ],
        forceNonInteractiveOrder: !process.stdout.isTTY
      });
  }
}