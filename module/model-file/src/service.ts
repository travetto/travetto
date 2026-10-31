import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Config } from '@travetto/config';
import { Injectable, PostConstruct } from '@travetto/di';
import {
  ExistsError,
  type BulkResponse,
  type BulkSource,
  type ModelBlobSupport,
  type ModelBulkSupport,
  ModelBulkUtil,
  type ModelCrudSupport,
  ModelCrudUtil,
  type ModelExpirySupport,
  ModelExpiryUtil,
  type ModelListOptions,
  ModelRegistryIndex,
  type ModelStorageSupport,
  type ModelType,
  NotFoundError,
  type OptionalId,
  type PartialWithId
} from '@travetto/model';
import {
  type BinaryMetadata,
  BinaryMetadataUtil,
  type BinaryType,
  BinaryUtil,
  type ByteRange,
  type Class,
  JSONUtil,
  Runtime,
  type TimeSpan
} from '@travetto/runtime';
import { Required } from '@travetto/schema';

type Suffix = '.bin' | '.meta' | '.json' | '.expires';

const ModelBlobNamespace = '__blobs';

const BIN = '.bin';
const META = '.meta';

@Config('model.file')
export class FileModelConfig {
  @Required(false)
  folder: string;
  namespace: string = '.';
  modifyStorage?: boolean;
  cullRate?: number | TimeSpan;
  readBeforeUpdate?: boolean = false;

  @PostConstruct()
  async finalizeConfig(): Promise<void> {
    this.folder ??= path.resolve(os.tmpdir(), `trv_file_${Runtime.main.name.replace(/[^a-z]/gi, '_')}`);
  }
}

const exists = (file: string): Promise<boolean> =>
  fs.stat(file).then(
    () => true,
    () => false
  );

/**
 * Standard file support
 */
@Injectable()
export class FileModelService implements ModelCrudSupport, ModelBulkSupport, ModelBlobSupport, ModelExpirySupport, ModelStorageSupport {
  /** @private */
  static async *scanFolder(folder: string, suffix: string, options?: ModelListOptions): AsyncGenerator<[id: string, field: string][]> {
    const found: [id: string, field: string][] = [];
    const batchSize = options?.batchSizeHint ?? 100;
    const maxCount = options?.limit ?? Number.MAX_SAFE_INTEGER;
    let produced = 0;
    for (const sub of await fs.readdir(folder)) {
      if (options?.abort?.aborted) {
        break;
      }
      for (const file of await fs.readdir(path.resolve(folder, sub))) {
        if (options?.abort?.aborted) {
          break;
        }
        if (file.endsWith(suffix)) {
          found.push([file.replace(suffix, ''), path.resolve(folder, sub, file)]);
          produced += 1;
          if (produced >= maxCount) {
            break;
          }
          if (found.length >= batchSize) {
            yield found.splice(0, found.length);
          }
        }
      }
    }
    if (found.length) {
      yield found;
    }
  }

  config: FileModelConfig;

  constructor(config: FileModelConfig) {
    this.config = config;
  }

  /**
   * The root location for all activity
   */
  get client(): string {
    return this.config.folder;
  }

  async #resolveName<T extends ModelType>(cls: Class<T> | string, suffix?: Suffix, id?: string): Promise<string> {
    const name = typeof cls === 'string' ? cls : ModelRegistryIndex.getStoreName(cls);
    let resolved = path.resolve(this.config.folder, this.config.namespace, name);
    if (id) {
      resolved = path.resolve(resolved, id.replace(/^[/]/, '').substring(0, 3));
    }
    let folder = resolved;
    if (id) {
      resolved = path.resolve(resolved, `${id}${suffix}`);
      folder = path.dirname(resolved);
    }

