import { RegistryAdapter, RegistryIndexClass } from '@travetto/registry';
import { Class } from '@travetto/runtime';

import { InjectableConfig } from '../types';

export class DependencyRegistryAdapter implements RegistryAdapter<InjectableConfig> {
  indexCls: RegistryIndexClass<InjectableConfig<unknown>, {}, {}>;

  #cls: Class;

  constructor(cls: Class) {
    this.#cls = cls;
  }
  register(...data: Partial<InjectableConfig<unknown>>[]): InjectableConfig<unknown> {
    throw new Error('Method not implemented.');
  }
  registerField(field: string | symbol, ...data: Partial<{}>[]): {} {
    throw new Error('Method not implemented.');
  }
  registerMethod(method: string | symbol, ...data: Partial<{}>[]): {} {
    throw new Error('Method not implemented.');
  }
  finalize(parent?: InjectableConfig<unknown> | undefined): void {
    throw new Error('Method not implemented.');
  }
  getClass(): InjectableConfig<unknown> {
    throw new Error('Method not implemented.');
  }
  getField(field: string | symbol): {} {
    throw new Error('Method not implemented.');
  }
  getMethod(method: string | symbol): {} {
    throw new Error('Method not implemented.');
  }
}
