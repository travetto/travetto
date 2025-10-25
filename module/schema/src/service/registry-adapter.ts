import { RegistryAdapter } from '@travetto/registry';
import { Class } from '@travetto/runtime';

import { ClassConfig, MethodConfig, FieldConfig, ParameterConfig, InputConfig } from './types';

function combineInputs<T extends InputConfig>(base: T, ...configs: Partial<T>[]): T {
  for (const config of configs) {
    Object.assign(base, {
      ...config,
      ...config.aliases ? { aliases: [...base.aliases ?? [], ...config.aliases ?? []] } : {},
      ...config.specifiers ? { specifiers: [...base.specifiers ?? [], ...config.specifiers ?? []] } : {},
      ...config.enum ? {
        enum: {
          message: base.enum?.message ?? config.enum?.message,
          values: [...base.enum?.values ?? [], ...config.enum?.values ?? []].toSorted()
        }
      } : {}
    });
  }
  return base;
}

function combineMethods<T extends MethodConfig>(base: T, ...configs: Partial<T>[]): T {
  for (const config of configs) {
    Object.assign(base, {
      ...config,
      validators: [
        ...base.validators,
        ...(config.validators ?? [])
      ]
    });
  }
  return base;
}

function combineClasses<T extends ClassConfig>(base: T, ...configs: Partial<T>[]): T {
  for (const config of configs) {
    Object.assign(base, {
      ...config,
      ...config.views ? { views: { ...base.views, ...config.views } } : {},
      ...config.validators ? { validators: { ...base.validators, ...config.validators } } : {},
    });
  }
  return base;
}

export class SchemaAdapter implements RegistryAdapter<ClassConfig, MethodConfig, FieldConfig> {

  #cls: Class;
  #config: ClassConfig;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<ClassConfig>[]): ClassConfig {
    const cfg = this.#config ??= {
      methods: {},
      class: this.#cls,
      views: {},
      validators: [],
      fields: {},
      subTypeField: 'type'
    };
    combineClasses(cfg, ...data);
    return cfg;
  }

  registerField(field: string | symbol, data: Partial<FieldConfig> = {}): FieldConfig {
    const config = this.register({});
    const cfg = config.fields[field] ??= { array: false, name: field, type: null!, owner: this.#cls };
    combineInputs(cfg, data);
    return cfg;
  }

  registerMethod(method: string | symbol, ...data: Partial<MethodConfig>[]): MethodConfig {
    const config = this.register({});
    const cfg = config.methods[method] ??= { parameters: [], validators: [] };
    combineMethods(cfg, ...data);
    return cfg;
  }

  /**
   * Register a partial config for a pending method param
   * @param prop The method name
   * @param idx The param index
   * @param data The config to register
   */
  registerParameter(method: string | symbol, idx: number, ...data: Partial<ParameterConfig>[]): ParameterConfig {
    const params = this.registerMethod(method, {}).parameters;
    const cfg = params[idx] ??= { method, index: idx, owner: this.#cls, array: false, type: null! };
    combineInputs(cfg, ...data);
    return cfg;
  }

  unregister(): void {
    throw new Error('Method not implemented.');
  }

  finalize(): void {
    throw new Error('Method not implemented.');
  }

  get(): ClassConfig {
    return this.#config;
  }

  getField(field: string | symbol): FieldConfig {
    return this.#config.fields[field];
  }

  getMethod(method: string | symbol): MethodConfig {
    return this.#config.methods[method];
  }
}