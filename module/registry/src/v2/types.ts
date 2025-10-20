import { castTo, Class } from '@travetto/runtime';
import { ChangeEvent } from '../types';


export interface RegistryIndex<C extends {} = {}, M extends {} = {}, F extends {} = {}> {
  process(events: ChangeEvent<Class>): void;
  adapter(cls: Class): RegistryAdapter<C, M, F>;
}

/**
 * Interface for registry adapters to implement
 */
export interface RegistryAdapter<C extends {} = {}, M extends {} = {}, F extends {} = {}> {
  register(data: Partial<C>): void;
  registerField(field: string | symbol, data: Partial<F>): void;
  registerMethod(method: string | symbol, data: Partial<M>): void;
  unregister(): void;

  finalize(): void;

  get(): C;
  getField(field: string | symbol): F;
  getMethod(method: string | symbol): M;
}

/**
 * Represents a registered item in the registry.
 */
export class RegistryItem {
  cls: Class;
  finalized: boolean = false;
  adapters = new Map<RegistryIndex, RegistryAdapter>();

  constructor(cls: Class) {
    this.cls = cls;
  }

  get<C extends {} = {}, M extends {} = {}, F extends {} = {}>(
    index: RegistryIndex<C, M, F>,
    cls: Class
  ): RegistryAdapter<C, M, F> {
    if (!this.adapters.has(index)) {
      const adapter = index.adapter(cls);
      this.adapters.set(index, adapter);
    }
    return castTo(this.adapters.get(index)!);
  }

  finalize(): void {
    for (const adapter of this.adapters.values()) {
      adapter.finalize();
    }
    this.finalized = true;
  }
}
