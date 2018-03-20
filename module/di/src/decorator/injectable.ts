import { InjectableConfig, Dependency } from '../types';
import { DependencyRegistry, DEFAULT_INSTANCE } from '../service';
import { Class } from '@travetto/registry';

export function Injectable(config: Partial<InjectableConfig<any>> = {}): ClassDecorator {
  return (target: Class | any) => {
    config.class = target;
    if (typeof config.autoCreate === 'boolean') {
      config.autoCreate = { create: config.autoCreate } as any;
    }
    DependencyRegistry.registerClass(target, config as any as InjectableConfig<any>);
    return target;
  };
}

export type InjectConfig = { qualifier?: symbol, optional?: boolean };

export function InjectArgs(configs?: InjectConfig[]): ClassDecorator {
  return (target: any) => {
    DependencyRegistry.registerConstructor(target, configs as any as Dependency[]);
  };
}

export function Inject(config?: InjectConfig): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    DependencyRegistry.registerProperty(
      target.constructor,
      propertyKey as string,
      config as any as Dependency);
  };
}