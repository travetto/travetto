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

export function Inject(config?: InjectConfig) {
  return (target: any, propertyKey: string | symbol, idx?: number) => {
    if (typeof idx !== 'number') { // Only register if on property
      DependencyRegistry.registerProperty(
        target.constructor,
        propertyKey as string,
        config as any as Dependency);
    }
  };
}

export function InjectableFactory(config: { class: Class<any>, qualifier: symbol, autoCreate?: boolean, dependencies?: Dependency[] }): MethodDecorator {
  return (target: any, property: string | symbol, descriptor: TypedPropertyDescriptor<any>) => {
    console.log('Injecting', target, config);

    const finalConfig: InjectableConfig<any> = {} as any;
    if (typeof config.autoCreate === 'boolean') {
      finalConfig.autoCreate = { create: config.autoCreate } as any;
    }
    finalConfig.factory = descriptor.value!;
    finalConfig.target = config.class;
    finalConfig.qualifier = config.qualifier;

    if (config.dependencies) {
      finalConfig.dependencies = {
        cons: config.dependencies,
        fields: {}
      }
    }

    // Create mock cls for DI purposes
    const cls = { __id: `${target.__id}#${property}` } as any;

    finalConfig.class = cls;
    DependencyRegistry.registerClass(cls, finalConfig);
  };
}