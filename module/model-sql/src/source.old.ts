// import {
//   ModelSource,
//   ModelRegistry, ModelCore,
//   PageableModelQuery,
//   ModelQuery, Query,
//   BulkOp, BulkResponse,
//   ValidStringFields,
//   WhereClause, ModelUtil
// } from '@travetto/model';
// import { Class, ChangeEvent } from '@travetto/registry';
// import { AppError, Util } from '@travetto/base';
// import { SchemaChangeEvent } from '@travetto/schema';
// import { AsyncContext, WithAsyncContext } from '@travetto/context';
// import { Injectable } from '@travetto/di';

// import { SQLModelConfig } from './config';
// import { Connected, Transactional, withTransaction } from './connection';
// import { SQLUtil } from './internal/util';
// import { SQLDialect } from './dialect';

// /**
//  * Core for SQL Model Source.  Should not have any direct queries,
//  * but should offload all of that to the dialect, so it can be overridden
//  * as needed.
//  */
// @Injectable()
// export class SQLModelSource extends ModelSource {

//   constructor(
//     public context: AsyncContext,
//     private config: SQLModelConfig,
//     private dialect: SQLDialect
//   ) {
//     super();
//   }

//   private exec<T = any>(sql: string) {
//     return this.dialect.executeSQL<T>(sql);
//   }

//   async postConstruct() {
//     if (this.dialect) {
//       await this.initClient();
//       await this.initDatabase();
//     }
//   }

//   /**
//    * Get a valid connection
//    */
//   get conn() {
//     return this.dialect.conn;
//   }

//   /**
//    * Generate a unique id
//    */
//   generateId() {
//     return this.dialect.generateId();
//   }

//   /**
//    * Create all needed tables for a given class
//    */
//   @Connected()
//   @Transactional()
//   async createTables(cls: Class<any>): Promise<void> {
//     const config = ModelRegistry.get(cls);
//     if (config.subType) {
//       return;
//     }

//     for (const op of this.dialect.getCreateAllTablesSQL(cls)) {
//       await this.exec(op);
//     }
//     const indices = ModelRegistry.get(cls).indices;
//     if (indices) {
//       for (const op of this.dialect.getCreateAllIndicesSQL(cls, indices)) {
//         try {
//           await withTransaction(this, 'isolated', this.exec, [op]);
//         } catch (e) {
//           if (!/\bexists|duplicate\b/i.test(e.message)) {
//             throw e;
//           }
//         }
//       }
//     }
//   }

//   /**
//    * Drop all tables for a given class
//    */
//   @Connected()
//   @Transactional()
//   async dropTables(cls: Class<any>): Promise<void> {
//     for (const op of this.dialect.getDropAllTablesSQL(cls)) {
//       await this.exec(op);
//     }
//   }

//   /**
//    * Initialize connection
//    */
//   async initClient() {
//     if (this.conn.init) {
//       await this.conn.init();
//     }
//   }

//   /**
//    * Initialize database
//    */
//   @WithAsyncContext({})
//   @Connected()
//   @Transactional()
//   async initDatabase() {
//     if (this.config.autoCreate) {
//       for (const cls of ModelRegistry.getClasses()) {
//         await this.createTables(cls);
//       }
//     }
//   }

//   /**
//    * Clear database
//    */
//   @WithAsyncContext({})
//   @Connected()
//   @Transactional()
//   async clearDatabase() {
//     for (const cls of ModelRegistry.getClasses()) {
//       try {
//         await this.dropTables(cls);
//       } catch {
//         // Ignore
//       }
//     }
//   }

//   /**
//    * When the schema changes, update SQL
//    */
//   @WithAsyncContext({})
//   async onSchemaChange(ev: SchemaChangeEvent) {
//     if (this.dialect.handleFieldChange(ev)) {
//       try {
//         await this.onFieldChange(ev);
//       } catch (e) {
//         // Failed to change
//         console.error('Unable to change field', e);
//       }
//     }
//   }

//   /**
//    * When the schema changes, update column
//    */
//   @Connected()
//   @Transactional()
//   async onFieldChange(ev: SchemaChangeEvent) {
//     return this.dialect.handleFieldChange(ev);
//   }

//   /**
//    * On model change
//    */
//   @WithAsyncContext({})
//   async onChange<T extends ModelCore>(e: ChangeEvent<Class<T>>) {
//     if (!this.config.autoCreate) {
//       return;
//     }

