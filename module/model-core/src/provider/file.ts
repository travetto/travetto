import * as fs from 'fs';
import * as os from 'os';

import { Class } from '@travetto/registry';
import { FsUtil, StreamUtil } from '@travetto/boot';
import { Util } from '@travetto/base';
import { Injectable } from '@travetto/di';
import { Config } from '@travetto/config';

import { ModelCrudSupport } from '../service/crud';
import { ModelStreamSupport, StreamMeta } from '../service/stream';
import { ModelType } from '../types/model';
import { ModelExpirySupport } from '../service/expire';
import { ModelRegistry } from '../registry/registry';
import { ModelStorageSupport } from '../service/storage';
import { ModelCrudUtil } from '../internal/service/crud';
import { ModelExpiryUtil } from '../internal/service/expiry';
import { NotFoundError } from '../error/not-found';
import { ExistsError } from '../error/exists';

type Suffix = '.bin' | '.meta' | '.json' | '.expires';

@Config('model.file')
export class FileModelConfig {
  folder: string;
  namespace: string = '.';
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
  constructor(private config: FileModelConfig) { }

  private async resolveName<T extends ModelType>(cls: Class<T> | string, suffix: Suffix, id?: string) {
    const name = typeof cls === 'string' ? cls : ModelRegistry.getStore(cls);
    let resolved = FsUtil.resolveUnix(this.config.folder, this.config.namespace, name);
    if (id) {
      resolved = FsUtil.resolveUnix(resolved, id.substring(0, 3));
    }
    if (!await FsUtil.exists(resolved)) {
      await FsUtil.mkdirp(resolved);
    }
    if (id) {
      return FsUtil.resolveUnix(resolved, `${id}${suffix}`);
    } else {
      return resolved;
    }
  }

  private async find<T extends ModelType>(cls: Class<T> | string, suffix: Suffix, id?: string) {
    const file = await this.resolveName(cls, suffix, id);
    if (id && !(await FsUtil.exists(file))) {
      throw new NotFoundError(cls, id);
    }
    return file;

  }

  uuid() {
    return Util.uuid(32);
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    await this.find(cls, '.json', id);

    const file = await this.resolveName(cls, '.json', id);

    if (await FsUtil.exists(file)) {
      const content = await StreamUtil.streamToBuffer(fs.createReadStream(file));
      return await ModelCrudUtil.load(cls, content);
    }
    throw new NotFoundError(cls, id);
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    if (!item.id) {
      item.id = this.uuid();
    }

    const file = await this.resolveName(cls, '.json', item.id);

    if (await FsUtil.exists(file)) {
      throw new ExistsError(cls, item.id!);
    }

    return await this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    await this.find(cls, '.json', item.id!);
    return await this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    item = await ModelCrudUtil.preStore(cls, item, this);

    const file = await this.resolveName(cls, '.json', item.id!);
    await fs.promises.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });

    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {
    item = await ModelCrudUtil.naivePartialUpdate(cls, item, view, () => this.get(cls, id));
    const file = await this.resolveName(cls, '.json', item.id!);
    await fs.promises.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });

    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const file = await this.find(cls, '.json', id);
    await fs.promises.unlink(file);
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    for await (const [id] of FileModelService.scanFolder(await this.resolveName(cls, '.json'), '.json')) {
      const res = await this.get(cls, id).catch(err => { });
      if (res) {
        yield res;
      }
    }
  }

  async upsertStream(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta) {
    const file = await this.resolveName('_streams', '.bin', id);
    await Promise.all([
      StreamUtil.writeToFile(stream, file),
      fs.promises.writeFile(file.replace('.bin', '.meta'), JSON.stringify(meta), 'utf8')
    ]);
  }

  async getStream(id: string) {
    const file = await this.find('_streams', '.bin', id);
    return fs.createReadStream(file);
  }

  async getStreamMetadata(id: string) {
    const file = await this.find('_streams', '.meta', id);
    const content = await StreamUtil.streamToBuffer(fs.createReadStream(file));
    const text = JSON.parse(content.toString('utf8'));
    return text as StreamMeta;
  }

  async deleteStream(id: string) {
    const file = await this.resolveName('_streams', '.bin', id);
    if (await FsUtil.exists(file)) {
      await Promise.all([
        fs.promises.unlink(file),
        fs.promises.unlink(file.replace('.bin', '.meta'))
      ]);
    } else {
      throw new NotFoundError('Stream', id);
    }
  }

  async updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number) {
    const file = await (await this.find(cls, '.json', id)).replace('.json', '.expires');
    await fs.promises.writeFile(file, '', 'utf8');
    await fs.promises.utimes(file, ModelExpiryUtil.getExpiresAt(ttl), new Date());
  }

  async getExpiry<T extends ModelType>(cls: Class<T>, id: string) {
    const file = await this.find(cls, '.expires', id);
    const stat = await fs.promises.stat(file);
    const expiresAt = stat.atimeMs;
    const issuedAt = stat.mtimeMs;
    const maxAge = expiresAt - issuedAt;
    const expired = expiresAt < Date.now();
    return { expiresAt, issuedAt, maxAge, expired };
  }

  async upsertWithExpiry<T extends ModelType>(cls: Class<T>, item: T, ttl: number) {
    item = await this.upsert(cls, item);
    await this.updateExpiry(cls, item.id!, ttl);
    return item;
  }

  async deleteExpired<T extends ModelType>(cls: Class<T>) {
    let number = 0;
    for await (const [id, file] of FileModelService.scanFolder(await this.resolveName(cls, '.expires'), '.expires')) {
      const stat = await fs.promises.stat(file);
      if (stat.atimeMs < Date.now()) {
        await this.delete(cls, id);
        number += 1;
      }
    }
    return number;
  }

  async createStorage() {
    await FsUtil.mkdirp(FsUtil.resolveUnix(this.config.folder, this.config.namespace));
  }

  async deleteStorage() {
    await FsUtil.unlinkRecursiveSync(FsUtil.resolveUnix(this.config.folder, this.config.namespace), false);
  }
}