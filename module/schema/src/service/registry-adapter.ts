import type { RegistryAdapter } from '@travetto/registry';
import { AppError, castKey, castTo, Class, describeFunction, safeAssign } from '@travetto/runtime';

import {
  SchemaClassConfig, SchemaMethodConfig, SchemaFieldConfig,
  SchemaParameterConfig, SchemaInputConfig, SchemaFieldMap, SchemaCoreConfig
} from './types';

function assignMetadata<T>(key: symbol, base: SchemaCoreConfig, data: Partial<T>[]): T {
  const md = base.metadata ??= {};
  const out = md[key] ??= {};
  for (const d of data) {
    safeAssign(out, d);
  }
  return castTo(out);
}

function combineCore<T extends SchemaCoreConfig>(base: T, config: Partial<T>): T {
  return safeAssign(base, {
    ...config.metadata ? { metadata: { ...base.metadata, ...config.metadata } } : {},
    ...config.private ? { private: config.private ?? base.private } : {},
    ...config.title ? { title: config.title || base.title } : {},
    ...config.description ? { description: config.description || base.description } : {},
    ...config.examples ? { examples: [...(base.examples ?? []), ...(config.examples ?? [])] } : {},
  });
}

function combineInputs<T extends SchemaInputConfig>(base: T, configs: Partial<T>[]): T {
  for (const config of configs) {
    safeAssign(base, {
      ...config,
      ...config.aliases ? { aliases: [...base.aliases ?? [], ...config.aliases ?? []] } : {},
      ...config.specifiers ? { specifiers: [...base.specifiers ?? [], ...config.specifiers ?? []] } : {},
      ...config.enum ? {
        enum: {
          message: base.enum?.message ?? config.enum?.message,
          values: [...base.enum?.values ?? [], ...config.enum?.values ?? []].toSorted()
        }
      } : {},
    });
    combineCore(base, config);
  }
  return base;
}

function combineMethods<T extends SchemaMethodConfig>(base: T, configs: Partial<T>[]): T {
  for (const config of configs) {
    safeAssign(base, {
      ...config,
      parameters: config.parameters ?? base.parameters,
      validators: [...base.validators, ...(config.validators ?? [])],
    });
    combineCore(base, config);
    if (config.parameters) {
      for (const param of config.parameters) {
        safeAssign(base.parameters[param.index], param);
      }
    }
  }
  return base;
}

function getConstructorConfig<T extends SchemaClassConfig>(base: Partial<T>, parent?: Partial<T>): SchemaMethodConfig {
  const parentCons = parent?.methods?.['CONSTRUCTOR'];
  const baseCons = base.methods?.['CONSTRUCTOR'];
  return {
    parameters: [],
    validators: [],
    handle: undefined!,
    ...parentCons,
    ...baseCons,
    returnType: { type: base.class! }
  };
}

function combineClassWithParent<T extends SchemaClassConfig>(base: T, parent: T): T {
  safeAssign(base, {
    ...base,
    ...base.views ? { views: { ...parent.views, ...base.views } } : {},
    ...base.validators ? { validators: [...parent.validators, ...base.validators] } : {},
    ...base.metadata ? { metadata: { ...parent.metadata, ...base.metadata } } : {},
    interfaces: [...parent.interfaces, ...base.interfaces],
    methods: { ...parent.methods, ...base.methods },
    fields: { ...parent.fields, ...base.fields },
    title: base.title || parent.title,
    description: base.description || parent.description,
    examples: [...(parent.examples ?? []), ...(base.examples ?? [])],
    subTypeField: base.subTypeField ?? parent.subTypeField,
  });
  return base;
}

function combineClasses<T extends SchemaClassConfig>(base: T, configs: Partial<T>[]): T {
  for (const config of configs) {
    Object.assign(base, {
      ...config,
      ...config.views ? { views: { ...base.views, ...config.views } } : {},
      ...config.validators ? { validators: [...base.validators, ...config.validators] } : {},
      interfaces: [...base.interfaces, ...(config.interfaces ?? [])],
      methods: { ...base.methods, ...config.methods },
      fields: { ...base.fields, ...config.fields },
      baseType: config.baseType ?? base.baseType,
      subTypeField: config.subTypeField ?? base.subTypeField,
    });
    combineCore(base, config);
  }
  return base;
}

export class SchemaRegistryAdapter implements RegistryAdapter<SchemaClassConfig> {

  #cls: Class;
  #config: SchemaClassConfig;
  #views: Map<string, SchemaFieldMap> = new Map();
  #accessorDescriptors: Map<string, PropertyDescriptor> = new Map();

  constructor(cls: Class) {
    this.#cls = cls;
  }

  register(...data: Partial<SchemaClassConfig>[]): SchemaClassConfig {
    const cfg = this.#config ??= {
      methods: {},
      class: this.#cls,
      views: {},
      validators: [],
      interfaces: [],
      fields: {},
      subTypeField: 'type',
      baseType: !!describeFunction(this.#cls)?.abstract,
    };
    return combineClasses(cfg, data);
  }

