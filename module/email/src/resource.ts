import { AppError, Env, FileLoader, Runtime, RuntimeIndex } from '@travetto/runtime';

/** Build a resource loader that looks into a module and it's dependencies */
export class EmailResourceLoader extends FileLoader {
  constructor(module: string, globalResources?: string[]) {
    const mod = RuntimeIndex.getModule(module);
    if (!mod) {
      throw new AppError(`Unknown module - ${module}`, { category: 'notfound', details: { module } });
    }
    super([
      ...Env.TRV_RESOURCES.list ?? [],
      `${module}#resources`,
      ...RuntimeIndex.getDependentModules(mod, 'children').map(x => `${x.name}#resources`),
      '@@#resources',
      ...globalResources ?? []
    ].map(v => Runtime.modulePath(v)));
  }
}