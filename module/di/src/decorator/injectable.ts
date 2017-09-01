import { Class, InjectableConfig, Dependency } from '../types';
import { DependencyRegistry, DEFAULT_INSTANCE } from '../service';

export function Injectable(config: Partial<InjectableConfig<any> & { autoCreate?: boolean }> = {}): ClassDecorator {
  return (target: Class | any) => {
    config.class = target;
    if (typeof config.autoCreate === 'boolean') {
      config.autoCreate = { create: config.autoCreate } as any;
    }
    DependencyRegistry.finalizeClass(config as any as InjectableConfig<any>);
    return target;
  };
}

export type InjectConfig = { name?: string, optional?: boolean };

export function Inject(configs: InjectConfig[]): MethodDecorator;
export function Inject(config?: InjectConfig): PropertyDecorator;
export function Inject(config: (InjectConfig | undefined) | InjectConfig[]): MethodDecorator | PropertyDecorator {
  return (target: any, propertyKey: string, descriptor?: TypedPropertyDescriptor<any>) => {
    if (!descriptor) {
      DependencyRegistry.registerProperty(target, propertyKey, config as any as Dependency);
    } else if (propertyKey === 'constructor') {
      DependencyRegistry.registerConstructor(target, config as any as Dependency[]);
    }
  };
}