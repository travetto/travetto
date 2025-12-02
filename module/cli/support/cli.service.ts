import { CliCommandShape, CliCommand, cliTpl, CliValidationError } from '@travetto/cli';
import { Terminal } from '@travetto/terminal';
import { AsyncQueue, Runtime, RuntimeIndex, Util } from '@travetto/runtime';

import { ServiceRunner, ServiceDescriptor, ServiceAction } from '../src/service.ts';

/**
 * Allows for running services
 */
@CliCommand()
export class CliServiceCommand implements CliCommandShape {

  async #getServices(services: string[]): Promise<ServiceDescriptor[]> {
    return (await Promise.all(
      RuntimeIndex.find({
        module: mod => mod.roles.includes('std'),
        folder: folder => folder === 'support',
        file: file => /support\/service[.]/.test(file.sourceFile)
      })
        .map(x => Runtime.importFrom<{ service: ServiceDescriptor }>(x.import).then(value => value.service))
    ))
      .filter(x => !!x)
      .filter(x => services?.length ? services.includes(x.name) : true)
      .toSorted((a, b) => a.name.localeCompare(b.name));
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
    const queue = new AsyncQueue<{ idx: number, text: string, done?: boolean }>();

    const jobs = all.map(async (descriptor, i) => {
      const identifier = descriptor.name.padEnd(maxName);
      const type = `${descriptor.version}`.padStart(maxVersion - 3).padEnd(maxVersion);
      let msg: string;
      for await (const [valueType, value] of new ServiceRunner(descriptor).action(action)) {
        const details = { [valueType === 'message' ? 'subtitle' : valueType]: value };
        queue.add({ idx: i, text: msg = cliTpl`${{ identifier }} ${{ type }} ${details}` });
      }
      queue.add({ idx: i, done: true, text: msg! });
    });

    Promise.all(jobs).then(() => Util.queueMacroTask()).then(() => queue.close());

    const term = new Terminal();
    await term.writer.writeLines([
      '',
      cliTpl`${{ title: 'Service'.padEnd(maxName) }} ${{ title: 'Version'.padEnd(maxVersion) }} ${{ title: 'Status' }}`,
      ''.padEnd(maxName + maxVersion + maxStatus + 3, '-'),
    ]).commit();

    await term.streamList(queue);
  }
}