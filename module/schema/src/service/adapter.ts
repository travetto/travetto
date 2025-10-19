import { Class, castTo } from '@travetto/runtime';
import { RegistryAdapter } from '@travetto/registry';

import { ClassConfig, FieldConfig, MethodConfig } from './types';

export class SchemaRegistryAdapter implements RegistryAdapter<ClassConfig, MethodConfig, FieldConfig> {
  // Per-instance storage; the adapter instance represents a single target class.
  #config?: ClassConfig;
  #fields = new Map<string, Partial<FieldConfig>>();
  #methods = new Map<string, Partial<MethodConfig>>();
  #entry?: ClassConfig;


  // The class this adapter instance is responsible for. Set in constructor.
  #cls: Class;

  constructor(cls: Class) {
    this.#cls = cls;
  }

  #createPending(cls: Class): ClassConfig {
    return {
      class: cls,
      validators: [],
      subTypeField: 'type',
      baseType: false,
      metadata: {},
      methods: {},
      totalView: { schema: {}, fields: [] },
      views: {}
    };
  }
  #getOrCreatePending(): ClassConfig {
    if (this.#config) {
      return this.#config;
    }
    this.#config = this.#createPending(this.#cls);
    this.#fields = new Map();
    this.#methods = new Map();
    return this.#config;
  }

  #getOrCreatePendingField(field: string): Partial<FieldConfig> {
    if (!this.#fields.has(field)) {
      this.#fields.set(field, {});
    }
    return this.#fields.get(field)!;
  }

  #getOrCreatePendingMethod(method: string): Partial<MethodConfig> {
    if (!this.#methods.has(method)) {
      this.#methods.set(method, { parameters: [], validators: [] });
    }
    return this.#methods.get(method)!;
  }

  register(data: Partial<ClassConfig> = {}): void {
    const cfg = this.#getOrCreatePending();
    Object.assign(cfg, data);
  }

  registerField(field: string | symbol, data: Partial<FieldConfig>): void {
    const name = String(field);
    const slot = this.#getOrCreatePendingField(name);
    Object.assign(slot, data);

    const pending = this.#getOrCreatePending();
    pending.totalView = pending.totalView ?? { schema: {}, fields: [] };
    if (!pending.totalView.schema[name]) {
      pending.totalView.schema[name] = castTo<FieldConfig>(slot);
      pending.totalView.fields.push(name);
    } else {
      pending.totalView.schema[name] = castTo<FieldConfig>({ ...pending.totalView.schema[name], ...slot });
    }
  }

  registerMethod(method: string | symbol, data: Partial<MethodConfig>): void {
    const name = String(method);
    const slot = this.#getOrCreatePendingMethod(name);
    Object.assign(slot, data);
    const pending = this.#getOrCreatePending();
    pending.methods = pending.methods ?? {};
    pending.methods[name] = castTo<MethodConfig>(slot);
  }

  unregister(): void {
    this.#config = undefined;
    this.#fields.clear();
    this.#methods.clear();
    this.#entry = undefined;
  }

  prepareFinalize(): void {
    // Ensure pending exists and is initialized
    const pending = this.#getOrCreatePending();
    pending.totalView = pending.totalView ?? { schema: {}, fields: [] };
    pending.views = pending.views ?? {};
    pending.methods = pending.methods ?? {};
  }

  finalize(): void {
    const pending = this.#getOrCreatePending();

    for (const [k, v] of this.#fields.entries()) {
      pending.totalView = pending.totalView ?? { schema: {}, fields: [] };
      pending.totalView.schema[k] = castTo<FieldConfig>({ ...(pending.totalView.schema?.[k] ?? {}), ...v });
      if (!pending.totalView.fields.includes(k)) {
        pending.totalView.fields.push(k);
      }
    }

    for (const [k, v] of this.#methods.entries()) {
      pending.methods = pending.methods ?? {};
      pending.methods[k] = castTo<MethodConfig>({ ...(pending.methods[k] ?? {}), ...v });
    }

    this.#entry = pending;
    this.#config = undefined;
    this.#fields.clear();
    this.#methods.clear();
  }

  get(): ClassConfig {
    if (this.#entry) {
      return this.#entry;
    }
    return this.#getOrCreatePending();
  }

  getField(field: string | symbol): FieldConfig {
    const name = String(field);
    const cfg = this.get();
    if (cfg.totalView?.schema?.[name]) {
      return cfg.totalView.schema[name];
    }
    const pending = this.#getOrCreatePendingField(name);
    const pFull = this.#getOrCreatePending();
    pFull.totalView = pFull.totalView ?? { schema: {}, fields: [] };
    if (!pFull.totalView.schema[name]) {
      pFull.totalView.schema[name] = castTo<FieldConfig>(pending);
      pFull.totalView.fields.push(name);
    }
    return pFull.totalView.schema[name];
  }

  getMethod(method: string | symbol): MethodConfig {
    const name = String(method);
    const cfg = this.get();
    if (cfg.methods && cfg.methods[name]) {
      return cfg.methods[name];
    }
    const pending = this.#getOrCreatePendingMethod(name);
    const pFull = this.#getOrCreatePending();
    pFull.methods = pFull.methods ?? {};
    if (!pFull.methods[name]) {
      pFull.methods[name] = castTo<MethodConfig>(pending);
    }
    return pFull.methods[name];
  }
}