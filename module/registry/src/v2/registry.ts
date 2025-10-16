import { Class } from '@travetto/runtime';

export interface RegistryAdapter<C = Class, M = unknown, F = Function> {
  register(cls: Class, data: Partial<C>): void;
  registerField(cls: Class, field: string | symbol, data: Partial<F>): void;
  registerMethod(cls: Class, method: string | symbol, data: Partial<M>): void;
  unregister(cls: Class): void;
  finalize(cls: Class): void;
  finalizeGlobal(cls: Class): void;

  get(cls: Class): C;
  getField(cls: Class, field: string | symbol): F;
  getMethod(cls: Class, method: string | symbol): M;
}

export class RegistryItem {
  cls: Class;
  finalized: boolean = false;
  adapters: RegistryAdapter[] = [];
}

export class RegistryV2 {
  /*
    TODO: Implement
    ## Phase Initial Load
    0. Using a ClassSource load of all classes and collect changes
    1. Allow classes to register an adapter.  This will run via decorators and so we will generally register
       the class after the fields have bene registered.
    2. Allow methods to be registered via the adapter.  Decorators will register their method data on 
       when the decorator is invoked.
    3. Allow fields to be registered via the adapter.  Decorators will register their field data on
       when the decorator is invoked.   
    4. Once all classes have been loaded, finalize each class in the registry.
       1. This will call finalize on each adapter, in the order they were registered.
    5. After all classes have been finalized, call finalizeGlobal on each adapter, in the order they were registered.
       1. This allows adapters to do any cross-class work, such as building indexes.

    ## Phase Runtime Changes (batch of classes)
    1. On class added, create a RegistryItem for the class, and wait for decorators to register adapters, fields, and methods.
    2. On class removed, remove the RegistryItem for the class.
    3. On class changed, reset the RegistryItem for the class (remove all adapters, and set finalized to false), and wait for decorators to register adapters, fields, and methods.
    4. Finalize each class once all decorators have run.
    5. After all classes have been finalized, call finalizeGlobal on each adapter, in the order they were registered.

    ## Expose methods for fetching data
    1. Get class data
    2. Get field data
    3. Get method data
  */
}