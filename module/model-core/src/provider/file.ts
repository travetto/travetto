import * as fs from 'fs';
import * as os from 'os';

import { ChangeEvent, Class } from '@travetto/registry';
import { FsUtil, StreamUtil } from '@travetto/boot';
import { AppError, Util } from '@travetto/base';
import { SchemaValidator } from '@travetto/schema';
import { Injectable } from '@travetto/di';

import { ModelCrudSupport } from '../service/crud';
import { ModelStreamSupport, StreamMeta } from '../service/stream';
import { ModelType } from '../types/model';
import { ModelExpirySupport } from '../service/expire';
import { ModelRegistry } from '../registry/registry';
import { Config } from '../../../rest/node_modules/@travetto/config';
import { ModelStorageSupport } from '../service/storage';

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

  private async resolveName<T extends ModelType>(cls: Class<T> | string, id?: string, suffix = '.json') {
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

  private async find<T extends ModelType>(cls: Class<T> | string, id?: string, suffix: string = '.json') {
    const file = await this.resolveName(cls, id, suffix);
    if (id && !(await FsUtil.exists(file))) {
      throw new AppError(`${typeof cls === 'string' ? cls : cls.name} not found with id ${id}`, 'notfound');
    }
    return file;

  }

  uuid() {
    return Util.uuid();
  }

  async get<T extends ModelType>(cls: Class<T>, id: string) {
    await this.find(cls, id);
    return (await this.getOptional(cls, id))!;
  }

  async getOptional<T extends ModelType>(cls: Class<T>, id: string) {
    const file = await this.resolveName(cls, id);
    if (await FsUtil.exists(file)) {
      const content = await StreamUtil.streamToBuffer(fs.createReadStream(file));
      const text = JSON.parse(content.toString('utf8'));
      const result = cls.from(text);
      if (result.postLoad) {
        await result.postLoad();
      }
      return result;
    } else {
      return;
    }
  }

  async create<T extends ModelType>(cls: Class<T>, item: T) {
    if (!item.id) {
      item.id = this.uuid();
    }

    const file = await this.resolveName(cls, item.id);

    if (await FsUtil.exists(file)) {
      throw new AppError(`${cls.name} already exists with id ${item.id}`, 'data');
    }

    return await this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T) {
    await this.find(cls, item.id!);
    return await this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T) {
    if (!item.id) {
      item.id = this.uuid();
    }

    await SchemaValidator.validate(item);

    if (item.prePersist) {
      await item.prePersist();
    }

    const file = await this.resolveName(cls, item.id!);
    await fs.promises.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });

    return item;
  }

  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string) {

    if (view) {
      await SchemaValidator.validate(item, view);
    }

    const existing = await this.get(cls, id);

    item = Object.assign(existing, item);

    if (item.prePersist) {
      await item.prePersist();
    }

    const file = await this.resolveName(cls, item.id!);
    await fs.promises.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });

    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const file = await this.find(cls, id);
    await fs.promises.unlink(file);
  }

  async * list<T extends ModelType>(cls: Class<T>) {
    for await (const [id] of FileModelService.scanFolder(await this.resolveName(cls), '.json')) {
      yield await this.get(cls, id);
    }
  }

  async upsertStream(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta) {
    const file = await this.resolveName('_streams', id);
    await Promise.all([
      fs.promises.writeFile(`${file}.meta`, JSON.stringify(meta), 'utf8'),
      StreamUtil.writeToFile(stream, `${file}.bin`)
    ]);
  }

  async getStream(id: string) {
    const file = await this.find('_streams', id, '.bin');
    return fs.createReadStream(file);
  }

  async getStreamMetadata(id: string) {
    const file = await this.find('_streams', id, '.meta');
    const content = await StreamUtil.streamToBuffer(fs.createReadStream(`${file}.meta`, 'utf8'));
    const text = JSON.parse(content.toString('utf8'));
    return text as StreamMeta;
  }

  async deleteStream(id: string) {
    const file = await this.resolveName('_streams', id);
    if (await FsUtil.exists(`${file}.bin`)) {
      await Promise.all([
        fs.promises.unlink(`${file}.bin`),
        fs.promises.unlink(`${file}.meta`)
      ]);
      return true;
    } else {
      return false;
    }
  }

  async updateExpiry<T extends ModelType>(cls: Class<T>, id: string, ttl: number) {
    const file = await this.find(cls, id, '.expires');
    await fs.promises.writeFile(file, '', 'utf8');
    if (ttl < 1000000) {
      ttl = Date.now() + ttl;
    }
    await fs.promises.utimes(file, ttl, Date.now());
  }

  async getExpiry<T extends ModelType>(cls: Class<T>, id: string) {
    const file = await this.find(cls, id, '.expires');
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
    for await (const [id, file] of FileModelService.scanFolder(await this.resolveName(cls), '.expires')) {
      const stat = await fs.promises.stat(file);
      if (stat.atimeMs < Date.now()) {
        await this.delete(cls, id);
        number += 1;
      }
    }
    return number;
  }

  async createStorage(): Promise<void> {
    await FsUtil.mkdirp(FsUtil.resolveUnix(this.config.folder, this.config.namespace));
  }

  async deleteStorage(): Promise<void> {
    await FsUtil.unlinkRecursiveSync(FsUtil.resolveUnix(this.config.folder, this.config.namespace));
  }
}