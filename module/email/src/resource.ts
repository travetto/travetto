import { AppError, Env, FileLoader, RuntimeContext } from '@travetto/base';
import { RuntimeIndex } from '@travetto/manifest';

/** Build a resource loader that looks into a module and it's dependencies */
export class EmailResourceLoader extends FileLoader {
  constructor(module: string, globalResources?: string[]) {
    const mod = RuntimeIndex.getModule(module);
    if (!mod) {
      throw new AppError(`Unknown module - ${module}`, 'notfound', { module });
    }
    super(RuntimeContext.modulePaths([
      ...Env.TRV_RESOURCES.list ?? [],
      `${module}#resources`,
      ...RuntimeIndex.getDependentModules(mod, 'children').map(x => `${x.name}#resources`),
      '@@#resources',
      ...globalResources ?? []
    ]));
  }
}