import { DependencyRegistryIndex } from '@travetto/di';
import { AsyncIterator, type Class, RuntimeError } from '@travetto/runtime';

import type { ModelType } from '../../src/types/model.ts';
import { ModelBulkUtil } from '../../src/util/bulk.ts';
import { ModelCrudUtil } from '../../src/util/crud.ts';
import { ModelSuite } from './suite.ts';

@ModelSuite()
export abstract class BaseModelSuite<T> {
  serviceClass: Class<T>;
  configClass: Class;

  get service(): Promise<T> {
    return DependencyRegistryIndex.getInstance(this.serviceClass);
  }

  async getSize<U extends ModelType>(cls: Class<U>): Promise<number> {
    const svc = await this.service;
    if (!ModelCrudUtil.isSupported(svc)) {
      throw new RuntimeError(`Size is not supported for this service: ${this.serviceClass.name}`);
    }
    return (await AsyncIterator.from(svc.list(cls)).toArray()).length;
  }

  async saveAll<M extends ModelType>(cls: Class<M>, items: M[]): Promise<number> {
    const service = await this.service;
    if (!ModelBulkUtil.isSupported(service) && !ModelCrudUtil.isSupported(service)) {
      throw new RuntimeError(`Service does not support crud operations:  ${this.serviceClass.name}`);
    }
    let total = 0;
    const source = ModelBulkUtil.isSupported(service)
      ? service.mutateBulk(cls, items)
      : ModelBulkUtil.mutateBulkWithCrud(service, cls, items);
    for await (const { insertedIds } of source) total += insertedIds.size;
    return total;
  }

  async listAll<M extends ModelType>(cls: Class<M>): Promise<M[]> {
    const svc = await this.service;
    if (!ModelCrudUtil.isSupported(svc)) {
      throw new RuntimeError(`List is not supported for this service: ${this.serviceClass.name}`);
    }
    const items: M[] = [];
    for await (const item of svc.list(cls)) items.push(item);
    return items;
  }
}
