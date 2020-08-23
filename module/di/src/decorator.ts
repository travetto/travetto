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
export function Injectable(first?: Partial<InjectableConfig<any>> | symbol, ...args: (Partial<InjectableConfig<any>> | undefined)[]): ClassDecorator {
  return (target: Class | any) => {
    const config = extractSymbolOrConfig([first, ...args]) as Partial<InjectableConfig<any>>;

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
export function Inject(first?: InjectConfig | symbol, ...args: (InjectConfig | undefined)[]): ParameterDecorator & PropertyDecorator {

  return (target: any, propertyKey: string | symbol, idx?: number) => {
    if (typeof idx !== 'number') { // Only register if on property
      const config: InjectConfig = extractSymbolOrConfig([first, ...args]);

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
export function InjectableFactory(first?: Partial<InjectableFactoryConfig<any>> | symbol,
  ...args: (Partial<InjectableFactoryConfig<any>> | undefined)[]): MethodDecorator {

  return (target: any, property: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
    const config: InjectableFactoryConfig<any> = extractSymbolOrConfig([first, ...args]);
    DependencyRegistry.registerFactory({
      ...config,
      dependencies: config.dependencies?.map(x => extractSymbolOrConfig(x as unknown as any[])),
      fn: descriptor.value,
      id: `${target.ᚕid}#${property.toString()}`
    });
  };
}