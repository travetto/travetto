import { DependencyRegistry } from '@travetto/di';
import { AppError, Class } from '@travetto/base';

import { isBulkSupported, isCrudSupported } from '../src/internal/service/common';
import { ModelType } from '../src/types/model';
import { ModelSuite } from './suite';

type ServiceClass = { serviceClass: { new(): unknown } };

@ModelSuite()
export abstract class BaseModelSuite<T> {

  static ifNot(pred: (svc: unknown) => boolean): (x: unknown) => Promise<boolean> {
    return async (x: unknown) => !pred(new (x as ServiceClass).serviceClass());
  }

  serviceClass: Class<T>;
  configClass: Class;

  async getSize<U extends ModelType>(cls: Class<U>): Promise<number> {
    const svc = (await this.service);
    if (isCrudSupported(svc)) {
      let i = 0;
      for await (const __el of svc.list(cls)) {
        i += 1;
      }
      return i;
    } else {
      throw new AppError(`Size is not supported for this service: ${this.serviceClass.name}`);
    }
  }

  async saveAll<M extends ModelType>(cls: Class<M>, items: M[]): Promise<number> {
    const svc = await this.service;
    if (isBulkSupported(svc)) {
      const res = await svc.processBulk(cls, items.map(x => ({ insert: x })));
      return res.counts.insert;
    } else if (isCrudSupported(svc)) {
      const out = [] as Promise<M>[];
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
    return DependencyRegistry.getInstance(this.serviceClass);
  }

  async toArray<U>(src: AsyncIterable<U> | AsyncGenerator<U>): Promise<U[]> {
    const out: U[] = [];
    for await (const el of src) {
      out.push(el);
    }
    return out;
  }
}