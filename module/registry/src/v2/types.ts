import { castTo, Class } from '@travetto/runtime';

/**
 * Interface for registry adapters to implement
 */
export interface RegistryAdapter<C extends {} = {}, M extends {} = {}, F extends {} = {}> {
  register(cls: Class, data: Partial<C>): void;
  registerField(cls: Class, field: string | symbol, data: Partial<F>): void;
  registerMethod(cls: Class, method: string | symbol, data: Partial<M>): void;
  unregister(cls: Class): void;

  prepareFinalize(cls: Class): void;
  finalize(cls: Class): void;

  get(cls: Class): C;
  getField(cls: Class, field: string | symbol): F;
  getMethod(cls: Class, method: string | symbol): M;
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
    cls: Class<RegistryAdapter<C, M, F>>
  ): RegistryAdapter<C, M, F> {
    if (!this.adapters.has(cls)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const adapter = new (cls as { new(): RegistryAdapter<C, M, F> })();
      this.adapters.set(cls, adapter);
    }
    return castTo(this.adapters.get(cls)!);
  }

  prepareFinalize(): void {
    for (const adapter of this.adapters.values()) {
      adapter.prepareFinalize(this.cls);
    }
  }

  finalize(): void {
    for (const adapter of this.adapters.values()) {
      adapter.finalize(this.cls);
    }
    this.finalized = true;
  }
}
