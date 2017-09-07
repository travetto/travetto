import { Class, InjectableConfig, Dependency } from '../types';
import { DependencyRegistry, DEFAULT_INSTANCE } from '../service';

export function Injectable(config: Partial<InjectableConfig<any>> = {}): ClassDecorator {
  return (target: Class | any) => {
    config.class = target;
    if (typeof config.autoCreate === 'boolean') {
      config.autoCreate = { create: config.autoCreate } as any;
    }
    DependencyRegistry.registerClass(config as any as InjectableConfig<any>);
    return target;
  };
}

export type InjectConfig = { name?: string, optional?: boolean };

export function InjectArgs(configs?: InjectConfig[]): ClassDecorator {
  return (target: any) => {
    DependencyRegistry.registerConstructor(target, configs as any as Dependency[]);
  };
}

export function Inject(config?: InjectConfig): PropertyDecorator {
  return (target: any, propertyKey: string) => {
    DependencyRegistry.registerProperty(target.constructor, propertyKey, config as any as Dependency);
  };
}