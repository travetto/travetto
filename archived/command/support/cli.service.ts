import { CliCommandShape, CliCommand, cliTpl, CliValidationError } from '@travetto/cli';
import { Terminal } from '@travetto/terminal';
import { Util } from '@travetto/runtime';

import { CommandService } from '../src/types';

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

  async validate(action: ServiceAction, services: string[]): Promise<CliValidationError | undefined> {
    const all = await this.#getServices(services);

    if (!all.length) {
      return { message: 'No services found' };
    }
  }

  async help(): Promise<string[]> {
    const all = await this.#getServices([]);
    return [
      cliTpl`${{ title: 'Available Services' }}`,
      '-'.repeat(20),
      ...all.map(x => cliTpl` * ${{ identifier: x.name }}@${{ type: x.version }}`)
    ];
  }

  async main(action: ServiceAction, services: string[] = []): Promise<void> {
    const all = await this.#getServices(services);
    const maxName = Math.max(...all.map(x => x.name.length), 'Service'.length) + 3;
    const maxVersion = Math.max(...all.map(x => `${x.version}`.length), 'Version'.length) + 3;
    const maxStatus = 20;

    const resolved = Util.mapAsyncIterable(ServiceUtil.triggerServices(action, all), ({ svc, statusText, status, idx }) => ({
      idx,
      text: cliTpl`${{ identifier: svc.name.padEnd(maxName) }} ${{ type: `${svc.version}`.padStart(maxVersion - 3).padEnd(maxVersion) }} ${statusText}`,
      done: status === 'started'
    }));

    const term = new Terminal();
    await term.writer.writeLines([
      '',
      cliTpl`${{ title: 'Service'.padEnd(maxName) }} ${{ title: 'Version'.padEnd(maxVersion) }} ${{ title: 'Status' }}`,
      ''.padEnd(maxName + maxVersion + maxStatus + 3, '-'),
    ]).commit();

    await term.streamList(resolved);
  }
}