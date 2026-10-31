import { castTo, type Class, hasFunction } from '@travetto/runtime';
import { BindUtil, SchemaRegistryIndex } from '@travetto/schema';

import { ModelRegistryIndex } from '../registry/registry-index.ts';
import {
  BulkProcessError,
  type BulkOperation,
  type BulkOperationSource,
  type BulkResponse,
  type BulkSource,
  type ModelBulkSupport
} from '../types/bulk.ts';
import type { ModelCrudSupport } from '../types/crud.ts';
import type { ModelType } from '../types/model.ts';
import { ModelCrudUtil } from './crud.ts';

export type BulkPreStore<T extends ModelType> = {
  insertedIds: Map<number, string>;
  upsertedIds: Map<number, string>;
  updatedIds: Map<number, string>;
  existingUpsertedIds: Map<number, string>;
  deletedIds: Map<number, string>;
  operations: BulkOperation<T>[];
};

export class ModelBulkUtil {
  /**
   * Type guard for determining if service supports bulk operation
   */
  static isSupported = hasFunction<ModelBulkSupport>('processBulk');

  static #mergeBulkResponse<E>(target: BulkResponse<E>, source: BulkResponse<E>, indexOffset: number): void {
    if (indexOffset > 0) {
      for (const error of source.errors) {
        if (typeof error === 'object' && error !== null) {
          if ('index' in error && typeof error.index === 'number') {
            error.index += indexOffset;
          }
          if ('idx' in error && typeof error.idx === 'number') {
            error.idx += indexOffset;
          }
        }
      }
    }
    target.errors.push(...source.errors);
    for (const [key, value] of source.insertedIds.entries()) {
      target.insertedIds.set(key + indexOffset, value);
    }
    target.counts.update += source.counts.update;
    target.counts.insert += source.counts.insert;
    target.counts.upsert += source.counts.upsert;
    target.counts.delete += source.counts.delete;
    target.counts.error += source.counts.error;
  }

  /**
   * Collects an async iterable of BulkResponse items into a single unified BulkResponse
   */
  static async collect<E = unknown>(stream: AsyncIterable<BulkResponse<E>>): Promise<BulkResponse<E>> {
    const total: BulkResponse<E> = {
      errors: [],
      insertedIds: new Map(),
      counts: { update: 0, insert: 0, upsert: 0, delete: 0, error: 0 }
    };
    let globalIndex = 0;
    for await (const response of stream) {
      this.#mergeBulkResponse(total, response, globalIndex);
      globalIndex +=
        response.counts.update + response.counts.insert + response.counts.upsert + response.counts.delete + response.counts.error;
    }
    return total;
  }

  static async #processBatch<T extends ModelType, E = unknown>(
    handler: (batch: BulkOperationSource<T>[]) => Promise<BulkResponse<E>>,
    batch: BulkOperationSource<T>[],
    globalIndex: number
  ): Promise<BulkResponse<E>> {
    try {
      return await handler(batch);
    } catch (error) {
      if (globalIndex > 0 && error instanceof BulkProcessError && error.details?.errors) {
        for (const entry of error.details.errors) {
          entry.idx += globalIndex;
        }
      }
      throw error;
    }
  }

  /**
   * Helper to convert an item or bulk operation into a BulkOperation
   */
  static toBulkOperation<T extends ModelType>(cls: Class<T>, operation: BulkOperationSource<T>): BulkOperation<T> {
    if (operation instanceof cls) {
      return { upsert: operation };
    }
    if ('insert' in operation || 'update' in operation || 'upsert' in operation || 'delete' in operation) {
      return operation;
    }
    const expanded = BindUtil.expandPaths(operation);
    const instance = SchemaRegistryIndex.getBaseClass(cls).from(castTo(expanded));
    return { upsert: instance };
  }

  /**
   * Helper for native providers to stream pre-processed operations against native batch APIs
   */
  static processRawStream<T extends ModelType, E = unknown>(
    cls: Class<T>,
    operations: BulkSource<T>,
    batchSize: number = 500,
    handler: (prepped: BulkPreStore<T>) => Promise<BulkResponse<E>>
  ): AsyncIterable<BulkResponse<E>> {
    return this.batchStream(operations, batchSize, async rawBatch => {
      const prepped = await this.preStore(cls, rawBatch);
      return handler(prepped);
    });
  }

  /**
   * Executes bulk operations against standard ModelCrudSupport operations as an async stream.
   * Useful for services without native batch primitives (e.g. Memory, File).
   */
  static processCrudStream<T extends ModelType>(
    service: ModelCrudSupport,
    cls: Class<T>,
    operations: BulkSource<T>,
    batchSize: number = 500
  ): AsyncIterable<BulkResponse> {
    return this.batchStream(operations, batchSize, async rawBatch => {
      const idSource = ModelRegistryIndex.get(cls).idSource;

      // Upfront validation: ensure required IDs are present for update/delete so missing IDs fail before execution
      for (const rawOperation of rawBatch) {
        const operation = this.toBulkOperation(cls, rawOperation);
        if ('update' in operation && operation.update) {
          const id = idSource.get(operation.update, { optional: true });
          if (!id) {
            await ModelCrudUtil.preUpdate(cls, operation.update);
          }
        } else if ('delete' in operation && operation.delete) {
          const id = typeof operation.delete === 'string' ? operation.delete : idSource.get(castTo(operation.delete), { optional: true });
          if (!id) {
            await ModelCrudUtil.preDelete(cls, castTo(id));
          }
        }
      }

      const counts = {
        update: 0,
        insert: 0,
        upsert: 0,
        delete: 0,
        error: 0
      };
      const errors: unknown[] = [];
      const insertedIds = new Map<number, string>();

      for (let index = 0; index < rawBatch.length; index += 1) {
        const operation = this.toBulkOperation(cls, rawBatch[index]);
        try {
          if ('insert' in operation && operation.insert) {
            const result = await service.create(cls, operation.insert);
            insertedIds.set(index, idSource.get(result));
            counts.insert += 1;
          } else if ('update' in operation && operation.update) {
            await service.update(cls, operation.update);
            counts.update += 1;
          } else if ('upsert' in operation && operation.upsert) {
            const isNew = !idSource.get(operation.upsert, { optional: true });
            const result = await service.upsert(cls, operation.upsert);
            if (isNew) {
              insertedIds.set(index, idSource.get(result));
            }
            counts.upsert += 1;
          } else if ('delete' in operation && operation.delete) {
            const id = typeof operation.delete === 'string' ? operation.delete : idSource.get(castTo(operation.delete));
            await service.delete(cls, id);
            counts.delete += 1;
          }
        } catch (error) {
          counts.error += 1;
          errors.push(typeof error === 'object' && error !== null ? Object.assign(error, { index }) : { index, error });
        }
      }

      return { counts, errors, insertedIds };
    });
  }

  /**
   * Helper to execute bulk operations in batches from an iterable or async iterable as an async stream
   */
  static async *batchStream<T extends ModelType, E = unknown>(
    operations: BulkSource<T>,
    batchSize: number = 500,
    handler: (batch: BulkOperationSource<T>[]) => Promise<BulkResponse<E>>
  ): AsyncIterable<BulkResponse<E>> {
    if (Array.isArray(operations) && operations.length <= batchSize) {
      const response = await this.#processBatch(handler, operations, 0);
      response.index = 0;
      yield response;
      return;
    }

    let batch: BulkOperationSource<T>[] = [];
    let globalIndex = 0;
    let batchIndex = 0;
    for await (const operation of operations) {
      batch.push(operation);
      if (batch.length >= batchSize) {
        const response = await this.#processBatch(handler, batch, globalIndex);
        response.index = batchIndex;
        yield response;
        globalIndex += batch.length;
        batchIndex += 1;
        batch = [];
      }
    }
    if (batch.length > 0) {
      const response = await this.#processBatch(handler, batch, globalIndex);
      response.index = batchIndex;
      yield response;
    }
  }

  /**
   * Prepares bulk operations for storage
   * @param cls
   * @param operations
   * @param options
   */
  static async preStore<T extends ModelType>(
    cls: Class<T>,
    operations: BulkOperationSource<T>[],
    options?: { ensureNotSubType?: boolean }
  ): Promise<BulkPreStore<T>> {
    const insertedIds = new Map<number, string>();
    const upsertedIds = new Map<number, string>();
    const updatedIds = new Map<number, string>();
    const existingUpsertedIds = new Map<number, string>();
    const deletedIds = new Map<number, string>();

    const idSource = ModelRegistryIndex.get(cls).idSource;

    // Pre store
    let operationIndex = 0;
    const preppedOperations: BulkOperation<T>[] = [];
    for (const rawOperation of operations) {
      const operation = this.toBulkOperation(cls, rawOperation);
      preppedOperations.push(operation);
      if ('insert' in operation && operation.insert) {
        operation.insert = await ModelCrudUtil.preCreate(cls, operation.insert, options);
        insertedIds.set(operationIndex, idSource.get(operation.insert));
      } else if ('update' in operation && operation.update) {
        operation.update = await ModelCrudUtil.preUpdate(cls, operation.update, options);
        updatedIds.set(operationIndex, idSource.get(operation.update));
      } else if ('upsert' in operation && operation.upsert) {
        const isNew = !idSource.get(operation.upsert, { optional: true });
        operation.upsert = await ModelCrudUtil.preUpsert(cls, operation.upsert, options);
        if (isNew) {
          upsertedIds.set(operationIndex, idSource.get(operation.upsert));
        } else {
          existingUpsertedIds.set(operationIndex, idSource.get(operation.upsert));
        }
      } else if ('delete' in operation && operation.delete) {
        const id = idSource.get(operation.delete);
        await ModelCrudUtil.preDelete(cls, id, options);
        deletedIds.set(operationIndex, id);
      }
      operationIndex += 1;
    }
    return { insertedIds, upsertedIds, updatedIds, existingUpsertedIds, deletedIds, operations: preppedOperations };
  }
}
