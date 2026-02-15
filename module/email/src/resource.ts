import { RuntimeError, Env, FileLoader, Runtime, RuntimeIndex } from '@travetto/runtime';

/** Build a resource loader that looks into a module and it's dependencies */
export class EmailResourceLoader extends FileLoader {
  constructor(moduleName: string, globalResources?: string[]) {
    const found = RuntimeIndex.getModule(moduleName);
    if (!found) {
      throw new RuntimeError(`Unknown module - ${moduleName}`, { category: 'notfound', details: { module: moduleName } });
    }
    super([
      ...Env.TRV_RESOURCES.list ?? [],
      `${moduleName}#resources`,
      ...RuntimeIndex.getDependentModules(found, 'children').map(module => `${module.name}#resources`),
      '@@#resources',
      ...globalResources ?? []
    ].map(name => Runtime.modulePath(name)));
  }
}