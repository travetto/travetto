import type { RegistryAdapter } from '@travetto/registry';
import { RuntimeError, BinaryUtil, castKey, castTo, type Class, describeFunction, safeAssign } from '@travetto/runtime';

import {
  type SchemaClassConfig, type SchemaMethodConfig, type SchemaFieldConfig,
  type SchemaParameterConfig, type SchemaInputConfig, type SchemaFieldMap, type SchemaCoreConfig,
  type SchemaBasicType, CONSTRUCTOR_PROPERTY
} from './types.ts';

export type SchemaDiscriminatedInfo = Required<Pick<SchemaClassConfig, 'discriminatedType' | 'discriminatedField' | 'discriminatedBase'>>;

const classToDiscriminatedType = (cls: Class): string => cls.name
  .replace(/([A-Z])([A-Z][a-z])/g, (all, left, right) => `${left}_${right.toLowerCase()}`)
  .replace(/([a-z]|\b)([A-Z])/g, (all, left, right) => left ? `${left}_${right.toLowerCase()}` : right.toLowerCase())
  .toLowerCase();

function assignMetadata<T>(key: symbol, base: SchemaCoreConfig, data: Partial<T>[]): T {
  const metadata = base.metadata ??= {};
  const out = metadata[key] ??= {};
  for (const d of data) {
    safeAssign(out, d);
  }
  return castTo(out);
}

function combineCore<T extends SchemaCoreConfig>(base: T, config: Partial<T>): T {
  return safeAssign(base, {
    ...config.metadata ? { metadata: { ...base.metadata, ...config.metadata } } : {},
    ...config.private ? { private: config.private ?? base.private } : {},
    ...config.description ? { description: config.description || base.description } : {},
    ...config.examples ? { examples: [...(base.examples ?? []), ...(config.examples ?? [])] } : {},
  });
}

function ensureBinary<T extends SchemaBasicType>(config?: T): void {
  if (config?.type) {
    config.binary = BinaryUtil.isBinaryTypeReference(config.type);
  }
}

function combineInputs<T extends SchemaInputConfig>(base: T, configs: Partial<T>[]): T {
  for (const config of configs) {
    if (config) {
      safeAssign(base, {
        ...config,
        ...config.aliases ? { aliases: [...base.aliases ?? [], ...config.aliases ?? []] } : {},
        ...config.specifiers ? { specifiers: [...base.specifiers ?? [], ...config.specifiers ?? []] } : {},
        ...config.enum ? {
          enum: {
            message: config.enum?.message ?? base.enum?.message,
            values: (config.enum?.values ?? base.enum?.values ?? []).toSorted()
          }
        } : {},
      });
    }
    combineCore(base, config);
    ensureBinary(base);
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
    ensureBinary(config.returnType);
  }
  return base;
}

function getConstructorConfig<T extends SchemaClassConfig>(base: Partial<T>, parent?: Partial<T>): SchemaMethodConfig {
  const parentCons = parent?.methods?.[CONSTRUCTOR_PROPERTY];
  const baseCons = base.methods?.[CONSTRUCTOR_PROPERTY];
  return {
    class: base.class!,
    parameters: [],
    validators: [],
    ...parentCons,
    ...baseCons,
    returnType: { type: base.class! }
  };
}

