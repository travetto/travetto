import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  type Class, type TimeSpan, Runtime, type BinaryMetadata, type ByteRange, type BinaryType,
  BinaryUtil, JSONUtil, BinaryMetadataUtil
} from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import { Required } from '@travetto/schema';
import {
  type ModelCrudSupport, type ModelExpirySupport, type ModelStorageSupport, type ModelType, ModelRegistryIndex,
  NotFoundError, type OptionalId, ExistsError, type ModelBlobSupport, ModelCrudUtil, ModelExpiryUtil
} from '@travetto/model';

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

  async postConstruct(): Promise<void> {
    this.folder ??= path.resolve(os.tmpdir(), `trv_file_${Runtime.main.name.replace(/[^a-z]/ig, '_')}`);
  }
}

const exists = (file: string): Promise<boolean> => fs.stat(file).then(() => true, () => false);

/**
 * Standard file support
 */
@Injectable()
export class FileModelService implements ModelCrudSupport, ModelBlobSupport, ModelExpirySupport, ModelStorageSupport {

  /** @private */
  static async * scanFolder(folder: string, suffix: string): AsyncGenerator<[id: string, field: string]> {
    for (const sub of await fs.readdir(folder)) {
      for (const file of await fs.readdir(path.resolve(folder, sub))) {
        if (file.endsWith(suffix)) {
          yield [file.replace(suffix, ''), path.resolve(folder, sub, file)];
        }
      }
    }
  }

  idSource = ModelCrudUtil.uuidSource();
  config: FileModelConfig;

  constructor(config: FileModelConfig) { this.config = config; }

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

  postConstruct(): void {
    ModelExpiryUtil.registerCull(this);
  }

  checkExpiry<T extends ModelType>(cls: Class<T>, item: T): T {
    const { expiresAt } = ModelRegistryIndex.getConfig(cls);
    if (expiresAt && ModelExpiryUtil.getExpiryState(cls, item).expired) {
      throw new NotFoundError(cls, item.id);
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
    if (!item.id) {
      item.id = this.idSource.create();
    }

    const file = await this.#resolveName(cls, '.json', item.id);

    if (await exists(file)) {
      throw new ExistsError(cls, item.id!);
    }

    return await this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await this.get(cls, item.id);
    return await this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const prepped = await ModelCrudUtil.preStore(cls, item, this);

    const file = await this.#resolveName(cls, '.json', item.id);
    await fs.writeFile(file, BinaryUtil.binaryArrayToUint8Array(JSONUtil.toBinaryArray(item)));

    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const id = item.id;
    const full = await ModelCrudUtil.naivePartialUpdate(cls, () => this.get(cls, id), item, view);
    const file = await this.#resolveName(cls, '.json', full.id);
    await fs.writeFile(file, BinaryUtil.binaryArrayToUint8Array(JSONUtil.toBinaryArray(full)));
    return full;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    const file = await this.#find(cls, '.json', id);
    await fs.unlink(file);
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for await (const [id] of FileModelService.scanFolder(await this.#resolveName(cls, '.json'), '.json')) {
      try {
        yield await this.get(cls, id);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }
    }
  }

  // Blob
  async upsertBlob(location: string, input: BinaryType, metadata?: BinaryMetadata, overwrite = true): Promise<void> {
    if (!overwrite && await this.getBlobMetadata(location).then(() => true, () => false)) {
      return;
    }
    const resolved = await BinaryMetadataUtil.compute(input, metadata);
    const file = await this.#resolveName(ModelBlobNamespace, BIN, location);
    await Promise.all([
      BinaryUtil.pipeline(input, createWriteStream(file)),
      BinaryUtil.pipeline(
        JSONUtil.toBinaryArray(resolved),
        createWriteStream(file.replace(BIN, META)))
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
      await Promise.all([
        fs.unlink(file),
        fs.unlink(file.replace('.bin', META))
      ]);
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
    for await (const [_id, file] of FileModelService.scanFolder(await this.#resolveName(cls, '.json'), '.json')) {
      try {
        const item = await ModelCrudUtil.load(cls, await fs.readFile(file));
        if (ModelExpiryUtil.getExpiryState(cls, item).expired) {
          await fs.rm(file, { force: true });
          deleted += 1;
        }
      } catch { } // Don't let a single failure stop the process
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

  async truncateModel(cls: Class<ModelType>): Promise<void> {
    await fs.rm(await this.#resolveName(cls), { recursive: true, force: true });
  }

  async truncateBlob(): Promise<void> {
    await fs.rm(await this.#resolveName(ModelBlobNamespace), { recursive: true, force: true });
  }
}