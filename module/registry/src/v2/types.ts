import { castTo, Class } from '@travetto/runtime';

export interface RegistryAdapterConstructor<C extends {} = {}, M extends {} = {}, F extends {} = {}> {
  new(cls: Class): RegistryAdapter<C, M, F>;
}

/**
 * Interface for registry adapters to implement
 */
export interface RegistryAdapter<C extends {} = {}, M extends {} = {}, F extends {} = {}> {
  register(data: Partial<C>): void;
  registerField(field: string | symbol, data: Partial<F>): void;
  registerMethod(method: string | symbol, data: Partial<M>): void;
  unregister(): void;

  prepareFinalize(): void;
  finalize(): void;

  get(): C;
  getField(field: string | symbol): F;
  getMethod(method: string | symbol): M;
};

/**
 * Represents a registered item in the registry.
 */
export class RegistryItem {
  cls: Class;
  finalized: boolean = false;
  adapters = new Map<Class<RegistryAdapter>, RegistryAdapter>();

  constructor(cls: Class) {
    this.cls = cls;
  }

  get<C extends {} = {}, M extends {} = {}, F extends {} = {}>(
    adapterClass: RegistryAdapterConstructor<C, M, F>,
    cls: Class
  ): RegistryAdapter<C, M, F> {
    if (!this.adapters.has(adapterClass)) {
      const adapter = new adapterClass(cls);
      this.adapters.set(adapterClass, adapter);
    }
    return castTo(this.adapters.get(adapterClass)!);
  }

  prepareFinalize(): void {
    for (const adapter of this.adapters.values()) {
      adapter.prepareFinalize();
    }
  }

  finalize(): void {
    for (const adapter of this.adapters.values()) {
      adapter.finalize();
    }
    this.finalized = true;
  }
}
