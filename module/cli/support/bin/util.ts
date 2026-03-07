import { RuntimeIndex, Runtime } from '@travetto/runtime';
import type { ServiceDescriptor } from '../../__index__.ts';

export async function getServices(services: string[]): Promise<ServiceDescriptor[]> {
  return (await Promise.all(
    RuntimeIndex.find({
      module: module => module.roles.includes('std'),
      folder: folder => folder === 'support',
      file: file => /support\/service[.]/.test(file.sourceFile)
    })
      .map(file => Runtime.importFrom<{ service: ServiceDescriptor }>(file.import).then(value => value.service))
  ))
    .filter(file => !!file)
    .filter(file => services?.length ? services.includes(file.name) : true)
    .toSorted((a, b) => a.name.localeCompare(b.name));
}