function combineClassWithParent<T extends SchemaClassConfig>(base: T, parent: T): T {
  safeAssign(base, {
    ...base.views ? { views: { ...parent.views, ...base.views } } : {},
    ...base.validators ? { validators: [...parent.validators, ...base.validators] } : {},
    ...base.metadata ? { metadata: { ...parent.metadata, ...base.metadata } } : {},
    interfaces: [...parent.interfaces, ...base.interfaces],
    methods: { ...parent.methods, ...base.methods },
    description: base.description || parent.description,
    examples: [...(parent.examples ?? []), ...(base.examples ?? [])],
    discriminatedField: base.discriminatedField ?? parent.discriminatedField,
  });
  switch (base.mappedOperation) {
    case 'Required':
    case 'Partial': {
      base.fields = Object.fromEntries(
        Object.entries(parent.fields).map(([key, value]) => [key, {
          ...value,
          required: {
            active: base.mappedOperation === 'Required'
          }
        }])
      );
      break;
    }
    case 'Pick':
    case 'Omit': {
      const keys = new Set<string>(base.mappedFields ?? []);
      base.fields = Object.fromEntries(
        Object.entries(parent.fields).filter(([key]) =>
          base.mappedOperation === 'Pick' ? keys.has(key) : !keys.has(key)
        )
      );
      break;
    }
    default: {
      base.fields = { ...parent.fields, ...base.fields };
    }
  }
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
    const config = this.#config ??= {
      methods: {},
      class: this.#cls,
      views: {},
      validators: [],
      interfaces: [],
      fields: {},
    };
    return combineClasses(config, data);
  }

  registerMetadata<T>(key: symbol, ...data: Partial<T>[]): T {
    const config = this.register({});
    return assignMetadata(key, config, data);
  }

  getMetadata<T>(key: symbol): T | undefined {
    const metadata = this.#config?.metadata;
    return castTo<T>(metadata?.[key]);
  }

  registerField(field: string, ...data: Partial<SchemaFieldConfig>[]): SchemaFieldConfig {
    const classConfig = this.register({});
    const config = classConfig.fields[field] ??= { name: field, class: this.#cls, type: null! };
    const combined = combineInputs(config, data);
    return combined;
  }

  registerFieldMetadata<T>(field: string, key: symbol, ...data: Partial<T>[]): T {
    const config = this.registerField(field);
    return assignMetadata(key, config, data);
  }

  getFieldMetadata<T>(field: string, key: symbol): T | undefined {
    const metadata = this.#config?.fields[field]?.metadata;
    return castTo<T>(metadata?.[key]);
  }

  registerClass({ methods, ...config }: Partial<SchemaClassConfig> = {}): SchemaClassConfig {
    this.register({ ...config });
    if (methods?.[CONSTRUCTOR_PROPERTY]) {
      const { parameters, ...rest } = methods[CONSTRUCTOR_PROPERTY];
      this.registerMethod(CONSTRUCTOR_PROPERTY, rest);
      for (const param of parameters ?? []) {
        this.registerParameter(CONSTRUCTOR_PROPERTY, param.index!, param);
      }
    }
    return this.#config;
  }

  registerMethod(method: string, ...data: Partial<SchemaMethodConfig>[]): SchemaMethodConfig {
    const classConfig = this.register();
    const config = classConfig.methods[method] ??= { class: this.#cls, parameters: [], validators: [] };
    return combineMethods(config, data);
  }

  registerMethodMetadata<T>(method: string, key: symbol, ...data: Partial<T>[]): T {
    const config = this.registerMethod(method);
    return assignMetadata(key, config, data);
  }

  getMethodMetadata<T>(method: string, key: symbol): T | undefined {
    const metadata = this.#config?.methods[method]?.metadata;
    return castTo<T>(metadata?.[key]);
  }

  registerParameter(method: string, idx: number, ...data: Partial<SchemaParameterConfig>[]): SchemaParameterConfig {
    const params = this.registerMethod(method, {}).parameters;
    const config = params[idx] ??= { method, index: idx, class: this.#cls, array: false, type: null! };
    return combineInputs(config, data);
  }

  registerParameterMetadata<T>(method: string, idx: number, key: symbol, ...data: Partial<T>[]): T {
    const config = this.registerParameter(method, idx);
    return assignMetadata(key, config, data);
  }

  getParameterMetadata<T>(method: string, idx: number, key: symbol): T | undefined {
    const metadata = this.#config?.methods[method]?.parameters[idx]?.metadata;
    return castTo<T>(metadata?.[key]);
  }

  finalize(parent?: SchemaClassConfig): void {
    const config = this.#config;

    if (parent) {
      combineClassWithParent(config, parent);
    }

    if (config.discriminatedField && !config.discriminatedType && !describeFunction(this.#cls).abstract) {
      config.discriminatedType = classToDiscriminatedType(this.#cls);
    }

    if (config.discriminatedField && config.discriminatedType) {
      config.fields[config.discriminatedField] = {
        ...config.fields[config.discriminatedField], // Make a full copy
        required: {
          active: false
        },
        enum: {
          values: [config.discriminatedType],
          message: `${config.discriminatedField} can only be '${config.discriminatedType}'`,
        },
      };
    }

    // Compute views on install
    for (const view of Object.keys(config.views)) {
      const fields = config.views[view];
      const withoutSet = 'without' in fields ? new Set<string>(fields.without) : undefined;
      const fieldList = withoutSet ?
        Object.keys(config.fields).filter(field => !withoutSet.has(field)) :
        ('with' in fields ? fields.with : []);

      this.#views.set(view,
        fieldList.reduce<SchemaFieldMap>((map, value) => {
          map[value] = config.fields[value];
          return map;
        }, {})
      );
    }

    config.methods[CONSTRUCTOR_PROPERTY] = getConstructorConfig(config, parent);

    for (const method of Object.values(config.methods)) {
      method.parameters = method.parameters.toSorted((a, b) => (a.index! - b.index!));
    }
  }

  get(): SchemaClassConfig {
    return this.#config;
  }

  getField(field: string): SchemaFieldConfig {
    return this.#config.fields[field];
  }

  getMethod(method: string): SchemaMethodConfig {
    const methodConfig = this.#config.methods[method];
    if (!methodConfig) {
      throw new RuntimeError(`Unknown method ${String(method)} on class ${this.#cls.Ⲑid}`);
    }
    return methodConfig;
  }

  getMethodReturnType(method: string): Class {
    return this.getMethod(method).returnType!.type;
  }

  getFields(view?: string): SchemaFieldMap {
    if (!view) {
      return this.#config.fields;
    }
    if (!this.#views.has(view)) {
      throw new RuntimeError(`Unknown view ${view} for class ${this.#cls.Ⲑid}`);
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
  ensureInstanceTypeField<T>(value: T): T {
    const config = this.getDiscriminatedConfig();
    if (config) {
      const typeField = castKey<T>(config.discriminatedField);
      value[typeField] ??= castTo(config.discriminatedType); // Assign if missing
    }
    return value;
  }

  getDiscriminatedConfig(): SchemaDiscriminatedInfo | undefined {
    const { discriminatedField, discriminatedType, discriminatedBase } = this.#config;
    if (discriminatedType && discriminatedField) {
      return { discriminatedType, discriminatedField, discriminatedBase: !!discriminatedBase };
    }
    return undefined;
  }
}