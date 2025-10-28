import type { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { AppError, castKey, castTo, Class } from '@travetto/runtime';

import { ClassConfig, MethodConfig, FieldConfig, ParameterConfig, InputConfig, SchemaConfig, DescribableConfig } from './types';

function assignMetadata<T>(key: symbol, base: DescribableConfig, data: Partial<T>[]): T {
  const md = base.metadata ??= {};
  const out = md[key] ??= {};
  for (const d of data) {
    Object.assign(out, d);
  }
  return castTo(out);
}

function combineInputs<T extends InputConfig>(base: T, configs: Partial<T>[]): T {
  for (const config of configs) {
    Object.assign(base, {
      ...config,
      ...config.metadata ? { metadata: { ...base.metadata, ...config.metadata } } : {},
      ...config.aliases ? { aliases: [...base.aliases ?? [], ...config.aliases ?? []] } : {},
      ...config.specifiers ? { specifiers: [...base.specifiers ?? [], ...config.specifiers ?? []] } : {},
      ...config.enum ? {
        enum: {
          message: base.enum?.message ?? config.enum?.message,
          values: [...base.enum?.values ?? [], ...config.enum?.values ?? []].toSorted()
        }
      } : {},
      title: config.title || base.title,
      description: config.description || base.description,
      examples: [...(base.examples ?? []), ...(config.examples ?? [])],
    });
  }
  return base;
}

function combineMethods<T extends MethodConfig>(base: T, configs: Partial<T>[]): T {
  for (const config of configs) {
    Object.assign(base, {
      ...config,
      ...config.metadata ? { metadata: { ...base.metadata, ...config.metadata } } : {},
      parameters: [...base.parameters, ...(config.parameters ?? [])],
      validators: [
        ...base.validators,
        ...(config.validators ?? [])
      ],
      title: config.title || base.title,
      description: config.description || base.description,
      examples: [...(base.examples ?? []), ...(config.examples ?? [])],
    });
  }
  return base;
}

function combineClasses<T extends ClassConfig>(base: T, configs: Partial<T>[], inherited: boolean = false): T {
  for (const config of configs) {
    Object.assign(base, {
      ...config,
      ...config.views ? { views: { ...base.views, ...config.views } } : {},
      ...config.validators ? { validators: { ...base.validators, ...config.validators } } : {},
      ...config.metadata ? { metadata: { ...base.metadata, ...config.metadata } } : {},
      ...!inherited ? {
        baseType: config.baseType ?? base.baseType,
        subTypeName: config.subTypeName ?? base.subTypeName,
      } : {},
      methods: { ...base.methods, ...config.methods },
      fields: { ...base.fields, ...config.fields },
      title: config.title || base.title,
      description: config.description || base.description,
      examples: [...(base.examples ?? []), ...(config.examples ?? [])],
      subTypeField: config.subTypeField ?? base.subTypeField,
    });
  }
  return base;
}

export class SchemaAdapter implements RegistryAdapter<ClassConfig, MethodConfig, FieldConfig> {

  #cls: Class;
  #config: ClassConfig;
  #views: Map<string, SchemaConfig> = new Map();
  #accessorDescriptors: Map<string, PropertyDescriptor> = new Map();

  indexCls: RegistryIndexClass<ClassConfig, MethodConfig, FieldConfig>;

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
    combineClasses(cfg, data);
    return cfg;
  }

  registerMetadata<T>(key: symbol, ...data: Partial<T>[]): T {
    const cfg = this.register({});
    return assignMetadata(key, cfg, data);
  }

  getMetadata<T>(key: symbol): T | undefined {
    const md = this.#config?.metadata;
    return md ? castTo<T>(md[key]) : undefined;
  }

  registerField(field: string | symbol, ...data: Partial<FieldConfig>[]): FieldConfig {
    const config = this.register({});
    const cfg = config.fields[field] ??= { array: false, name: field, type: null!, owner: this.#cls };
    combineInputs(cfg, data);
    return cfg;
  }

  registerFieldMetadata<T>(field: string | symbol, key: symbol, ...data: Partial<T>[]): T {
    const cfg = this.registerField(field);
    return assignMetadata(key, cfg, data);
  }

  getFieldMetadata<T>(field: string | symbol, key: symbol): T | undefined {
    const md = this.#config?.fields[field]?.metadata;
    return md ? castTo<T>(md[key]) : undefined;
  }

  registerMethod(method: string | symbol, ...data: Partial<MethodConfig>[]): MethodConfig {
    const config = this.register({});
    const cfg = config.methods[method] ??= { parameters: [], validators: [] };
    combineMethods(cfg, data);
    return cfg;
  }

  registerMethodMetadata<T>(method: string | symbol, key: symbol, ...data: Partial<T>[]): T {
    const cfg = this.registerMethod(method);
    return assignMetadata(key, cfg, data);
  }

  getMethodMetadata<T>(method: string | symbol, key: symbol): T | undefined {
    const md = this.#config?.methods[method]?.metadata;
    return md ? castTo<T>(md[key]) : undefined;
  }

  /**
   * Register a partial config for a pending method param
   * @param method The method name
   * @param idx The param index
   * @param data The config to register
   */
  registerParameter(method: string | symbol, idx: number, ...data: Partial<ParameterConfig>[]): ParameterConfig {
    const params = this.registerMethod(method, {}).parameters;
    const cfg = params[idx] ??= { method, index: idx, owner: this.#cls, array: false, type: null! };
    combineInputs(cfg, data);
    return cfg;
  }

  unregister(): void {
    throw new Error('Method not implemented.');
  }

  finalize(parent?: ClassConfig): void {
    const config = this.#config;

    if (parent) {
      combineClasses(config, [parent], true);
    }

    if (config.subTypeName && config.subTypeField in config.fields) {
      const field = config.fields[config.subTypeField];
      config.fields[config.subTypeField] = {
        ...field,
        enum: {
          values: [config.subTypeName],
          message: `${config.subTypeField} can only be '${config.subTypeName}'`,
        }
      };
    }

    // Compute views on install
    for (const view of Object.keys(config.views)) {
      const fields = config.views[view];
      const withoutSet = 'without' in fields ? new Set<string>(fields.without) : undefined;
      const fieldList = withoutSet ?
        Object.keys(config.fields).filter(x => !withoutSet.has(x)) :
        ('with' in fields ? fields.with : []);

      this.#views.set(view,
        fieldList.reduce<SchemaConfig>((acc, v) => {
          acc[v] = config.fields[v];
          return acc;
        }, {})
      );
    }

    for (const method of Object.values(config.methods)) {
      method.parameters = method.parameters.toSorted((a, b) => (a.index! - b.index!));
    }
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

  getView(view?: string): SchemaConfig {
    if (!view) {
      return this.#config.fields;
    }
    if (!this.#views.has(view)) {
      throw new AppError(`Unknown view ${view} for class ${this.#cls.name}`);
    }
    return this.#views.get(view)!;
  }

  /**
  * Provides the prototype-derived descriptor for a property
  */
  getAccessorDescriptor(field: string): PropertyDescriptor {
    if (!this.#accessorDescriptors.has(field)) {
      let proto = this.#cls.prototype;
      while (proto && !Object.hasOwn(proto, field)) {
        proto = proto.prototype;
      }
      this.#accessorDescriptors.set(field, Object.getOwnPropertyDescriptor(proto, field)!);
    }
    return this.#accessorDescriptors.get(field)!;
  }

  /**
   * Ensure type is set properly
   */
  ensureInstanceTypeField<T>(o: T): T {
    const config = this.#config;
    const typeField = castKey<T>(config.subTypeField);
    if (config.subTypeName && !!config.fields[typeField] && !o[typeField]) {  // Do we have a type field defined
      o[typeField] = castTo(config.subTypeName); // Assign if missing
    }
    return o;
  }
}