import { stripVTControlCharacters } from 'node:util';

import { type CliCommandShape, CliCommand, cliTpl } from '@travetto/cli';
import { Terminal } from '@travetto/terminal';
import { AsyncQueue, Util } from '@travetto/runtime';
import { MethodValidator, type ValidationError } from '@travetto/schema';

import { ServiceRunner, type ServiceAction } from '../src/service.ts';

async function validateService(_: ServiceAction, services: string[]): Promise<ValidationError | undefined> {
  const all = await ServiceRunner.findServices(services);

  if (!all.length) {
    return { message: 'No services found', source: 'arg', kind: 'invalid', path: 'services' };
  }
}

/**
 * Allows for running services
 */
@CliCommand()
export class CliServiceCommand implements CliCommandShape {

  quiet = false;

  async help(): Promise<string[]> {
    const all = await ServiceRunner.findServices([]);
    return [
      cliTpl`${{ title: 'Available Services' }}`,
      '-'.repeat(20),
      ...all.map(service => cliTpl` * ${{ identifier: service.name }}@${{ type: service.version }}`)
    ];
  }

  @MethodValidator(validateService)
  async main(action: ServiceAction, services: string[] = []): Promise<void> {
    const all = await ServiceRunner.findServices(services);
    const maxName = Math.max(...all.map(service => service.name.length), 'Service'.length) + 3;
    const maxVersion = Math.max(...all.map(service => `${service.version}`.length), 'Version'.length) + 3;
    const maxStatus = 20;
    const queue = new AsyncQueue<{ idx: number, text: string, done?: boolean }>();

    const failureMessages: string[] = [];

    const jobs = all.map(async (descriptor, i) => {
      const identifier = descriptor.name.padEnd(maxName);
      const type = `${descriptor.version}`.padStart(maxVersion - 3).padEnd(maxVersion);
      let message: string;
      for await (const [valueType, value] of new ServiceRunner(descriptor).action(action)) {
        const details = { [valueType === 'message' ? 'subtitle' : valueType]: value };
        queue.add({ idx: i, text: message = cliTpl`${{ identifier }} ${{ type }} ${details}` });
        if (valueType === 'failure') {
          failureMessages.push(message);
        }
      }
      queue.add({ idx: i, done: true, text: message! });
    });

    Promise.all(jobs).then(() => Util.queueMacroTask()).then(() => queue.close());


    if (this.quiet) {
      for await (const _ of queue) { }
      if (failureMessages.length) {
        console.error('Failure');
        failureMessages.map(stripVTControlCharacters).map(item => console.error(item));
      }
    } else {
      const term = new Terminal();
      await term.writer.writeLines([
        '',
        cliTpl`${{ title: 'Service'.padEnd(maxName) }} ${{ title: 'Version'.padEnd(maxVersion) }} ${{ title: 'Status' }}`,
        ''.padEnd(maxName + maxVersion + maxStatus + 3, '-'),
      ]).commit();

      await term.streamList(queue);
    }

    process.exitCode = failureMessages.length ? 1 : 0;
  }
}