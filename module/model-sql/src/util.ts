import * as sequelize from 'sequelize';

import { Util, BaseError } from '@travetto/base';
import { WhereClause, SelectClause } from '@travetto/model';
import { Class } from '@travetto/registry';
import { SchemaRegistry } from '@travetto/schema';

const has$And = (o: any): o is ({ $and: WhereClause<any>[]; }) => '$and' in o;
const has$Or = (o: any): o is ({ $or: WhereClause<any>[]; }) => '$or' in o;
const has$Not = (o: any): o is ({ $not: WhereClause<any>; }) => '$not' in o;


const OP_MAP = {
  $nin: (v: any) => ({ $notIn: v }),
  $regex: (v: any) => ({ $regexp: v }),
  $exists: (v: boolean) => (!v ? { $is: null } : { $not: { $is: null } })
}

export class SqlUtil {

  static extractSimple<T>(o: T, path: string = ''): { [key: string]: any } {
    const out: { [key: string]: any } = {};
    const sub = o as { [key: string]: any };
    const keys = Object.keys(sub);
    for (const key of keys) {
      const subpath = `${path}${key}`;
      const v = sub[key];

      if (Util.isPlainObject(v) && !Object.keys(v)[0].startsWith('$')) {
        Object.assign(out, this.extractSimple(v, `${subpath}.`));
      } else {
        out[subpath] = v;
      }
    }
    return out;
  }

  static getSelect<T>(clause: SelectClause<T>) {
    const simp = SqlUtil.extractSimple(clause);
    const include: string[] = [];
    const exclude: string[] = [];
    for (const k of Object.keys(simp)) {
      const nk = k === 'id' ? '_id' : k;
      const v: (1 | 0 | boolean) = simp[k];
      if (v === 0 || v === false) {
        exclude.push(nk);
      } else {
        include.push(nk);
      }
    }
    return [include, exclude];
  }


  static extractWhereClause<T>(o: WhereClause<T>): sequelize.AnyWhereOptions {
    if (has$And(o)) {
      return { $and: o.$and.map(x => this.extractWhereClause<T>(x)) };
    } else if (has$Or(o)) {
      return { $or: o.$or.map(x => this.extractWhereClause<T>(x)) };
    } else if (has$Not(o)) {
      return { $nor: [this.extractWhereClause<T>(o.$not)] };
    } else {
      return this.extractSimple(o);
    }
  }


  static generateSourceSchema<T>(cls: Class<T>): any {
    const schema = SchemaRegistry.getViewSchema(cls);

    const props: any = {};

    for (const field of schema.fields) {
      const conf = schema.schema[field];

      let prop: any;

      if (conf.array && !SchemaRegistry.has(conf.type)) {
        // Build related table for 1 to many

      } else if (conf.type === Number) {
        prop = { type: sequelize.INTEGER };
        if (conf.precision) {
          const [digits, decimals] = conf.precision;
          if (decimals) {
            if ((decimals + digits) < 16) {
              prop = { type: sequelize.DECIMAL(digits, decimals) };
            } else {
              if (digits < 6 && decimals < 9) {
                prop = { type: sequelize.FLOAT(digits, decimals) };
              } else if (digits > 20) {
                prop = { type: sequelize.DOUBLE(digits, decimals) };
              } else {
                prop = { type: sequelize.FLOAT(digits, decimals) };
              }
            }
          }
        }
      } else if (conf.type === Date) {
        prop = { type: sequelize.DATE };
      } else if (conf.type === Boolean) {
        prop = { type: sequelize.BOOLEAN };
      } else if (conf.type === String) {
        prop = { type: sequelize.STRING };
      } else if (SchemaRegistry.has(conf.type)) {
        prop = {
          type: conf.array ? 'nested' : 'object',
          ...this.generateSourceSchema(conf.type)
        };
      } else {
        throw new BaseError('Unable to support nested objects');
      }

      prop.allowNull = !conf.required;


      props[field] = prop;
    }

    return { properties: props, dynamic: false };
  }
}