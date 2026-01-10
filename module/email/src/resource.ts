import { AppError, Env, FileLoader, Runtime, RuntimeIndex } from '@travetto/runtime';

/** Build a resource loader that looks into a module and it's dependencies */
export class EmailResourceLoader extends FileLoader {
  constructor(module: string, globalResources?: string[]) {
    const found = RuntimeIndex.getModule(module);
    if (!found) {
      throw new AppError(`Unknown module - ${module}`, { category: 'notfound', details: { module } });
    }
    super([
      ...Env.TRV_RESOURCES.list ?? [],
      `${module}#resources`,
      ...RuntimeIndex.getDependentModules(found, 'children').map(indexedMod => `${indexedMod.name}#resources`),
      '@@#resources',
      ...globalResources ?? []
    ].map(name => Runtime.modulePath(name)));
  }
}