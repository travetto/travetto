import {
  ModelType,
  BulkOp, BulkResponse, ModelCrudSupport, ModelStorageSupport, ModelBulkSupport, NotFoundError, ModelRegistry,
} from '@travetto/model-core';
import { ModelCrudUtil } from '@travetto/model-core/src/internal/service/crud';
import { Class, ChangeEvent } from '@travetto/registry';
import { SchemaChangeEvent } from '@travetto/schema';
import { AsyncContext } from '@travetto/context';
import { Injectable } from '@travetto/di';
import { Query, WhereClause } from '@travetto/model-query';

import { SQLModelConfig } from './config';
import { Connected, ConnectedIterator, Transactional } from './connection/decorator';
import { SQLUtil } from './internal/util';
import { SQLDialect } from './dialect/base';
import { TableManager } from './table-manager';

/**
 * Core for SQL Model Source.  Should not have any direct queries,
 * but should offload all of that to the dialect, so it can be overridden
 * as needed.
 */
@Injectable()
export class SQLModelService implements ModelCrudSupport, ModelStorageSupport, ModelBulkSupport {

  private manager: TableManager;

  constructor(
    public readonly context: AsyncContext,
    public readonly config: SQLModelConfig,
    public readonly dialect: SQLDialect
  ) {
  }

  /**
   * Compute new ids for bulk operations
   */
  private async computeInsertedIds<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]) {
    const addedIds = new Map<number, string>();
    const toCheck = new Map<string, number>();

    // Compute ids
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const target = op.insert || op.upsert;
      if (target) {
        if (!target.id) {
          target.id = this.uuid();
          addedIds.set(i, target.id!);
        } else if (op.upsert) {
          toCheck.set(target.id, i);
        } else if (op.insert) {
          addedIds.set(i, target.id!);
        }
      }
    }

    // Get all upsert ids
    const all = toCheck.size ?
      (await this.exec(
        this.dialect.getSelectRowsByIdsSQL(
          SQLUtil.classToStack(cls), [...toCheck.keys()], [this.dialect.idField]
        )
      )).records : [];

    for (const el of all) {
      toCheck.delete(el.id);
    }

    for (const [el, idx] of toCheck.entries()) {
      addedIds.set(idx, el);
    }

    return addedIds;
  }

  private exec<T = any>(sql: string) {
    return this.dialect.executeSQL<T>(sql);
  }

  async postConstruct() {
    if (this.dialect) {
      if (this.dialect.conn.init) {
        await this.dialect.conn.init();
      }
      this.manager = new TableManager(this.context, this.config, this.dialect);
    }
  }

  get conn() {
    return this.dialect.conn;
  }

  uuid() {
    return this.dialect.generateId();
  }

  async onSchemaChange(ev: SchemaChangeEvent) {
    await this.manager.onSchemaChange(ev);
  }

  async onModelVisibilityChange<T extends ModelType>(e: ChangeEvent<Class<T>>) {
    await this.manager.onModelChange(e);
  }

  async createStorage() { }
  async deleteStorage() { }

  @Transactional()
  async create<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await ModelCrudUtil.preStore(cls, item, this);
    for (const ins of this.dialect.getAllInsertSQL(cls, item)) {
      await this.exec(ins);
    }
    return item;
  }

  @Transactional()
  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    await this.delete(cls as Class<T & { id: string }>, item.id!);
    return await this.create(cls, item);
  }

  @Transactional()
  async upsert<T extends ModelType>(cls: Class<T>, item: T): Promise<T> {
    try {
      await this.delete(cls as Class<T & { id: string }>, item.id!);
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err;
      }
    }
    return await this.create(cls, item);
  }

  @Transactional()
  async updatePartial<T extends ModelType>(cls: Class<T>, id: string, item: Partial<T>): Promise<T> {
    const final = await ModelCrudUtil.naivePartialUpdate(cls, item, undefined, () => this.get(cls, id));
    return this.update(cls, final);
  }

  @Connected()
  async get<T extends ModelType>(cls: Class<T>, id: string): Promise<T> {
    // @ts-ignore
    const res = await this.query(cls, { where: { id } } as ModelQuery<T>);
    if (res.length === 1) {
      return await ModelCrudUtil.load(cls, res[0]);
    }
    throw new NotFoundError(cls, id);
  }

  @ConnectedIterator()
  async * list<T extends ModelType>(cls: Class<T>) {
    for (const item of await this.query(cls, {})) {
      yield await ModelCrudUtil.load(cls, item);
    }
  }

  @Transactional()
  async delete<T extends ModelType>(cls: Class<T>, id: string) {
    const count = await this.dialect.deleteAndGetCount(cls, { where: { id } } as any);
    if (count === 0) {
      throw new NotFoundError(cls, id);
    }
  }

  @Transactional()
  async processBulk<T extends ModelType>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse> {
    const deleteOps = operations.map(x => x.delete).filter(x => !!x) as T[];
    const insertOps = operations.map(x => x.insert).filter(x => !!x) as T[];
    const upsertOps = operations.map(x => x.upsert).filter(x => !!x) as T[];
    const updateOps = operations.map(x => x.update).filter(x => !!x) as T[];

    const insertedIds = await this.computeInsertedIds(cls, operations);

    const deletes = [{ stack: SQLUtil.classToStack(cls), ids: deleteOps.map(x => x.id!) }].filter(x => !!x.ids.length);
    const inserts = (await SQLUtil.getInserts(cls, insertOps)).filter(x => !!x.records.length);
    const upserts = (await SQLUtil.getInserts(cls, upsertOps)).filter(x => !!x.records.length);
    const updates = (await SQLUtil.getInserts(cls, updateOps)).filter(x => !!x.records.length);

    const ret = await this.dialect.bulkProcess(deletes, inserts, upserts, updates);
    ret.insertedIds = insertedIds;
    return ret;
  }

  @Connected()
  async query<T extends ModelType, U = T>(cls: Class<T>, builder: Query<T>): Promise<U[]> {
    const conf = ModelRegistry.get(cls);

    // Polymorphism
    if (conf.subType) {
      builder.where = (builder.where ?
        { $and: [builder.where ?? {}, { type: conf.subType }] } :
        { type: conf.subType }) as WhereClause<T>;
    }

    const { records: res } = await this.exec<T>(this.dialect.getQuerySQL(cls, builder));
    if (ModelRegistry.has(cls)) {
      await this.dialect.fetchDependents(cls, res, builder && builder.select);
    }

    return SQLUtil.cleanResults<T, U>(this.dialect, res);
  }
}