//     // Handle ADD/REMOVE
//     if (e.prev && !e.curr) { // Removing
//       await this.dropTables(e.prev);
//     } else if (e.curr && !e.prev) { // Adding
//       await this.createTables(e.curr!);
//     }
//   }

//   postLoad<T extends ModelCore>(cls: Class<T>, o: T) {
//     return o;
//   }

//   prePersist<T extends ModelCore>(cls: Class<T>, o: T) {
//     return o;
//   }

//   /**
//    * Insert a new instance
//    */
//   @Connected()
//   async insert<T = any>(cls: Class<T>, instance: T) {
//     for (const ins of this.dialect.getAllInsertSQL(cls, instance)) {
//       await this.exec(ins);
//     }
//   }

//   /**
//    * Provide autocomplete suggestions
//    */
//   @Connected()
//   async suggest<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<string[]> {
//     const q = ModelUtil.getSuggestFieldQuery(cls, field, prefix, query);
//     const results = await this.query(cls, q);
//     return ModelUtil.combineSuggestResults(cls, field, prefix, results, x => x, query && query.limit);
//   }

//   /**
//    * Produce query facets
//    */
//   @Connected()
//   async facet<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, query?: ModelQuery<T>): Promise<{ key: string, count: number }[]> {
//     const col = this.dialect.ident(field as string);
//     const ttl = this.dialect.ident('count');
//     const key = this.dialect.ident('key');
//     const q = [
//       `SELECT ${col} as ${key}, COUNT(${col}) as ${ttl}`,
//       this.dialect.getFromSQL(cls),
//     ];
//     if (query && query.where) {
//       q.push(
//         this.dialect.getWhereSQL(cls, query.where)
//       );
//     }
//     q.push(
//       `GROUP BY ${col}`,
//       `ORDER BY ${ttl} DESC`
//     );

//     const results = await this.exec(q.join('\n'));
//     return results.records.map(x => {
//       x.count = Util.coerceType(x.count, Number);
//       return x;
//     });
//   }

//   /**
//    * Suggest entities
//    */
//   @Connected()
//   async suggestEntities<T extends ModelCore>(cls: Class<T>, field: ValidStringFields<T>, prefix?: string, query?: PageableModelQuery<T>): Promise<T[]> {
//     const q = ModelUtil.getSuggestQuery(cls, field, prefix, query);
//     const results = await this.query(cls, q);
//     return ModelUtil.combineSuggestResults(cls, field, prefix, results, (a, b) => b, query && query.limit);
//   }

//   @Connected()
//   @Transactional()
//   async save<T extends ModelCore>(cls: Class<T>, model: T, keepId?: boolean): Promise<T> {
//     if (!keepId || !model.id) {
//       model.id = this.dialect.generateId();
//     }

//     await this.insert(cls, model);

//     return model;
//   }

//   @Connected()
//   @Transactional()
//   async saveAll<T extends ModelCore>(cls: Class<T>, models: T[], keepId?: boolean): Promise<T[]> {
//     for (const model of models) {
//       if (!keepId || !model.id) {
//         model.id = this.dialect.generateId();
//       }
//     }

//     await this.bulkProcess(cls, models.map(x => ({ insert: x })));

//     return models;
//   }

//   @Connected()
//   @Transactional()
//   async update<T extends ModelCore>(cls: Class<T>, model: T): Promise<T> {
//     await this.deleteById(cls as Class<T & { id: string }>, model.id!);
//     return await this.save(cls, model, true);
//   }

//   @Connected()
//   @Transactional()
//   async updateAllByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<number> {
//     await this.exec(this.dialect.getUpdateSQL(SQLUtil.classToStack(cls), data, query.where));
//     return -1;
//   }

//   @Connected()
//   @Transactional()
//   async updatePartial<T extends ModelCore>(cls: Class<T>, model: Partial<T>): Promise<T> {
//     const final = await this.getById(cls, model.id!);
//     Util.deepAssign(final, model, 'replace');
//     return this.update(cls, final);
//   }

//   @Connected()
//   @Transactional()
//   async updatePartialByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>, data: Partial<T>): Promise<T> {
//     if (!data.id) {
//       const item = await this.getByQuery(cls, query);
//       this.postLoad(cls, item);
//       data.id = item.id;
//     }
//     return await this.updatePartial(cls, data);
//   }

//   @Connected()
//   async getAllByQuery<T extends ModelCore>(cls: Class<T>, query: PageableModelQuery<T> = {}): Promise<T[]> {
//     const res = await this.query(cls, query);
//     return res;
//   }

