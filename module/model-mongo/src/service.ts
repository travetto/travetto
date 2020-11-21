import * as mongo from 'mongodb';

import {
  ModelRegistry, ModelType,
  ModelCrudSupport,
  ModelStorageSupport,
  ModelStreamSupport,
  StreamMeta,
  BulkOp,
  BulkResponse,
  ModelBulkSupport,
  NotFoundError,
  ExistsError
} from '@travetto/model-core';


import { Class } from '@travetto/registry';
import { ShutdownManager } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';
import { SchemaValidator } from '@travetto/schema';

import { MongoUtil } from './internal/util';
import { MongoModelConfig } from './config';

function uuid(val: string) {
  // return new mongo.Binary(Buffer.from(val.replace(/-/g, ''), 'hex'), mongo.Binary.SUBTYPE_UUID);
  return new mongo.ObjectId(val);
}

async function postLoadId<T extends ModelType>(item: T) {
  if (item && '_id' in item) {
    item.id = (item as any)._id.toHexString();
    delete (item as any)._id;
  }
  return item;
}

function preInsertId<T extends ModelType>(item: T) {
  if (item && item.id) {
    (item as any)._id = uuid(item.id!);
    delete item.id;
  }
  return item;
}
/**
 * Mongo-based model source
 */
@Injectable()
export class MongoModelService implements ModelCrudSupport, ModelStorageSupport, ModelBulkSupport, ModelStreamSupport {

  private client: mongo.MongoClient;
  private db: mongo.Db;
  private bucket: mongo.GridFSBucket;

  constructor(private config: MongoModelConfig) {
  }

  async postConstruct() {
    this.client = await mongo.MongoClient.connect(this.config.url, this.config.clientOptions);
    this.db = this.client.db();
    this.bucket = new mongo.GridFSBucket(this.db, {
      bucketName: 'streams',
      writeConcern: { w: 1 }
    });
    ShutdownManager.onShutdown(__filename, () => this.client.close());
  }

  /**
   * Build a mongo identifier
   */
  uuid() {
    return new mongo.ObjectId().toHexString();
  }

  /**
   * Initialize db, setting up indicies
   */
  async createStorage() {
    // Establish geo indices
    const promises: Promise<any>[] = [];
    for (const model of ModelRegistry.getClasses()) {
      // promises.push(...this.establishIndices(model));
    }
    await Promise.all(promises);
  }

  async deleteStorage() {
    await this.db.dropDatabase();
  }

