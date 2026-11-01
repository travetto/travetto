import { DependencyRegistryIndex } from '@travetto/di';
import { type Class, RuntimeError } from '@travetto/runtime';

import type { ModelType } from '../../src/types/model.ts';
import { ModelBulkUtil } from '../../src/util/bulk.ts';
import { ModelCrudUtil } from '../../src/util/crud.ts';
import { ModelSuite } from './suite.ts';

@ModelSuite()
export abstract class BaseModelSuite<T> {
  serviceClass: Class<T>;
  configClass: Class;

  async getSize<U extends ModelType>(cls: Class<U>): Promise<number> {
    const svc = await this.service;
    if (ModelCrudUtil.isSupported(svc)) {
      let i = 0;
      for await (const _ of svc.list(cls)) {
        i += 1;
      }
      return i;
    } else {
      throw new RuntimeError(`Size is not supported for this service: ${this.serviceClass.name}`);
    }
  }

  async saveAll<M extends ModelType>(cls: Class<M>, items: M[]): Promise<number> {
    const svc = await this.service;
    if (ModelBulkUtil.isSupported(svc)) {
      const result = await ModelBulkUtil.collect(svc.mutateBulk(cls, items));
      return result.counts.insert + result.counts.upsert;
    } else if (ModelCrudUtil.isSupported(svc)) {
      const result = await ModelBulkUtil.collect(ModelBulkUtil.mutateBulkWithCrud(svc, cls, items));
      return result.counts.insert + result.counts.upsert;
    } else {
      throw new Error('Service does not support crud operations');
    }
  }

  async listAll<M extends ModelType>(cls: Class<M>): Promise<M[]> {
    const items: M[] = [];
    const svc = await this.service;
    if (ModelCrudUtil.isSupported(svc)) {
      for await (const item of svc.list(cls)) {
        items.push(item);
      }
    } else {
      throw new RuntimeError(`List is not supported for this service: ${this.serviceClass.name}`);
    }
    return items;
  }

  get service(): Promise<T> {
    return DependencyRegistryIndex.getInstance(this.serviceClass);
  }
}
