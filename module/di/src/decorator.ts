import { Class } from '@travetto/registry';

import { InjectableFactoryConfig, InjectableConfig, Dependency } from './types';
import { DependencyRegistry } from './registry';

function extractSymbolOrConfig<T extends { qualifier?: symbol }>(args: any[]) {
  let out = {} as T;
  if (args) {
    if (Array.isArray(args)) {
      for (const arg of args) {
        if (typeof arg === 'symbol') {
          out.qualifier = arg;
        } else if (arg) {
          Object.assign(out, arg);
        }
      }
    } else {
      out = args as T;
    }
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

export type InjectConfig = { qualifier?: symbol, optional?: boolean };

export function InjectArgs(configs?: InjectConfig[][]): ClassDecorator {
  return (target: any) => {
    DependencyRegistry.registerConstructor(target,
      configs?.map(x => extractSymbolOrConfig(x)));
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
        config as Dependency);
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
    DependencyRegistry.registerFactory({
      ...config,
      dependencies: config.dependencies?.map(x => extractSymbolOrConfig(x as any)),
      fn: descriptor.value,
      id: `${target.ᚕid}#${property.toString()}`
    });
  };
}