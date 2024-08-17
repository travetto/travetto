import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import os from 'node:os';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

import { Class, TimeSpan, Runtime, asFull } from '@travetto/runtime';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import { Required } from '@travetto/schema';
import {
  ModelCrudSupport, ModelExpirySupport, ModelStorageSupport, ModelType, ModelRegistry,
  NotFoundError, OptionalId, ExistsError,
  ByteRange, ModelBlob, ModelBlobMeta, ModelBlobSupport, ModelBlobUtil
} from '@travetto/model';

import { ModelCrudUtil } from '@travetto/model/src/internal/service/crud';
import { ModelExpiryUtil } from '@travetto/model/src/internal/service/expiry';

type Suffix = '.bin' | '.meta' | '.json' | '.expires';

const BIN = '.bin';
const META = '.meta';
const STREAMS = '__streams';

@Config('model.file')
export class FileModelConfig {
  @Required(false)
  folder: string;
  namespace: string = '.';
  autoCreate?: boolean;
  cullRate?: number | TimeSpan;

  async postConstruct(): Promise<void> {
    this.folder ??= path.resolve(os.tmpdir(), `trv_file_${Runtime.main.name.replace(/[^a-z]/ig, '_')}`);
  }
}

const exists = (f: string): Promise<boolean> => fs.stat(f).then(() => true, () => false);

/**
 * Standard file support
 */
@Injectable()
export class FileModelService implements ModelCrudSupport, ModelBlobSupport, ModelExpirySupport, ModelStorageSupport {

  private static async * scanFolder(folder: string, suffix: string): AsyncGenerator<[id: string, field: string]> {
    for (const sub of await fs.readdir(folder)) {
      for (const file of await fs.readdir(path.resolve(folder, sub))) {
        if (file.endsWith(suffix)) {
          yield [file.replace(suffix, ''), path.resolve(folder, sub, file)];
        }
      }
    }
  }

  idSource = ModelCrudUtil.uuidSource();

  get client(): string {
    return this.config.folder;
  }

  /**
   * The root location for all activity
   */
  constructor(public readonly config: FileModelConfig) { }

  async #resolveName<T extends ModelType>(cls: Class<T> | string, suffix?: Suffix, id?: string): Promise<string> {
    const name = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    let resolved = path.resolve(this.config.folder, this.config.namespace, name);
    if (id) {
      resolved = path.resolve(resolved, id.replace(/^[/]/, '').substring(0, 3));
    }
    let dir = resolved;
    if (id) {
      resolved = path.resolve(resolved, `${id}${suffix}`);
      dir = path.dirname(resolved);
    }

    await fs.mkdir(dir, { recursive: true });
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
    const { expiresAt } = ModelRegistry.get(cls);
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
    await fs.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });

    return prepped;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string): Promise<T> {
    ModelCrudUtil.ensureNotSubType(cls);
    const id = item.id;
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id));
    const file = await this.#resolveName(cls, '.json', item.id);
    await fs.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });
    return asFull<T>(item);
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    const file = await this.#find(cls, '.json', id);
    await fs.unlink(file);
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> {
    for await (const [id] of FileModelService.scanFolder(await this.#resolveName(cls, '.json'), '.json')) {
      try {
        yield await this.get(cls, id);
      } catch (err) {
        if (!(err instanceof NotFoundError)) {
          throw err;
        }
      }
    }
  }

  // Stream
  async upsertBlob(location: string, blob: ModelBlob | Blob): Promise<void> {
    const resolved = blob instanceof ModelBlob ? blob : await ModelBlobUtil.asBlob(blob);
    const file = await this.#resolveName(STREAMS, BIN, location);
    await Promise.all([
      await pipeline(blob.stream(), createWriteStream(file)),
      fs.writeFile(file.replace(BIN, META), JSON.stringify(resolved.meta), 'utf8')
    ]);
  }

  async getBlob(location: string, range?: ByteRange): Promise<ModelBlob> {
    const file = await this.#find(STREAMS, BIN, location);
    const meta = await this.describeBlob(location);
    const final = range ? ModelBlobUtil.enforceRange(range, meta.size) : undefined;
    return new ModelBlob(() => createReadStream(file, final), meta, final);
  }

  async describeBlob(location: string): Promise<ModelBlobMeta> {
    const file = await this.#find(STREAMS, META, location);
    const content = await fs.readFile(file);
    const text: ModelBlobMeta = JSON.parse(content.toString('utf8'));
    return text;
  }

  async deleteBlob(location: string): Promise<void> {
    const file = await this.#resolveName(STREAMS, BIN, location);
    if (await exists(file)) {
      await Promise.all([
        fs.unlink(file),
        fs.unlink(file.replace('.bin', META))
      ]);
    } else {
      throw new NotFoundError('Stream', location);
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>): Promise<number> {
    return ModelExpiryUtil.naiveDeleteExpired(this, cls);
  }

  // Storage management
  async createStorage(): Promise<void> {
    const dir = path.resolve(this.config.folder, this.config.namespace);
    await fs.mkdir(dir, { recursive: true });
  }

  async deleteStorage(): Promise<void> {
    await fs.rm(path.resolve(this.config.folder, this.config.namespace), { recursive: true, force: true });
  }

  async truncate(cls: Class<ModelType>): Promise<void> {
    await fs.rm(await this.#resolveName(cls), { recursive: true, force: true });
  }

  async truncateFinalize(): Promise<void> {
    await fs.rm(await this.#resolveName(STREAMS), { recursive: true, force: true });
  }
}