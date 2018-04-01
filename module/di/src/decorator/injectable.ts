import { InjectableConfig, Dependency } from '../types';
import { DependencyRegistry, DEFAULT_INSTANCE } from '../service';
import { Class } from '@travetto/registry';
import { InjectableFactoryConfig } from '..';

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

function extractSymbolOrConfig<T extends { qualifier?: Symbol }>(args: any[]) {
  const out = {} as T;
  if (args) {
    let extra = args[0];
    if (typeof extra === 'symbol') {
      out.qualifier = extra;
      extra = args[1];
    }
    Object.assign(out, extra);
  }
  return out;
}

export function Inject(symbol: symbol, config?: InjectConfig): ParameterDecorator & PropertyDecorator;
export function Inject(config?: InjectConfig): ParameterDecorator & PropertyDecorator;
export function Inject(...args: any[]): ParameterDecorator & PropertyDecorator {

  const config: InjectConfig = extractSymbolOrConfig(args);

  return (target: any, propertyKey: string | symbol, idx?: number) => {
    if (typeof idx !== 'number') { // Only register if on property
      DependencyRegistry.registerProperty(
        target.constructor,
        propertyKey as string,
        (typeof config === 'symbol' ? { qualifier: config } : config) as any as Dependency);
    }
  };
}

export function InjectableFactory(config: InjectableFactoryConfig<any>): MethodDecorator;
export function InjectableFactory(symbol: symbol, config?: InjectableFactoryConfig<any>): MethodDecorator;
export function InjectableFactory(...args: any[]): MethodDecorator {

  const config: InjectableFactoryConfig<any> = extractSymbolOrConfig(args);

  return (target: any, property: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
    DependencyRegistry.registerFactory({ ...config, fn: descriptor.value, id: `${target.__id}#${property}` });
  };
}