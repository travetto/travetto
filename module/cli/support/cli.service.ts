import { CliCommandShape, CliCommand, cliTpl, CliValidationError } from '@travetto/cli';
import { Terminal } from '@travetto/terminal';
import { AsyncQueue, Runtime, RuntimeIndex, TypedObject, Util } from '@travetto/runtime';

import { ServiceRunner, ServiceDescriptor } from '../src/service';

type ServiceAction = 'start' | 'stop' | 'restart' | 'status';

/**
 * Allows for running services
 */
@CliCommand()
export class CliServiceCommand implements CliCommandShape {

  async #getServices(services: string[]): Promise<ServiceDescriptor[]> {
    return (await Promise.all(
      RuntimeIndex.find({
        module: m => m.roles.includes('std'),
        folder: f => f === 'support',
        file: f => /support\/service[.]/.test(f.sourceFile)
      })
        .map(x => Runtime.importFrom<{ service: ServiceDescriptor }>(x.import).then(v => v.service))
    ))
      .filter(x => !!x)
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
    const q = new AsyncQueue<{ idx: number, text: string, done?: boolean }>();

    const jobs = all.map(async (v, i) => {
      for await (const item of new ServiceRunner(v).action(action)) {
        const [[valueType, value]] = TypedObject.entries(item);
        const identifier = v.name.padEnd(maxName);
        const type = `${v.version}`.padStart(maxVersion - 3).padEnd(maxVersion);
        const details = { [valueType === 'message' ? 'subtitle' : valueType]: value };
        q.add({ idx: i, text: cliTpl`${{ identifier }} ${{ type }} ${details}` });
      }
    });

    Promise.all(jobs).then(() => Util.queueMacroTask()).then(() => q.close());

    const term = new Terminal();
    await term.writer.writeLines([
      '',
      cliTpl`${{ title: 'Service'.padEnd(maxName) }} ${{ title: 'Version'.padEnd(maxVersion) }} ${{ title: 'Status' }}`,
      ''.padEnd(maxName + maxVersion + maxStatus + 3, '-'),
    ]).commit();

    await term.streamList(q);
  }
}