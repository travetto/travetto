import { AppError, Env, FileLoader } from '@travetto/base';
import { RuntimeIndex } from '@travetto/manifest';

/** Build a resource loader that looks into a module and it's dependencies */
export class EmailResourceLoader extends FileLoader {
  constructor(module: string, globalResources?: string[]) {
    const mod = RuntimeIndex.getModule(module);
    if (!mod) {
      throw new AppError('Unknown module', 'notfound', { module });
    }
    super([
      ...Env.TRV_RESOURCES.list ?? [],
      '@#resources',
      ...RuntimeIndex.getDependentModules(mod, 'children').map(x => `${x.name}#resources`),
      '@@#resources',
      ...globalResources ?? []
    ]);
  }
}