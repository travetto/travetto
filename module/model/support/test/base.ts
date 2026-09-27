import { DependencyRegistryIndex } from '@travetto/di';
import { type Class, castTo, RuntimeError } from '@travetto/runtime';

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
      for await (const batch of svc.list(cls)) {
        i += batch.length;
      }
      return i;
    } else {
      throw new RuntimeError(`Size is not supported for this service: ${this.serviceClass.name}`);
    }
  }

  async saveAll<M extends ModelType>(cls: Class<M>, items: M[]): Promise<number> {
    const svc = await this.service;
    if (ModelBulkUtil.isSupported(svc)) {
      const result = await svc.processBulk(
        cls,
        items.map(x => ({ insert: x }))
      );
      return result.counts.insert;
    } else if (ModelCrudUtil.isSupported(svc)) {
      const out: Promise<M>[] = [];
      for (const el of items) {
        out.push(svc.create(cls, el));
      }
      await Promise.all(out);
      return out.length;
    } else {
      throw new Error('Service does not support crud operations');
    }
  }

  get service(): Promise<T> {
    return DependencyRegistryIndex.getInstance(this.serviceClass);
  }

  async toArray<U>(src: AsyncIterable<U | U[]> | AsyncGenerator<U | U[]>): Promise<U[]> {
    const out: (U | U[])[] = [];
    for await (const el of src) {
      out.push(el);
    }
    return castTo(out.flat());
  }
}
