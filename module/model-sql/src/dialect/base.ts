import { Util } from '@travetto/base';
import { AsyncContext } from '@travetto/context';
import { Class } from '@travetto/registry';
import { FieldConfig, SchemaChangeEvent, SchemaRegistry, ALL_VIEW } from '@travetto/schema';
import { Query, ModelRegistry, SelectClause, BulkResponse } from '@travetto/model';

import { ConnectionSupport } from './connection';
import { Dialect, DeleteWrapper, InsertWrapper } from '../types';
import { SQLUtil, VisitHandler, VisitState, VisitInstanceNode } from '../util';

function makeField(name: string, type: Class, required: boolean, extra: any) {
  return {
    name,
    owner: null,
    type,
    array: false,
    ...(required ? { required: { active: true } } : {}),
    ...extra
  } as FieldConfig;
}

/**
 * Core implementation for specific sql queries, allowing
 * for complete customization depending on dialect.  Should
 * primarily be simple queries.  More complex logic should
 * be moved to the source.
 */
export abstract class SQLDialect implements Dialect {

  ROOT = '_root';
  KEY_LEN = 64;

  idField = makeField('id', String, true, {
    maxlength: { n: 32 },
    minlength: { n: 32 }
  });

  idxField = makeField('__idx', Number, true, {});

  parentPathField = makeField('__parent_path', String, true, {
    maxlength: { n: this.KEY_LEN },
    minlength: { n: this.KEY_LEN },
    required: { active: true }
  });

  pathField = makeField('__path', String, true, {
    maxlength: { n: this.KEY_LEN },
    minlength: { n: this.KEY_LEN },
    required: { active: true }
  });

  constructor(public context: AsyncContext, private ns: string) { }

  generateId() {
    return Util.uuid();
  }

  hash = (name: string) => `SHA2('${name}', ${this.KEY_LEN * 4})`;

  abstract get conn(): ConnectionSupport;

  abstract getColumnDefinition(config: FieldConfig): string;
  abstract resolveValue(field: FieldConfig, value: any): string;
  abstract executeSQL<T>(sql: string): Promise<T>;

  async handleFieldChange(change: SchemaChangeEvent) {
    throw new Error('Method not implemented.');
  }

  async query<T, U = T>(cls: Class<T>, query: Query<T>): Promise<U[]> {
    const select = await this.buildSelect(cls, query.select);
    const from = await this.buildFrom(cls, query);

    return this.executeSQL<U[]>(`
${select}
${from}
GROUP BY ${this.ROOT}.${this.idField.name};`);
  }

  createTableSQL(name: string, fields: FieldConfig[], suffix?: string) {
    return `
CREATE TABLE IF NOT EXISTS ${this.namespace(name)} (
  ${fields
        .map(f => this.getColumnDefinition(f))
        .filter(x => !!x.trim())
        .join(',\n  ')}${suffix ? `,${suffix}` : ''}
);`;
  }

  resolveTable(cls: Class, prefix = '', aliases?: Record<string, string>) {
    const base = ModelRegistry.getBaseCollection(cls);
    let ret = prefix ? `${prefix}_${base}` : base;
    if (aliases) {
      ret = aliases[ret] || ret;
    }
    return ret;
  }

  namespace(name: Class | string) {
    if (typeof name !== 'string') {
      return this.resolveTable(name, this.ns);
    } else {
      return this.ns ? `${this.ns}_${name}` : `${name}`;
    }
  }

  async deleteAndGetCount<T>(cls: Class<T>, query: Query<T>) {
    const res = await this.executeSQL<{ affectedRows: number }>(`
DELETE ${this.ROOT}
${await this.buildFrom(cls, query)}`);
    return res.affectedRows;
  }

  async getCountForQuery<T>(cls: Class<T>, query: Query<T>) {
    const from = await this.buildFrom(cls, query);
    const { total } = await this.executeSQL<{ total: number }>(`
SELECT COUNT(1) as total
${from}
GROUP BY ${this.ROOT}.${this.idField.name}`);
    return total;
  }

  createPrimaryTableSQL(table: string, fields: FieldConfig[]) {
    return this.createTableSQL(table, fields, `
    ${this.getColumnDefinition(this.pathField)},
  UNIQUE KEY(${this.pathField.name}),
  PRIMARY KEY(${this.idField.name})`).replace(new RegExp(`(\\b${this.idField.name}.*)DEFAULT NULL`), (_, s) => `${s} NOT NULL`);
  }

  createSubTableSQL(table: string, fields: FieldConfig[], parentTable: string) {
    return this.createTableSQL(table, fields, `
    ${this.getColumnDefinition(this.parentPathField)}, 
    ${this.getColumnDefinition(this.pathField)},
    PRIMARY KEY (${this.pathField.name}, ${this.parentPathField.name}),
  FOREIGN KEY (${this.parentPathField.name}) REFERENCES ${this.namespace(parentTable)}(${this.pathField.name}) ON DELETE CASCADE`);
  }

  createSimpleTableSQL(table: string, field: FieldConfig, parentTable: string) {
    return this.createTableSQL(`${table}`, [field], `
  ${this.getColumnDefinition(this.parentPathField)}, 
  ${this.getColumnDefinition(this.pathField)},
  ${field.array ? `${this.getColumnDefinition(this.idxField)},` : ''}
  PRIMARY KEY (${this.pathField.name}, ${this.parentPathField.name}),
  FOREIGN KEY (${this.parentPathField.name}) REFERENCES ${this.namespace(parentTable)}(${this.pathField.name}) ON DELETE CASCADE`);
  }

  /**
  * Simple table drop
  */
  dropTableSQL(name: string) {
    return `DROP TABLE IF EXISTS ${this.namespace(name)};`;
  }

