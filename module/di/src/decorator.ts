import { Class } from '@travetto/registry';

import { InjectableFactoryConfig, InjectableConfig, Dependency } from './types';
import { DependencyRegistry } from './registry';

function extractSymbolOrConfig<T extends { qualifier?: symbol }>(args: any[]) {
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

/**
 * Indicate that a class is able to be injected
 *
 * @augments `@trv:di/Injectable`
 */
export function Injectable(qualifier: symbol, config?: Partial<InjectableConfig<any>>): ClassDecorator;
export function Injectable(config: Partial<InjectableConfig<any>>): ClassDecorator;
export function Injectable(): ClassDecorator;
export function Injectable(...args: any[]): ClassDecorator {
  return (target: Class | any) => {
    const config = extractSymbolOrConfig(args) as Partial<InjectableConfig<any>>;

    config.class = target;
    DependencyRegistry.registerClass(target, config as InjectableConfig<any>);
    return target;
  };
}

export type InjectConfig = { qualifier?: symbol, optional?: boolean, defaultIfMissing?: Class };

export function InjectArgs(configs?: InjectConfig[]): ClassDecorator {
  return (target: any) => {
    DependencyRegistry.registerConstructor(target, configs as Dependency[]);
  };
}

/**
 * Indicate that a field is able to be injected
 *
 * @augments `@trv:di/Inject`
 */
export function Inject(symbol: symbol, config?: InjectConfig): ParameterDecorator & PropertyDecorator;
export function Inject(config: InjectConfig): ParameterDecorator & PropertyDecorator;
export function Inject(): ParameterDecorator & PropertyDecorator;
export function Inject(...args: any[]): ParameterDecorator & PropertyDecorator {

  return (target: any, propertyKey: string | symbol, idx?: number) => {
    if (typeof idx !== 'number') { // Only register if on property
      const config: InjectConfig = extractSymbolOrConfig(args);

      DependencyRegistry.registerProperty(
        target.constructor,
        propertyKey as string,
        (typeof config === 'symbol' ? { qualifier: config } : config) as Dependency);
    }
  };
}

/**
 * Identifies a static method that is able to produce a dependency
 *
 * @augments `@trv:di/InjectableFactory`
 */
export function InjectableFactory(symbol: symbol, config?: InjectableFactoryConfig<any>): MethodDecorator;
export function InjectableFactory(config: InjectableFactoryConfig<any>): MethodDecorator;
export function InjectableFactory(): MethodDecorator;
export function InjectableFactory(...args: any[]): MethodDecorator {

  return (target: any, property: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
    const config: InjectableFactoryConfig<any> = extractSymbolOrConfig(args);
    DependencyRegistry.registerFactory({ ...config, fn: descriptor.value, id: `${target.__id}#${property.toString()}` });
  };
}