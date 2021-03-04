import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FsUtil, StreamUtil } from '@travetto/boot';
import { Class, Util } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { ModelCrudSupport } from '../service/crud';
import { ModelStreamSupport, StreamMeta } from '../service/stream';
import { ModelType } from '../types/model';
import { ModelExpirySupport } from '../service/expiry';
import { ModelRegistry } from '../registry/model';
import { ModelStorageSupport } from '../service/storage';
import { ModelCrudUtil } from '../internal/service/crud';
import { ModelExpiryUtil } from '../internal/service/expiry';
import { NotFoundError } from '../error/not-found';
import { ExistsError } from '../error/exists';
import { SubTypeNotSupportedError } from '../error/invalid-sub-type';

type Suffix = '.bin' | '.meta' | '.json' | '.expires';

@Config('model.file')
export class FileModelConfig {
  folder: string;
  namespace: string = '.';
  autoCreate?: boolean;
  cullRate?: number;

  async postConstruct() {
    if (!this.folder) {
      this.folder = FsUtil.resolveUnix(os.tmpdir(), Util.uuid().substring(0, 10));
    }
  }
}

/**
 * Standard file support
 */
@Injectable()
export class FileModelService implements ModelCrudSupport, ModelStreamSupport, ModelExpirySupport, ModelStorageSupport {

  private static async * scanFolder(folder: string, suffix: string) {
    for (const sub of await fs.promises.readdir(folder)) {
      for (const file of await fs.promises.readdir(FsUtil.resolveUnix(folder, sub))) {
        if (file.endsWith(suffix)) {
          yield [file.replace(suffix, ''), FsUtil.resolveUnix(folder, sub, file)] as [id: string, file: string];
        }
      }
    }
  }

  /**
   * The root location for all activity
   *
   * @param folder
   */
  constructor(public config: FileModelConfig) { }

  private async resolveName<T extends ModelType>(cls: Class<T> | string, suffix: Suffix, id?: string) {
    const name = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    let resolved = FsUtil.resolveUnix(this.config.folder, this.config.namespace, name);
    if (id) {
      resolved = FsUtil.resolveUnix(resolved, id.replace(/^[/]/, '').substring(0, 3));
    }
    let dir = resolved;
    if (id) {
      resolved = FsUtil.resolveUnix(resolved, `${id}${suffix}`);
      dir = path.dirname(resolved);
    }
    if (!await FsUtil.exists(dir)) {
      await FsUtil.mkdirp(dir);
    }
    return resolved;
  }

  private async find<T extends ModelType>(cls: Class<T> | string, suffix: Suffix, id?: string) {
    const file = await this.resolveName(cls, suffix, id);
    if (id && !(await FsUtil.exists(file))) {
      throw new NotFoundError(cls, id);
    }
    return file;
  }

  postConstruct() {
    ModelExpiryUtil.registerCull(this);
  }

  checkExpiry<T extends ModelType>(cls: Class<T>, item: T) {
    const { expiresAt } = ModelRegistry.get(cls);
    if (expiresAt && ModelExpiryUtil.getExpiryState(cls, item).expired) {
      throw new NotFoundError(cls, item.id);
    }
    return item;
  }

  uuid() {
    return Util.uuid(32);
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    await this.find(cls, '.json', id);

    const file = await this.resolveName(cls, '.json', id);

    if (await FsUtil.exists(file)) {
      const content = await StreamUtil.streamToBuffer(fs.createReadStream(file));
      return this.checkExpiry(cls, await ModelCrudUtil.load(cls, content));
    }

    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    if (!item.id) {
      item.id = this.uuid();
    }

    const file = await this.resolveName(cls, '.json', item.id);

    if (await FsUtil.exists(file)) {
      throw new ExistsError(cls, item.id);
    }

    return await this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    await this.get(cls, item.id);
    return await this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    item = await ModelCrudUtil.preStore(cls, item, this);

    const file = await this.resolveName(cls, '.json', item.id);
    await fs.promises.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });

    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, item: Partial<T> & { id: string }, view?: string) {
    if (ModelRegistry.get(cls).subType) {
      throw new SubTypeNotSupportedError(cls);
    }
    const id = item.id;
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id));
    const file = await this.resolveName(cls, '.json', item.id);
    await fs.promises.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });

    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const file = await this.find(cls, '.json', id);
    await fs.promises.unlink(file);
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    for await (const [id] of FileModelService.scanFolder(await this.resolveName(cls, '.json'), '.json')) {
      try {
        yield await this.get(cls, id);
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          throw e;
        }
      }
    }
  }

  // Stream
  async upsertStream(location: string, stream: NodeJS.ReadableStream, meta: StreamMeta) {
    const file = await this.resolveName('_streams', '.bin', location);
    await Promise.all([
      StreamUtil.writeToFile(stream, file),
      fs.promises.writeFile(file.replace('.bin', '.meta'), JSON.stringify(meta), 'utf8')
    ]);
  }

  async getStream(location: string) {
    const file = await this.find('_streams', '.bin', location);
    return fs.createReadStream(file);
  }

  async describeStream(location: string) {
    const file = await this.find('_streams', '.meta', location);
    const content = await StreamUtil.streamToBuffer(fs.createReadStream(file));
    const text = JSON.parse(content.toString('utf8'));
    return text as StreamMeta;
  }

  async deleteStream(location: string) {
    const file = await this.resolveName('_streams', '.bin', location);
    if (await FsUtil.exists(file)) {
      await Promise.all([
        fs.promises.unlink(file),
        fs.promises.unlink(file.replace('.bin', '.meta'))
      ]);
    } else {
      throw new NotFoundError('Stream', location);
    }
  }

  // Expiry
  async deleteExpired<T extends ModelType>(cls: Class<T>) {
    const deleted = [];
    for await (const el of this.list(cls)) {
      if (ModelExpiryUtil.getExpiryState(cls, el).expired) {
        deleted.push(this.delete(cls, el.id));
      }
    }
    return (await Promise.all(deleted)).length;
  }

  // Storage mgmt
  async createStorage() {
    await FsUtil.mkdirp(FsUtil.resolveUnix(this.config.folder, this.config.namespace));
  }

  async deleteStorage() {
    await FsUtil.unlinkRecursiveSync(FsUtil.resolveUnix(this.config.folder, this.config.namespace), true);
  }
}