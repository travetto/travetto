import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';

import { StreamUtil } from '@travetto/boot';
import { Class, TimeSpan } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';
import { Required } from '@travetto/schema';

import { ModelCrudSupport } from '../service/crud';
import { ModelStreamSupport, StreamMeta } from '../service/stream';
import { ModelType, OptionalId } from '../types/model';
import { ModelExpirySupport } from '../service/expiry';
import { ModelRegistry } from '../registry/model';
import { ModelStorageSupport } from '../service/storage';
import { ModelCrudUtil } from '../internal/service/crud';
import { ModelExpiryUtil } from '../internal/service/expiry';
import { NotFoundError } from '../error/not-found';
import { ExistsError } from '../error/exists';
import { StreamModel, STREAMS } from '../internal/service/stream';
import { ModelUtil } from '../internal/util';

type Suffix = '.bin' | '.meta' | '.json' | '.expires';

const BIN = '.bin';
const META = '.meta';

@Config('model.file')
export class FileModelConfig {
  @Required(false)
  folder: string;
  namespace: string = '.';
  autoCreate?: boolean;
  cullRate?: number | TimeSpan;

  async postConstruct(): Promise<void> {
    if (!this.folder) {
      this.folder = path.resolve(os.tmpdir(), ModelUtil.uuid().substring(0, 10)).__posix;
    }
  }
}

const exists = (f: string) => fs.stat(f).catch(() => { });

/**
 * Standard file support
 */
@Injectable()
export class FileModelService implements ModelCrudSupport, ModelStreamSupport, ModelExpirySupport, ModelStorageSupport {

  private static async * scanFolder(folder: string, suffix: string): AsyncGenerator<[id: string, field: string]> {
    for (const sub of await fs.readdir(folder)) {
      for (const file of await fs.readdir(path.resolve(folder, sub).__posix)) {
        if (file.endsWith(suffix)) {
          yield [file.replace(suffix, ''), path.resolve(folder, sub, file).__posix];
        }
      }
    }
  }

  get client(): string {
    return this.config.folder;
  }

  /**
   * The root location for all activity
   *
   * @param folder
   */
  constructor(public readonly config: FileModelConfig) { }

  async #resolveName<T extends ModelType>(cls: Class<T> | string, suffix?: Suffix, id?: string): Promise<string> {
    const name = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    let resolved = path.resolve(this.config.folder, this.config.namespace, name).__posix;
    if (id) {
      resolved = path.resolve(resolved, id.replace(/^[/]/, '').substring(0, 3)).__posix;
    }
    let dir = resolved;
    if (id) {
      resolved = path.resolve(resolved, `${id}${suffix}`);
      dir = path.dirname(resolved);
    }
    if (!await exists(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
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

  uuid(): string {
    return ModelUtil.uuid(32);
  }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    await this.#find(cls, '.json', id);

    const file = await this.#resolveName(cls, '.json', id);

    if (await exists(file)) {
      const content = await StreamUtil.streamToBuffer(createReadStream(file));
      return this.checkExpiry(cls, await ModelCrudUtil.load(cls, content));
    }

    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> {
    if (!item.id) {
      item.id = this.uuid();
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

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return item as T;
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
  async upsertStream(location: string, input: Readable, meta: StreamMeta): Promise<void> {
    const file = await this.#resolveName(STREAMS, BIN, location);
    await Promise.all([
      StreamUtil.writeToFile(input, file),
      fs.writeFile(file.replace(BIN, META), JSON.stringify(meta), 'utf8')
    ]);
  }

  async getStream(location: string): Promise<Readable> {
    const file = await this.#find(STREAMS, BIN, location);
    return createReadStream(file);
  }

  async describeStream(location: string): Promise<StreamMeta> {
    const file = await this.#find(STREAMS, META, location);
    const content = await StreamUtil.streamToBuffer(createReadStream(file));
    const text: StreamMeta = JSON.parse(content.toString('utf8'));
    return text;
  }

  async deleteStream(location: string): Promise<void> {
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
    const deleted = [];
    for await (const el of this.list(cls)) {
      if (ModelExpiryUtil.getExpiryState(cls, el).expired) {
        deleted.push(this.delete(cls, el.id));
      }
    }
    return (await Promise.all(deleted)).length;
  }

  // Storage management
  async createStorage(): Promise<void> {
    const dir = path.resolve(this.config.folder, this.config.namespace).__posix;
    await fs.mkdir(dir, { recursive: true });
  }

  async deleteStorage(): Promise<void> {
    await fs.rm(path.resolve(this.config.folder, this.config.namespace).__posix, { recursive: true, force: true });
  }

  async truncateModel(cls: Class<ModelType>): Promise<void> {
    await fs.rm(await this.#resolveName(cls === StreamModel ? STREAMS : cls), { recursive: true, force: true });
  }
}