  /**
   * Get mongo collection
   */
  async getStore<T extends ModelType>(cls: Class<T>): Promise<mongo.Collection> {
    return this.db.collection(ModelRegistry.getStore(cls));
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    const store = await this.getStore(cls);
    const result = await store.findOne({ _id: uuid(id), }, {});
    if (result) {
      const res = await ModelCrudUtil.load(cls, result);
      if (res) {
        return postLoadId(res);
      }
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    const cleaned = await ModelCrudUtil.preStore(cls, item, this);
    (item as any)._id = uuid(item.id!);

    const store = await this.getStore(cls);
    const result = await store.insertOne(cleaned);
    if (result.insertedCount === 0) {
      throw new ExistsError(cls, item.id!);
    }
    delete (item as any)._id;
    return item;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    const store = await this.getStore(cls);
    const res = await store.replaceOne({ _id: uuid(item.id!) }, item);
    if (res.matchedCount === 0) {
      throw new NotFoundError(cls, item.id!);
    }
    return item;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);
    const store = await this.getStore(cls);
    await store.updateOne(
      { _id: uuid(item.id!) },
      { $set: item },
      { upsert: true }
    );
    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    const store = await this.getStore(cls);

    if (view) {
      await SchemaValidator.validate(cls, item, view);
    }

    if (item.prePersist) {
      await item.prePersist();
    }

    let final: any = item;

    const items = MongoUtil.extractSimple(final);
    final = Object.entries(items).reduce((acc, [k, v]) => {
      if (v === null || v === undefined) {
        acc.$unset = acc.$unset ?? {};
        acc.$unset[k] = v;
      } else {
        acc.$set = acc.$set ?? {};
        acc.$set[k] = v;
      }
      return acc;
    }, {} as Record<string, any>);

    const res = await store.findOneAndUpdate({ _id: uuid(id) }, final, { returnOriginal: false });

    if (!res.value) {
      new NotFoundError(cls, id);
    }

    return this.get(cls, id);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const store = await this.getStore(cls);
    const result = await store.deleteOne({ _id: uuid(id) });
    if (result.deletedCount === 0) {
      throw new NotFoundError(cls, id);
    }
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    const store = await this.getStore(cls);
    for await (const el of store.find()) {
      try {
        yield postLoadId(await ModelCrudUtil.load(cls, el));
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          throw e;
        }
      }
    }
  }

  async upsertStream(location: string, stream: NodeJS.ReadableStream, meta: StreamMeta) {
    const writeStream = this.bucket.openUploadStream(location, {
      contentType: meta.contentType,
      metadata: meta
    });

    await new Promise<any>((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on('error', reject);
      writeStream.once('finish', resolve);
    });
  }

  async getStream(location: string) {
    await this.getStreamMetadata(location);

    const res = await this.bucket.openDownloadStreamByName(location);
    if (!res) {
      throw new NotFoundError('stream', location);
    }
    return res;
  }

  async getStreamMetadata(location: string) {
    const files = await this.bucket.find({ filename: location }, { limit: 1 }).toArray();

    if (!files || !files.length) {
      throw new Error('Unable to find file');
    }

    const [f] = files;
    return f.metadata;
  }

  async deleteStream(location: string) {
    const files = await this.bucket.find({ filename: location }).toArray();
    const [{ _id: bucketId }] = files;
    await this.bucket.delete(bucketId);
  }

  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]) {
    const store = await this.getStore(cls);
    const bulk = store.initializeUnorderedBulkOp({ w: 1 });
    const out: BulkResponse = {
      errors: [],
      counts: {
        delete: 0,
        update: 0,
        upsert: 0,
        insert: 0,
        error: 0
      },
      insertedIds: new Map()
    };

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (op.insert) {
        op.insert = await ModelCrudUtil.preStore(cls, op.insert, this);
        out.insertedIds.set(i, op.insert.id!);
        bulk.insert(preInsertId(op.insert));
      } else if (op.upsert) {
        const newId = !op.upsert.id;

        op.upsert = await ModelCrudUtil.preStore(cls, op.upsert, this);
        const id = uuid(op.upsert.id!);
        bulk.find({ _id: id })
          .upsert()
          .updateOne({ $set: op.upsert });

        if (newId) {
          out.insertedIds.set(i, id.toHexString());
        }
      } else if (op.update) {
        op.update = await ModelCrudUtil.preStore(cls, op.update, this);
        bulk.find({ _id: uuid(op.update.id!) }).update({ $set: op.update });
      } else if (op.delete) {
        bulk.find({ _id: uuid(op.delete.id!) }).removeOne();
      }
    }

    if (operations.length > 0) {
      const res = await bulk.execute({});

      for (const el of operations) {
        if (el.insert) {
          postLoadId(el.insert);
        }
      }
      for (const { index, _id } of res.getUpsertedIds() as { index: number, _id: mongo.ObjectID }[]) {
        out.insertedIds.set(index, _id.toHexString());
      }

      if (out.counts) {
        out.counts.delete = res.nRemoved;
        out.counts.update = operations.filter(x => x.update).length;
        out.counts.insert = res.nInserted;
        out.counts.upsert = operations.filter(x => x.upsert).length;
      }

      if (res.hasWriteErrors()) {
        out.errors = res.getWriteErrors();
        for (const err of out.errors) {
          const op = operations[err.index];
          const k = Object.keys(op)[0] as keyof BulkResponse['counts'];
          out.counts[k] -= 1;
        }
        out.counts.error = out.errors.length;
      }
    }

    return out;
  }
}