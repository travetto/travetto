<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/model/DOC.tsx and execute "npx trv doc" to rebuild -->
# Data Modeling Support

## Datastore abstraction for core operations.

**Install: @travetto/model**
```bash
npm install @travetto/model

# or

yarn add @travetto/model
```

This module provides a set of contracts/interfaces to data model persistence, modification and retrieval.  This module builds heavily upon the [Schema](https://github.com/travetto/travetto/tree/main/module/schema#readme "Data type registry for runtime validation, reflection and binding."), which is used for data model validation.

## Contracts
The module is mainly composed of contracts.  The contracts define the expected interface for various model patterns. The primary contracts are [Basic](https://github.com/travetto/travetto/tree/main/module/model/src/service/basic.ts#L9), [CRUD](https://github.com/travetto/travetto/tree/main/module/model/src/service/crud.ts#L11), [Indexed](https://github.com/travetto/travetto/tree/main/module/model/src/service/indexed.ts#L12), [Expiry](https://github.com/travetto/travetto/tree/main/module/model/src/service/expiry.ts#L11), [Streaming](https://github.com/travetto/travetto/tree/main/module/model/src/service/stream.ts#L3) and [Bulk](https://github.com/travetto/travetto/tree/main/module/model/src/service/bulk.ts#L19).

### Basic
All [Data Modeling Support](https://github.com/travetto/travetto/tree/main/module/model#readme "Datastore abstraction for core operations.") implementations, must honor the [Basic](https://github.com/travetto/travetto/tree/main/module/model/src/service/basic.ts#L9) contract to be able to participate in the model ecosystem.  This contract represents the bare minimum for a model service.

**Code: Basic Contract**
```typescript
export interface ModelBasicSupport<C = unknown> {
  /**
   * Get underlying client
   */
  get client(): C;

  /**
   * Get by Id
   * @param id The identifier of the document to retrieve
   * @throws {NotFoundError} When an item is not found
   */
  get<T extends ModelType>(cls: Class<T>, id: string): Promise<T>;

  /**
   * Create new item
   * @param item The document to create
   * @throws {ExistsError} When an item with the provided id already exists
   */
  create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T>;

  /**
   * Delete an item
   * @param id The id of the document to delete
   * @throws {NotFoundError} When an item is not found
   */
  delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void>;
}
```

### CRUD
The [CRUD](https://github.com/travetto/travetto/tree/main/module/model/src/service/crud.ts#L11) contract, builds upon the basic contract, and is built around the idea of simple data retrieval and storage, to create a foundation for other services that need only basic support.  The model extension in [Authentication](https://github.com/travetto/travetto/tree/main/module/auth#readme "Authentication scaffolding for the Travetto framework"), is an example of a module that only needs create, read and delete, and so any implementation of [Data Modeling Support](https://github.com/travetto/travetto/tree/main/module/model#readme "Datastore abstraction for core operations.") that honors this contract, can be used with the [Authentication](https://github.com/travetto/travetto/tree/main/module/auth#readme "Authentication scaffolding for the Travetto framework") model extension.

**Code: Crud Contract**
```typescript
export interface ModelCrudSupport extends ModelBasicSupport {

  /**
   * Id Source
   */
  idSource: ModelIdSource;

  /**
   * Update an item
   * @param item The document to update.
   * @throws {NotFoundError} When an item is not found
   */
  update<T extends ModelType>(cls: Class<T>, item: T): Promise<T>;

  /**
   * Create or update an item
   * @param item The document to upsert
   * @param view The schema view to validate against
   */
  upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T>;

  /**
   * Update partial, respecting only top level keys.
   *
   * When invoking this method, any top level keys that are null/undefined are treated as removals/deletes.  Any properties
   * that point to sub objects/arrays are treated as wholesale replacements.
   *
   * @param id The document identifier to update
   * @param item The document to partially update.
   * @param view The schema view to validate against
   * @throws {NotFoundError} When an item is not found
   */
  updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T>;

  /**
   * List all items
   */
  list<T extends ModelType>(cls: Class<T>): AsyncIterable<T>;
}
```

### Indexed
Additionally, an implementation may support the ability for basic [Indexed](https://github.com/travetto/travetto/tree/main/module/model/src/service/indexed.ts#L12) queries. This is not the full featured query support of [Data Model Querying](https://github.com/travetto/travetto/tree/main/module/model-query#readme "Datastore abstraction for advanced query support."), but allowing for indexed lookups.  This does not support listing by index, but may be added at a later date.

**Code: Indexed Contract**
```typescript
export interface ModelIndexedSupport extends ModelBasicSupport {
  /**
   * Get entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param body The payload of fields needed to search
   */
  getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T>;

  /**
   * Delete entity by index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param body The payload of fields needed to search
   */
  deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void>;

  /**
   * List entity by ranged index as defined by fields of idx and the body fields
   * @param cls The type to search by
   * @param idx The index name to search against
   * @param body The payload of fields needed to search
   */
  listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T>;

  /**
   * Upsert by index, allowing the index to act as a primary key
   * @param cls The type to create for
   * @param idx The index name to use
   * @param body The document to potentially store
   */
  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T>;
}
```

### Expiry
Certain implementations will also provide support for automatic [Expiry](https://github.com/travetto/travetto/tree/main/module/model/src/service/expiry.ts#L11) of data at runtime.  This is extremely useful for temporary data as, and is used in the [Caching](https://github.com/travetto/travetto/tree/main/module/cache#readme "Caching functionality with decorators for declarative use.") module for expiring data accordingly.

**Code: Expiry Contract**
```typescript
export interface ModelExpirySupport extends ModelCrudSupport {
  /**
   * Delete all expired by class
   *
   * @returns Returns the number of documents expired
   */
  deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number>;
}
```

### Stream
Some implementations also allow for the ability to read/write binary data as a [Streaming](https://github.com/travetto/travetto/tree/main/module/model/src/service/stream.ts#L3).  Given that all implementations can store [Base64](https://en.wikipedia.org/wiki/Base64) encoded data, the key differentiator here, is native support for streaming data, as well as being able to store binary data of significant sizes.  This pattern is currently used by [Asset](https://github.com/travetto/travetto/tree/main/module/asset#readme "Modular library for storing and retrieving binary assets") for reading and writing asset data.

**Code: Stream Contract**
```typescript
export interface ModelStreamSupport {

  /**
   * Upsert stream to storage
   * @param location The location of the stream
   * @param input The actual stream to write
   * @param meta The stream metadata
   */
  upsertStream(location: string, input: Readable, meta: StreamMeta): Promise<void>;

  /**
   * Get stream from asset store
   * @param location The location of the stream
   */
  getStream(location: string, range?: StreamRange): Promise<Readable>;

  /**
   * Get metadata for stream
   * @param location The location of the stream
   */
  describeStream(location: string): Promise<StreamMeta>;

  /**
   * Delete stream by location
   * @param location The location of the stream
   */
  deleteStream(location: string): Promise<void>;
}
```

### Bulk
Finally, there is support for [Bulk](https://github.com/travetto/travetto/tree/main/module/model/src/service/bulk.ts#L19) operations.  This is not to simply imply issuing many commands at in parallel, but implementation support for an atomic/bulk operation.  This should allow for higher throughput on data ingest, and potentially for atomic support on transactions.

**Code: Bulk Contract**
```typescript
export interface ModelBulkSupport extends ModelCrudSupport {
  processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse>;
}
```

## Declaration
Models are declared via the [@Model](https://github.com/travetto/travetto/tree/main/module/model/src/registry/decorator.ts#L13) decorator, which allows the system to know that this is a class that is compatible with the module.  The only requirement for a model is the [ModelType](https://github.com/travetto/travetto/tree/main/module/model/src/types/model.ts#L9)

**Code: ModelType**
```typescript
export interface ModelType {
  /**
   * Unique identifier.
   *
   * If not provided, will be computed on create
   */
  id: string;
}
```

The `id` is the only required field for a model, as this is a hard requirement on naming and type.  This may make using existing data models impossible if types other than strings are required.  Additionally, the `type` field, is intended to record the base model type, but can be remapped. This is important to support polymorphism, not only in [Data Modeling Support](https://github.com/travetto/travetto/tree/main/module/model#readme "Datastore abstraction for core operations."), but also in [Schema](https://github.com/travetto/travetto/tree/main/module/schema#readme "Data type registry for runtime validation, reflection and binding.").

## Implementations
|Service|Basic|CRUD|Indexed|Expiry|Stream|Bulk|
|-------|-----|----|-------|------|------|----|
|[DynamoDB Model Support](https://github.com/travetto/travetto/tree/main/module/model-dynamodb#readme "DynamoDB backing for the travetto model module.")|X|X|X|X| | |
|[Elasticsearch Model Source](https://github.com/travetto/travetto/tree/main/module/model-elasticsearch#readme "Elasticsearch backing for the travetto model module, with real-time modeling support for Elasticsearch mappings.")|X|X|X|X| |X|
|[Firestore Model Support](https://github.com/travetto/travetto/tree/main/module/model-firestore#readme "Firestore backing for the travetto model module.")|X|X|X| | | |
|[MongoDB Model Support](https://github.com/travetto/travetto/tree/main/module/model-mongo#readme "Mongo backing for the travetto model module.")|X|X|X|X|X|X|
|[Redis Model Support](https://github.com/travetto/travetto/tree/main/module/model-redis#readme "Redis backing for the travetto model module.")|X|X|X|X| ||
|[S3 Model Support](https://github.com/travetto/travetto/tree/main/module/model-s3#readme "S3 backing for the travetto model module.")|X|X| |X|X| |
|[SQL Model Service](https://github.com/travetto/travetto/tree/main/module/model-sql#readme "SQL backing for the travetto model module, with real-time modeling support for SQL schemas.")|X|X|X|X| |X|
|[MemoryModelService](https://github.com/travetto/travetto/tree/main/module/model/src/provider/memory.ts#L54)|X|X|X|X|X|X|
|[FileModelService](https://github.com/travetto/travetto/tree/main/module/model/src/provider/file.ts#L49)|X|X| |X|X|X|

## Custom Model Service
In addition to the provided contracts, the module also provides common utilities and shared test suites.  The common utilities are useful for repetitive functionality, that is unable to be shared due to not relying upon inheritance (this was an intentional design decision).  This allows for all the [Data Modeling Support](https://github.com/travetto/travetto/tree/main/module/model#readme "Datastore abstraction for core operations.") implementations to completely own the functionality and also to be able to provide additional/unique functionality that goes beyond the interface.

**Code: Memory Service**
```typescript
import { Readable } from 'node:stream';
import { buffer as toBuffer } from 'node:stream/consumers';
import { Class, TimeSpan, DeepPartial } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import { ModelCrudSupport } from '../service/crud';
import { ModelStreamSupport, StreamMeta, StreamRange } from '../service/stream';
import { ModelType, OptionalId } from '../types/model';
import { ModelExpirySupport } from '../service/expiry';
import { ModelRegistry } from '../registry/model';
import { ModelStorageSupport } from '../service/storage';
import { ModelCrudUtil } from '../internal/service/crud';
import { ModelExpiryUtil } from '../internal/service/expiry';
import { NotFoundError } from '../error/not-found';
import { ExistsError } from '../error/exists';
import { ModelIndexedSupport } from '../service/indexed';
import { ModelIndexedUtil } from '../internal/service/indexed';
import { ModelStorageUtil } from '../internal/service/storage';
import { enforceRange, StreamModel, STREAMS } from '../internal/service/stream';
import { IndexConfig } from '../registry/types';
const STREAM_META = `${STREAMS}_meta`;
type StoreType = Map<string, Buffer>;
@Config('model.memory')
export class MemoryModelConfig {
  autoCreate?: boolean = true;
  namespace?: string;
  cullRate?: number | TimeSpan;
}
function indexName<T extends ModelType>(cls: Class<T>, idx: IndexConfig<T> | string, suffix?: string): string {
  return [cls.Ⲑid, typeof idx === 'string' ? idx : idx.name, suffix].filter(x => !!x).join(':');
}
function getFirstId(data: Map<string, unknown> | Set<string>, value?: string | number): string | undefined {
  let id: string | undefined;
  if (data instanceof Set) {
    id = data.values().next().value;
  } else {
    id = [...data.entries()].find(([k, v]) => value === undefined || v === value)?.[0];
  }
  return id;
}
/**
 * Standard in-memory support
 */
@Injectable()
export class MemoryModelService implements ModelCrudSupport, ModelStreamSupport, ModelExpirySupport, ModelStorageSupport, ModelIndexedSupport {
    sorted: new Map<string, Map<string, Map<string, number>>>(),
    unsorted: new Map<string, Map<string, Set<string>>>()
  };
  idSource = ModelCrudUtil.uuidSource();
  get client(): Map<string, StoreType>;
  constructor(public readonly config: MemoryModelConfig) { }
  async postConstruct(): Promise<void>;
  // CRUD Support
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T>;
  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T>;
  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T>;
  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T>;
  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T>;
  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void>;
  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T>;
  // Stream Support
  async upsertStream(location: string, input: Readable, meta: StreamMeta): Promise<void>;
  async getStream(location: string, range?: StreamRange): Promise<Readable>;
  async describeStream(location: string): Promise<StreamMeta>;
  async deleteStream(location: string): Promise<void>;
  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number>;
  // Storage Support
  async createStorage(): Promise<void>;
  async deleteStorage(): Promise<void>;
  async createModel<T extends ModelType>(cls: Class<T>): Promise<void>;
  async truncateModel<T extends ModelType>(cls: Class<T>): Promise<void>;
  // Indexed
  async getByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<T>;
  async deleteByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: DeepPartial<T>): Promise<void>;
  upsertByIndex<T extends ModelType>(cls: Class<T>, idx: string, body: OptionalId<T>): Promise<T>;
  async * listByIndex<T extends ModelType>(cls: Class<T>, idx: string, body?: DeepPartial<T>): AsyncIterable<T>;
}
```

To enforce that these contracts are honored, the module provides shared test suites to allow for custom implementations to ensure they are adhering to the contract's expected behavior.

**Code: Memory Service Test Configuration**
```typescript
import { Suite } from '@travetto/test';

import { MemoryModelConfig, MemoryModelService } from '../src/provider/memory';
import { ModelCrudSuite } from '../support/test/crud';
import { ModelExpirySuite } from '../support/test/expiry';
import { ModelStreamSuite } from '../support/test/stream';
import { ModelIndexedSuite } from '../support/test/indexed';
import { ModelBasicSuite } from '../support/test/basic';
import { ModelPolymorphismSuite } from '../support/test/polymorphism';

@Suite()
export class MemoryBasicSuite extends ModelBasicSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryCrudSuite extends ModelCrudSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryStreamSuite extends ModelStreamSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryExpirySuite extends ModelExpirySuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryIndexedSuite extends ModelIndexedSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}

@Suite()
export class MemoryPolymorphicSuite extends ModelPolymorphismSuite {
  serviceClass = MemoryModelService;
  configClass = MemoryModelConfig;
}
```

## CLI - model:export
The module provides the ability to generate an export of the model structure from all the various [@Model](https://github.com/travetto/travetto/tree/main/module/model/src/registry/decorator.ts#L13)s within the application.  This is useful for being able to generate the appropriate files to manually create the data schemas in production.

**Terminal: Running model export**
```bash
$ trv model:export --help

Usage: model:export [options] <provider:string> <models...:string>

Options:
  -e, --env <string>     Application environment
  -m, --module <module>  Module to run for
  -h, --help             display help for command

Providers
--------------------
  * SQL

Models
--------------------
  * samplemodel
```

## CLI - model:install
The module provides the ability to install all the various [@Model](https://github.com/travetto/travetto/tree/main/module/model/src/registry/decorator.ts#L13)s within the application given the current configuration being targeted.  This is useful for being able to prepare the datastore manually.

**Terminal: Running model install**
```bash
$ trv model:install --help

Usage: model:install [options] <provider:string> <models...:string>

Options:
  -e, --env <string>     Application environment
  -m, --module <module>  Module to run for
  -h, --help             display help for command

Providers
--------------------
  * Memory
  * SQL

Models
--------------------
  * samplemodel
```
