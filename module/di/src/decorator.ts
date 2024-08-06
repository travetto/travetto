import type { Class, ClassInstance } from '@travetto/runtime';

import { InjectableFactoryConfig, InjectableConfig, Dependency } from './types';
import { DependencyRegistry, ResolutionType } from './registry';

function collapseConfig<T extends { qualifier?: symbol }>(...args: (symbol | Partial<InjectConfig> | undefined)[]): T {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      out = args as T;
    }
  }
  return out;
}

/**
 * Indicate that a class is able to be injected
 *
 * @augments `@travetto/di:Injectable`
 */
export function Injectable(first?: Partial<InjectableConfig> | symbol, ...args: (Partial<InjectableConfig> | undefined)[]) {
  return <T extends Class>(target: T): T => {
    const config = {
      ...collapseConfig<Partial<InjectableConfig>>(first, ...args),
      class: target
    };
    DependencyRegistry.registerClass(target, config);
    return target;
  };
}

export type InjectConfig = { qualifier?: symbol, optional?: boolean, resolution?: ResolutionType };

export function InjectArgs(configs?: InjectConfig[][]) {
  return <T extends Class>(target: T): void => {
    DependencyRegistry.registerConstructor(target,
      configs?.map(x => collapseConfig(...x)));
  };
}

/**
 * Indicate that a field is able to be injected
 *
 * @augments `@travetto/di:Inject`
 */
export function Inject(first?: InjectConfig | symbol, ...args: (InjectConfig | undefined)[]) {
  return (target: unknown, propertyKey?: string, idx?: number | PropertyDescriptor): void => {
    if (typeof idx !== 'number') { // Only register if on property
      const config: InjectConfig = collapseConfig(first, ...args);

      DependencyRegistry.registerProperty(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        (target as ClassInstance).constructor, propertyKey!, config as Dependency
      );
    }
  };
}

/**
 * Identifies a static method that is able to produce a dependency
 *
 * @augments `@travetto/di:InjectableFactory`
 */
export function InjectableFactory(first?: Partial<InjectableFactoryConfig> | symbol, ...args: (Partial<InjectableFactoryConfig> | undefined)[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <T extends Class>(target: T, property: string | symbol, descriptor: TypedPropertyDescriptor<((..._: any[]) => any)>): void => {
    const config: InjectableFactoryConfig = collapseConfig(first, ...args);
    DependencyRegistry.registerFactory({
      ...config,
      dependencies: config.dependencies?.map(x => Array.isArray(x) ? collapseConfig(...x) : collapseConfig(x)),
      fn: descriptor.value!,
      id: `${target.Ⲑid}#${property.toString()}`
    });
  };
}