//   @Connected()
//   async getByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T> = {}, failOnMany = true): Promise<T> {
//     const res = await this.getAllByQuery(cls, { limit: 2, ...query });
//     return ModelUtil.verifyGetSingleCounts(cls, res, failOnMany);
//   }

//   @Connected()
//   async getById<T extends ModelCore>(cls: Class<T>, id: string): Promise<T> {
//     try {
//       // @ts-ignore
//       const res = await this.getByQuery(cls, { where: { id } } as ModelQuery<T>);
//       return res;
//     } catch (err) {
//       throw new AppError(`Invalid number of results for find by id: ${err.message}`, 'notfound');
//     }
//   }

//   @Connected()
//   @Transactional()
//   async deleteById<T extends ModelCore>(cls: Class<T & { id: string }>, id: string): Promise<number> {
//     return this.deleteByQuery(cls, { where: { id } } as ModelQuery<ModelCore>);
//   }

//   @Connected()
//   async getCountByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
//     return this.dialect.getCountForQuery(cls, query);
//   }

//   @Connected()
//   async query<T extends ModelCore, U = T>(cls: Class<T>, builder: Query<T>): Promise<U[]> {
//     const conf = ModelRegistry.get(cls);

//     // Polymorphism
//     if (conf.subType) {
//       builder.where = (builder.where ?
//         { $and: [builder.where ?? {}, { type: conf.subType }] } :
//         { type: conf.subType }) as WhereClause<T>;
//     }

//     const { records: res } = await this.exec<T>(this.dialect.getQuerySQL(cls, builder));
//     if (ModelRegistry.has(cls)) {
//       await this.dialect.fetchDependents(cls, res, builder && builder.select);
//     }

//     return SQLUtil.cleanResults<T, U>(this.dialect, res);
//   }

//   /**
//    * Compute new ids for bulk operations
//    */
//   async computeInsertedIds<T extends ModelCore>(cls: Class<T>, operations: BulkOp<T>[]) {
//     const addedIds = new Map<number, string>();
//     const toCheck = new Map<string, number>();

//     // Compute ids
//     for (let i = 0; i < operations.length; i++) {
//       const op = operations[i];
//       const target = op.insert || op.upsert;
//       if (target) {
//         if (!target.id) {
//           target.id = this.generateId();
//           addedIds.set(i, target.id!);
//         } else if (op.upsert) {
//           toCheck.set(target.id, i);
//         } else if (op.insert) {
//           addedIds.set(i, target.id!);
//         }
//       }
//     }

//     // Get all upsert ids
//     const all = toCheck.size ?
//       (await this.exec(
//         this.dialect.getSelectRowsByIdsSQL(
//           SQLUtil.classToStack(cls), [...toCheck.keys()], [this.dialect.idField]
//         )
//       )).records : [];

//     for (const el of all) {
//       toCheck.delete(el.id);
//     }

//     for (const [el, idx] of toCheck.entries()) {
//       addedIds.set(idx, el);
//     }

//     return addedIds;
//   }

//   @Connected()
//   @Transactional()
//   async bulkProcess<T extends ModelCore>(cls: Class<T>, operations: BulkOp<T>[]): Promise<BulkResponse> {
//     const deleteOps = operations.map(x => x.delete).filter(x => !!x) as T[];
//     const insertOps = operations.map(x => x.insert).filter(x => !!x) as T[];
//     const upsertOps = operations.map(x => x.upsert).filter(x => !!x) as T[];
//     const updateOps = operations.map(x => x.update).filter(x => !!x) as T[];

//     const insertedIds = await this.computeInsertedIds(cls, operations);

//     const deletes = [{ stack: SQLUtil.classToStack(cls), ids: deleteOps.map(x => x.id!) }].filter(x => !!x.ids.length);
//     const inserts = (await SQLUtil.getInserts(cls, insertOps)).filter(x => !!x.records.length);
//     const upserts = (await SQLUtil.getInserts(cls, upsertOps)).filter(x => !!x.records.length);
//     const updates = (await SQLUtil.getInserts(cls, updateOps)).filter(x => !!x.records.length);

//     const ret = await this.dialect.bulkProcess(deletes, inserts, upserts, updates);
//     ret.insertedIds = insertedIds;
//     return ret;
//   }

//   @Connected()
//   @Transactional()
//   async deleteByQuery<T extends ModelCore>(cls: Class<T>, query: ModelQuery<T>): Promise<number> {
//     return this.dialect.deleteAndGetCount(cls, query);
//   }
// }