  /**
   * Simple insertion
   */
  async insertRows(table: string, columns: string[], rows: string[][]) {
    await this.executeSQL(`
INSERT INTO ${this.namespace(table)} (${columns.join(', ')})
VALUES  ${rows.map(row => `(${row.join(', ')})`).join(',\n')};`);
  }

  /**
   * Simple data base updates
   */
  async updateRows(table: string, data: Record<string, string>, suffix?: string) {
    await this.executeSQL(`
UPDATE ${table} SET
  ${Object.entries(data).map(([k, v]) => `${k}=${v}`).join(', ')}
${suffix}`);
    return -1;
  }

  async deleteByIds(table: string, ids: string[]) {
    const ret = await this.executeSQL<{ affectedRows: number }>(`
DELETE 
FROM ${this.namespace(table)} 
WHERE ${this.idField.name} IN (${ids.join(', ')})`);
    return ret.affectedRows;
  }

  /**
   * Get elements by ids
   */
  async selectRowsByIds<T>(table: string, field: string, ids: string[], select = '*'): Promise<T[]> {
    return this.executeSQL(`
SELECT ${select || '*'}
FROM ${this.namespace(table)}
WHERE ${field} IN (${ids.map(id => `'${id}'`).join(', ')});`);
  }

  /**
   * Bulk processing
   */
  async bulkProcess(
    dels: DeleteWrapper[],
    inserts: InsertWrapper[],
    upserts: InsertWrapper[],
    updates: InsertWrapper[]
  ): Promise<BulkResponse> {

    const out = {
      counts: {
        delete: dels.filter(x => x.level === 1).reduce((acc, el) => acc + el.ids.length, 0),
        error: 0,
        insert: inserts.filter(x => x.level === 1).reduce((acc, el) => acc + el.records.length, 0),
        update: updates.filter(x => x.level === 1).reduce((acc, el) => acc + el.records.length, 0),
        upsert: upserts.filter(x => x.level === 1).reduce((acc, el) => acc + el.records.length, 0)
      },
      errors: [],
      insertedIds: new Map()
    };

    // Full removals
    await Promise.all(dels.map(d => this.deleteByIds(d.table, d.ids)));

    // Adding deletes
    if (upserts.length || updates.length) {
      await Promise.all([
        ...upserts.filter(x => x.level === 1).map(i => {
          const idx = i.fields.indexOf(this.idField.name);
          return this.deleteByIds(i.table, i.records.map(v => v[idx]))
        }),
        ...updates.filter(x => x.level === 1).map(i => {
          const idx = i.fields.indexOf(this.idField.name);
          return this.deleteByIds(i.table, i.records.map(v => v[idx]))
        }),
      ]);
    }

    // Adding
    for (const items of [inserts, upserts, updates]) {
      if (!items.length) {
        continue;
      }
      let lvl = 1; // Add by level
      while (true) {
        const leveled = items.filter(f => f.level === lvl);
        if (!leveled.length) {
          break;
        }
        await Promise.all(leveled.map(iw => this.insertRows(iw.table, iw.fields, iw.records)))
        lvl += 1;
      }
    }

    return out;
  }

  /**
   * Query builders
   */
  async buildFrom<T>(cls: Class<T>, query: Query<T>): Promise<string> {
    const clauses = await SQLUtil.buildSchemaToTableMapping(this, cls);
    const aliases: Record<string, string> = {};
    for (const [k, v] of Object.entries(clauses)) {
      aliases[k] = v.alias;
    }

    const finalWhere = SQLUtil.buildWhere(this, query.where!, cls, aliases);

    return `FROM ${this.namespace(cls)} ${clauses[this.resolveTable(cls)].alias} ${
      Object.entries(clauses)
        .filter(([t, c]) => c.where)
        .map(([t, c]) => `\n  LEFT OUTER JOIN ${this.namespace(t)} ${c.alias} ON\n    ${c.where}`)
        .join('\n')
      }
        ${ finalWhere ? `\nWHERE ${finalWhere}` : ''}`;
  }

  async buildSelect<T>(cls: Class<T>, select?: SelectClause<T>) {
    const clauses = await SQLUtil.buildSchemaToTableMapping(this, cls);

    const tbl = this.resolveTable(cls);

    if (!select || Object.keys(select).length === 0) {
      return `SELECT ${clauses[tbl].alias}.*`;
    }

    const { localMap } = SQLUtil.getFieldsByLocation(cls);

    let toGet = new Set();

    for (const [k, v] of Object.entries(select)) {
      if (!Util.isPlainObject((select as any)[k]) && localMap[k]) {
        if (!v) {
          if (toGet.size === 0) {
            toGet = new Set(SchemaRegistry.get(cls).views[ALL_VIEW].fields);
          }
          toGet.delete(k);
        } else {
          toGet.add(k);
        }
      }
    }

    return `SELECT ${[...toGet].sort().map(c => `${clauses[tbl].alias}.${c}`).join(', ')}`;
  }

  fetchDependents<T>(cls: Class<T>, items: T[], select?: SelectClause<T>) {
    return SQLUtil.fetchDependents(this, cls, items, select);
  }

  visitSchema(cls: Class, handler: VisitHandler<Promise<void>>, state?: VisitState) {
    return SQLUtil.visitSchema(this, SchemaRegistry.get(cls), handler, state);
  }

  visitSchemaSync(cls: Class, handler: VisitHandler<any>, state?: VisitState) {
    return SQLUtil.visitSchemaSync(this, SchemaRegistry.get(cls), handler, state);
  }

  visitSchemaInstance<T>(cls: Class<T>, instance: T, handler: VisitHandler<Promise<any>, VisitInstanceNode>) {
    return SQLUtil.visitSchemaInstance(this, cls, instance, handler);
  }
}