  registerMetadata<T>(key: symbol, ...data: Partial<T>[]): T {
    const cfg = this.register({});
    return assignMetadata(key, cfg, data);
  }

  getMetadata<T>(key: symbol): T | undefined {
    const md = this.#config?.metadata;
    return castTo<T>(md?.[key]);
  }

  registerField(field: string | symbol, ...data: Partial<SchemaFieldConfig>[]): SchemaFieldConfig {
    const config = this.register({});
    const cfg = config.fields[field] ??= { name: field, owner: this.#cls, type: null! };
    const combined = combineInputs(cfg, data);
    return combined;
  }

  registerFieldMetadata<T>(field: string | symbol, key: symbol, ...data: Partial<T>[]): T {
    const cfg = this.registerField(field);
    return assignMetadata(key, cfg, data);
  }

  getFieldMetadata<T>(field: string | symbol, key: symbol): T | undefined {
    const md = this.#config?.fields[field]?.metadata;
    return castTo<T>(md?.[key]);
  }

  registerClass({ methods, ...cfg }: Partial<SchemaClassConfig> = {}): void {
    this.register({ ...cfg });
    if (methods?.['CONSTRUCTOR']) {
      this.registerMethod('CONSTRUCTOR', methods['CONSTRUCTOR']);
    }
  }

  registerMethod(method: string | symbol, ...data: Partial<SchemaMethodConfig>[]): SchemaMethodConfig {
    const config = this.register({});
    const cfg = config.methods[method] ??= { parameters: [], validators: [], handle: this.#cls.prototype[method] };
    return combineMethods(cfg, data);
  }

  registerMethodMetadata<T>(method: string | symbol, key: symbol, ...data: Partial<T>[]): T {
    const cfg = this.registerMethod(method);
    return assignMetadata(key, cfg, data);
  }

  getMethodMetadata<T>(method: string | symbol, key: symbol): T | undefined {
    const md = this.#config?.methods[method]?.metadata;
    return castTo<T>(md?.[key]);
  }

  registerParameter(method: string | symbol, idx: number, ...data: Partial<SchemaParameterConfig>[]): SchemaParameterConfig {
    const params = this.registerMethod(method, {}).parameters;
    const cfg = params[idx] ??= { method, index: idx, owner: this.#cls, array: false, type: null! };
    return combineInputs(cfg, data);
  }

  registerParameterMetadata<T>(method: string | symbol, idx: number, key: symbol, ...data: Partial<T>[]): T {
    const params = this.registerMethod(method, {}).parameters;
    const cfg = params[idx] ??= { method, index: idx, owner: this.#cls, array: false, type: null! };
    return assignMetadata(key, cfg, data);
  }

  getParameterMetadata<T>(method: string | symbol, idx: number, key: symbol): T | undefined {
    const md = this.#config?.methods[method]?.parameters[idx]?.metadata;
    return castTo<T>(md?.[key]);
  }

  finalize(parent?: SchemaClassConfig): void {
    const config = this.#config;

    if (parent) {
      combineClassWithParent(config, parent);
    }

    const polymorphicConfig = this.getPolymorphicConfig();
    if (polymorphicConfig) {
      const { subTypeField, subTypeName } = polymorphicConfig;
      const field = config.fields[subTypeField];
      config.fields[subTypeField] = {
        ...field,
        enum: {
          values: [subTypeName],
          message: `${subTypeField} can only be '${subTypeName}'`,
        },
        required: {
          active: false
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
        fieldList.reduce<SchemaFieldMap>((acc, v) => {
          acc[v] = config.fields[v];
          return acc;
        }, {})
      );
    }

    config.methods['CONSTRUCTOR'] = getConstructorConfig(config, parent);

    for (const method of Object.values(config.methods)) {
      method.parameters = method.parameters.toSorted((a, b) => (a.index! - b.index!));
    }
  }

  get(): SchemaClassConfig {
    return this.#config;
  }

  getField(field: string | symbol): SchemaFieldConfig {
    return this.#config.fields[field];
  }

  getMethod(method: string | symbol): SchemaMethodConfig {
    const res = this.#config.methods[method];
    if (!res) {
      throw new AppError(`Unknown method ${String(method)} on class ${this.#cls.Ⲑid}`);
    }
    return res;
  }

  getMethodReturnType(method: string | symbol): Class {
    return this.getMethod(method).returnType!.type;
  }

  getSchema(view?: string): SchemaFieldMap {
    if (!view) {
      return this.#config.fields;
    }
    if (!this.#views.has(view)) {
      throw new AppError(`Unknown view ${view} for class ${this.#cls.Ⲑid}`);
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

  getPolymorphicConfig(): { subTypeName: string, subTypeField: string } | undefined {
    const { subTypeField, subTypeName } = this.#config;
    if (subTypeName && subTypeField && subTypeField in this.#config.fields) {
      return { subTypeName, subTypeField };
    }
    return undefined;
  }
}