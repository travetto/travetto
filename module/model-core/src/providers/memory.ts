import * as fs from 'fs';
import { Class } from '@travetto/registry';
import { FsUtil, StreamUtil } from '@travetto/boot';
import { AppError, Util } from '@travetto/base';
import { SchemaValidator } from '@travetto/schema';
import { ModelCore } from '../service/core';
import { ModelStreamable, StreamMeta } from '../service/stream';
import { ModelType } from '../types/model';

/**
 * Standard file support
 */
export class MemoryModelService implements ModelCore, ModelStreamable {

  /**
   * The root location for all activity
   *
   * @param folder
   */
  constructor(private folder: string) { }

  private generateId() {
    return Util.uuid();
  }

  private async resolveName<T extends ModelType>(cls: Class<T> | string, id?: string, suffix = '.json') {
    let resolved = FsUtil.resolveUnix(this.folder, typeof cls === 'string' ? cls : cls.name.toLowerCase());
    if (id) {
      resolved = FsUtil.resolveUnix(resolved, id.substring(0, 3));
    }
    await FsUtil.mkdirp(resolved);
    if (id) {
      return FsUtil.resolveUnix(resolved, `${id}${suffix}`);
    } else {
      return resolved;
    }
  }

  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    const result = await this.getOptional(cls, id);
    if (!result) {
      throw new AppError(`${cls.name} not found with id ${id}`, 'notfound');
    }
    return result;
  }

  async getOptional<T extends ModelType>(cls: Class<T>, id: string): Promise<T | undefined> {
    const file = await this.resolveName(cls, id);
    if (await FsUtil.exists(file)) {
      const content = await StreamUtil.streamToBuffer(fs.createReadStream(file, 'utf8'));
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

  async create<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    if (!item.id) {
      item.id = this.generateId();
    }

    const file = await this.resolveName(cls, item.id);

    if (await FsUtil.exists(file)) {
      throw new AppError(`${cls.name} already exists with id ${item.id}`, 'data');
    }

    return await this.upsert(cls, item);
  }

  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await this.get(cls, item.id!);
    return await this.upsert(cls, item);
  }

  async upsert<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await SchemaValidator.validate(item);

    if (item.prePersist) {
      await item.prePersist();
    }

    const file = await this.resolveName(cls, item.id!);
    await fs.promises.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });

    return item;
  }

  async partialUpdate<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>, view?: string): Promise<T> {

    if (view) {
      await SchemaValidator.validate(item, view);
    }

    const existing = await this.get(cls, id);

    item = Util.deepAssign(existing, item);

    if (item.prePersist) {
      await item.prePersist();
    }

    const file = await this.resolveName(cls, item.id!);
    await fs.promises.writeFile(file, JSON.stringify(item), { encoding: 'utf8' });

    return item as T;
  }

  async delete<T extends ModelType>(cls: Class<T>, id: string): Promise<void> {
    const file = await this.resolveName(cls, id);
    if (!(await FsUtil.exists(file))) {
      throw new AppError(`${cls.name} with id of ${id} was not found`, 'notfound');
    }
    await fs.promises.unlink(file);
  }

  async * list<T extends ModelType>(cls: Class<T>): AsyncIterator<T, any, undefined> {
    const folder = await this.resolveName(cls);
    for (const sub of await fs.promises.readdir(folder)) {
      for (const file of await fs.promises.readdir(FsUtil.resolveUnix(folder, sub))) {
        const id = file.replace('.json', '');
        yield await this.get(cls, id);
      }
    }
  }

  async writeStream(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta): Promise<void> {
    const file = await this.resolveName('_streams', id);
    await Promise.all([
      fs.promises.writeFile(`${file}.meta`, JSON.stringify(meta), 'utf8'),
      StreamUtil.writeToFile(stream, `${file}.bin`)
    ]);
  }

  async readStream(id: string): Promise<NodeJS.ReadableStream> {
    const file = await this.resolveName('_streams', id);
    if (!(await FsUtil.exists(`${file}.bin`))) {
      throw new AppError(`Stream with not found with id ${id}`, 'notfound');
    }
    return fs.createReadStream(`${file}.bin`);
  }

  async headStream(id: string): Promise<StreamMeta> {
    const file = await this.resolveName('_streams', id);
    if (!(await FsUtil.exists(`${file}.meta`))) {
      throw new AppError(`Stream with not found with id ${id}`, 'notfound');
    }

    const content = await StreamUtil.streamToBuffer(fs.createReadStream(`${file}.meta`, 'utf8'));
    const text = JSON.parse(content.toString('utf8'));
    return text as StreamMeta;
  }

  async deleteStream(id: string): Promise<boolean> {
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
}