    await fs.mkdir(folder, { recursive: true });
    return resolved;
  }

  async #find<T extends ModelType>(cls: Class<T> | string, suffix: Suffix, id?: string): Promise<string> {
    const file = await this.#resolveName(cls, suffix, id);
    if (id && !(await exists(file))) {
      throw new NotFoundError(cls, id);
    }
    return file;
  }

  @PostConstruct()
  initializeClient(): void {
    ModelExpiryUtil.registerCull(this);
  }

  checkExpiry<T extends ModelType>(cls: Class<T>, item: T): T {
    const { expiresAt } = ModelRegistryIndex.getConfig(cls);
    if (expiresAt && ModelExpiryUtil.getExpiryState(cls, item).expired) {
      throw NotFoundError.for(cls, item);
    }
    return item;
  }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    await this.#find(cls, '.json', id);

    const file = await this.#resolveName(cls, '.json', id);

    if (await exists(file)) {
      const content = await fs.readFile(file);
      return this.checkExpiry(cls, await ModelCrudUtil.load(cls, content));
    }

    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const prepped = await ModelCrudUtil.preCreate(cls, item);
    const id = ModelRegistryIndex.get(cls).idSource.get(prepped);
    const file = await this.#resolveName(cls, '.json', id);

    if (await exists(file)) {
      throw new ExistsError(cls, id);
    }

    await fs.writeFile(file, BinaryUtil.binaryArrayToUint8Array(JSONUtil.toBinaryArray(prepped)));
    return prepped;
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    const prepped = await ModelCrudUtil.preUpdate(cls, item, {
      ensureNotSubType: true,
      getOperation: id => this.get(cls, id),
      readBeforeUpdate: this.config.readBeforeUpdate
    });
    const id = ModelRegistryIndex.get(cls).idSource.get(prepped);
    const file = await this.#resolveName(cls, '.json', id);
    await fs.writeFile(file, BinaryUtil.binaryArrayToUint8Array(JSONUtil.toBinaryArray(prepped)));
    return prepped;
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    const prepped = await ModelCrudUtil.preUpsert(cls, item, { ensureNotSubType: true });
    const id = ModelRegistryIndex.get(cls).idSource.get(prepped);

    const file = await this.#resolveName(cls, '.json', id);
    await fs.writeFile(file, BinaryUtil.binaryArrayToUint8Array(JSONUtil.toBinaryArray(prepped)));

    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: PartialWithId<T>): Promise<T> {
    const id = ModelRegistryIndex.get(cls).idSource.get(item);
    const prepared = await ModelCrudUtil.prePartialUpdate(cls, item, {
      ensureNotSubType: true
    });
    const full = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), prepared, id);
    const file = await this.#resolveName(cls, '.json', id);
    await fs.writeFile(file, BinaryUtil.binaryArrayToUint8Array(JSONUtil.toBinaryArray(full)));
    return full;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    id = await ModelCrudUtil.preDelete(cls, id, { ensureNotSubType: true });
    const file = await this.#find(cls, '.json', id);
    await fs.unlink(file);
  }

  async *list<T extends ModelType>(cls: Class<T>, options?: ModelListOptions): AsyncIterable<T[]> {
    for await (const batch of FileModelService.scanFolder(await this.#resolveName(cls, '.json'), '.json', options)) {
      yield ModelCrudUtil.filterOutNotFound(batch.map(([id]) => this.get(cls, id)));
    }
  }

  // Bulk Support
  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkSource<T>, batchSize = 500): Promise<BulkResponse> {
    return ModelBulkUtil.collect(this.processBulkStream(cls, operations, batchSize));
  }

  processBulkStream<T extends ModelType>(cls: Class<T>, operations: BulkSource<T>, batchSize = 500): AsyncIterable<BulkResponse> {
    return ModelBulkUtil.processCrudStream(this, cls, operations, batchSize);
  }

  // Blob
  async upsertBlob(location: string, input: BinaryType, metadata?: BinaryMetadata, overwrite = true): Promise<void> {
    if (
      !overwrite &&
      (await this.getBlobMetadata(location).then(
        () => true,
        () => false
      ))
    ) {
      return;
    }
    const resolved = await BinaryMetadataUtil.compute(input, metadata);
    const file = await this.#resolveName(ModelBlobNamespace, BIN, location);
    await Promise.all([
      BinaryUtil.pipeline(input, createWriteStream(file)),
      BinaryUtil.pipeline(JSONUtil.toBinaryArray(resolved), createWriteStream(file.replace(BIN, META)))
    ]);
  }

  async getBlob(location: string, range?: ByteRange): Promise<Blob> {
    const file = await this.#find(ModelBlobNamespace, BIN, location);
    const metadata = await this.getBlobMetadata(location);
    const final = range ? BinaryMetadataUtil.enforceRange(range, metadata) : undefined;
    return BinaryMetadataUtil.makeBlob(() => createReadStream(file, final), { ...metadata, range: final });
  }

  async getBlobMetadata(location: string): Promise<BinaryMetadata> {
    const file = await this.#find(ModelBlobNamespace, META, location);
    const content = await fs.readFile(file);
    const text: BinaryMetadata = JSONUtil.fromBinaryArray(content);
    return text;
  }

  async deleteBlob(location: string): Promise<void> {
    const file = await this.#resolveName(ModelBlobNamespace, BIN, location);
    if (await exists(file)) {
      await Promise.all([fs.unlink(file), fs.unlink(file.replace('.bin', META))]);
    } else {
      throw new NotFoundError(ModelBlobNamespace, location);
    }
  }

  async updateBlobMetadata(location: string, metadata: BinaryMetadata): Promise<void> {
    const file = await this.#find(ModelBlobNamespace, META, location);
    await BinaryUtil.pipeline(JSONUtil.toBinaryArray(metadata), createWriteStream(file));
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    let deleted = 0;
    for await (const batch of FileModelService.scanFolder(await this.#resolveName(cls, '.json'), '.json')) {
      for (const [_id, file] of batch) {
        try {
          const item = await ModelCrudUtil.load(cls, await fs.readFile(file));
          if (ModelExpiryUtil.getExpiryState(cls, item).expired) {
            await fs.rm(file, { force: true });
            deleted += 1;
          }
        } catch {} // Don't let a single failure stop the process
      }
    }
    return deleted;
  }

  // Storage management
  async createStorage(): Promise<void> {
    const folder = path.resolve(this.config.folder, this.config.namespace);
    await fs.mkdir(folder, { recursive: true });
  }

  async deleteStorage(): Promise<void> {
    await fs.rm(path.resolve(this.config.folder, this.config.namespace), { recursive: true, force: true });
  }

  async truncateModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    await fs.rm(await this.#resolveName(cls), { recursive: true, force: true });
  }

  async deleteModel<T extends ModelType>(cls: Class<T>): Promise<void> {
    await this.truncateModel(cls);
  }

  async truncateBlob(): Promise<void> {
    await fs.rm(await this.#resolveName(ModelBlobNamespace), { recursive: true, force: true });
  }
}
