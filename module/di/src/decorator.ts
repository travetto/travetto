import { asFull, TypedFunction, type Class } from '@travetto/runtime';

import { InjectableConfig, Dependency } from './types.ts';
import { DependencyRegistryIndex } from './registry/registry-index.ts';
import { ResolutionType } from './registry/types.ts';

function collapseConfig<T extends { qualifier?: symbol }>(...args: (symbol | Partial<InjectConfig> | undefined)[]): T {
  let out: Partial<T> = {};
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
      out = args;
    }
  }
  return asFull(out);
}

/**
 * Indicate that a class is able to be injected
 *
 * @augments `@travetto/di:Injectable`
 * @augments `@travetto/schema:Schema`
 */
export function Injectable(first?: Partial<InjectableConfig> | symbol, ...args: (Partial<InjectableConfig> | undefined)[]) {
  return <T extends Class>(target: T): T => {
    const config = {
      ...collapseConfig<Partial<InjectableConfig>>(first, ...args),
      class: target
    };
    DependencyRegistryIndex.getForRegister(target).register(config);
    return target;
  };
}

export type InjectConfig = { qualifier?: symbol, optional?: boolean, resolution?: ResolutionType };

export function InjectArgs(configs?: InjectConfig[][]) {
  return <T extends Class>(target: T): void => {
    DependencyRegistryIndex.getForRegister(target).register({
      dependencies: {
        fields: {},
        cons: configs?.map(x => collapseConfig(...x))
      }
    });
  };
}

/**
 * Indicate that a field is able to be injected
 *
 * @augments `@travetto/di:Inject`
 */
export function Inject(first?: InjectConfig | symbol, ...args: (InjectConfig | undefined)[]) {
  return (target: unknown, propertyKey?: string | symbol, idx?: number | PropertyDescriptor): void => {
    if (typeof idx !== 'number') { // Only register if on property
      const config = collapseConfig<Dependency>(first, ...args);
      DependencyRegistryIndex.getForRegister(target).register({
        dependencies: {
          fields: { [propertyKey!]: config }
        }
      });
    }
  };
}

/**
 * Identifies a static method that is able to produce a dependency
 *
 * @augments `@travetto/di:InjectableFactory`
 * @augments `@travetto/schema:Schema`
 */
export function InjectableFactory(first?: Partial<InjectableConfig> | symbol, ...args: (Partial<InjectableConfig> | undefined)[]) {
  return <T extends Class>(target: T, property: string | symbol, descriptor: TypedPropertyDescriptor<TypedFunction>): void => {
    const config: InjectableConfig = collapseConfig(first, ...args);

    // Create mock cls for DI purposes
    const id = `${target.Ⲑid}#${property.toString()}`;
    const fnClass = class { static Ⲑid = id; };

    DependencyRegistryIndex.getForRegister(fnClass).register({
      ...config,
      dependencies: {
        fields: {},
        cons: config.dependencies?.cons?.map(x => Array.isArray(x) ? collapseConfig(...x) : collapseConfig(x)) ?? [],
      },
      factory: descriptor.value!,
    });
  };
}