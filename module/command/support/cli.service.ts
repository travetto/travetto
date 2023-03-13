import { CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';
import { ValidationError } from '@travetto/schema';
import { GlobalTerminal } from '@travetto/terminal';
import { CommandService } from '../__index__';

import { ServiceUtil } from './bin/service';
import { ServiceAction } from './bin/types';

/**
 * Allows for running services
 */
@CliCommand()
export class CliServiceCommand implements CliCommandShape {

  async #getServices(services: string[]): Promise<CommandService[]> {
    return (await ServiceUtil.findAll())
      .filter(x => services?.length ? services.includes(x.name) : true)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async validate(action: string, services: string[]): Promise<ValidationError | undefined> {
    const all = await this.#getServices(services);

    if (!all.length) {
      return {
        message: 'No services found',
        kind: 'required',
        path: 'services'
      };
    }
  }

  async help(): Promise<string> {
    const all = await this.#getServices([]);
    const list = all.map(x => cliTpl` * ${{ identifier: x.name }}@${{ type: x.version }}`);
    return cliTpl`\n${{ title: '   Available Services' }}\n${'-'.repeat(20)}\n${list.join('\n')}`;
  }

  async main(action: ServiceAction, services: string[] = []): Promise<void> {
    const all = await this.#getServices(services);
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