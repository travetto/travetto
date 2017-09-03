import { Class, FieldConfig, SchemaConfig } from '../types';
import { SchemaRegistry } from '../registry';
import { Messages } from './messages';

import { ObjectUtil } from '@encore/util';

type ValidationError = { message: string, path: string };

export class SchemaValidator {

  /*
   static getSchemaRaw(schema: any, view: string = SchemaRegistry.DEFAULT_VIEW): Schema {
     for (let key of Object.keys(schema)) {
       let isArray = Array.isArray(schema[key].type);
       let type = isArray ? schema[key].type[0] : schema[key].type;
       if (SchemaRegistry.schemas.has(type)) {
         schema[key].type = this.getSchema(type, view);
       }
       if (ObjectUtil.isPlainObject(type)) {
         let sub = this.getSchemaRaw(type, view);
         schema[key].type = isArray ? [sub] : sub;
       }
     }
     return schema;
   }
 */

  static validateField(field: FieldConfig, value: any) {
    let criteria: string[] = [];

    if (
      (field.type === String && (typeof value !== 'string')) ||
      (field.type === Number && ((typeof value !== 'number') || Number.isNaN(value))) ||
      (field.type === Date && (typeof value !== 'number' && !(value instanceof Date))) ||
      (field.type === Boolean && typeof value !== 'boolean')
    ) {
      criteria.push('type');
    }

    if (field.match && !field.match.re.test(`${value}`)) {
      criteria.push('match');
    }

    if (field.minlength && `${value}`.length < field.minlength.n) {
      criteria.push('minlength');
    }

    if (field.maxlength && `${value}`.length > field.maxlength.n) {
      criteria.push('maxlength');
    }

    if (field.min) {
      if (typeof field.min.n === 'number') {
        if (typeof value !== 'number') {
          value = parseInt(value, 10);
        }
        if (value < field.min.n) {
          criteria.push('min');
        }
      } else {
        let date = field.min.n.getTime();
        if (typeof value === 'string') {
          value = Date.parse(value);
        }
        if (value < date) {
          criteria.push('min');
        }
      }
    }

    if (field.max) {
      if (typeof field.max.n === 'number') {
        if (typeof value !== 'number') {
          value = parseInt(value, 10);
        }
        if (value > field.max.n) {
          criteria.push('max');
        }
      } else {
        let date = field.max.n.getTime();
        if (typeof value === 'string') {
          value = Date.parse(value);
        }
        if (value > date) {
          criteria.push('max');
        }
      }
    }

    let errors: ValidationError[] = [];
    for (let key of criteria) {
      let block = key === 'type' ? { type: field.type } : (field as any)[key];
      block.kind = key;
      errors.push(block);
    }
    return errors;
  }

  static prepareErrors(path: string, value: any, errs: any[]) {
    let out = [];
    for (let err of errs) {
      let message = err.message || (err.kind === 'match' ? Messages.get(err.re) : Messages.get(err.kind))
      if (message) {
        err.value = value;
        err.path = path;
        err.message = message.replace(/\{([^}]+)\}/g, (a: string, k: string) => err[k]);
        out.push(err);
      }
    }
    return out;
  }

  private static validateSchema<T>(schema: SchemaConfig, o: T, view: string, relative: string) {
    let errors: ValidationError[] = [];

    for (let field of Object.keys(schema)) {
      let fieldSchema = schema[field];
      let val = (o as any)[field];
      let path = `${relative}${relative && '.'}${field}`;

      let hasValue = !(val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0));

      if (!hasValue) {
        if (fieldSchema.required) {
          errors.push(...this.prepareErrors(path, val, [{ kind: 'required' }]));
        }
        continue;
      }

      let { type, array } = fieldSchema.declared;

      let sub: SchemaConfig | undefined;
      if (SchemaRegistry.schemas.has(type)) {
        sub = SchemaRegistry.schemas.get(type)!.views[view].schema;
      } else if (ObjectUtil.isPlainObject(type)) {
        sub = type as any as SchemaConfig;
      }

      if (array) {
        if (!Array.isArray(val)) {
          errors = errors.concat(this.prepareErrors(path, val, [{ kind: 'type', type: Array }]));
          continue;
        }
        if (sub) {
          for (let i = 0; i < val.length; i++) {
            let subErrors = this.validateSchema(sub, val[i], view, `${path}[${i}]`);
            errors = errors.concat(subErrors);
          }
        } else {
          for (let i = 0; i < val.length; i++) {
            let subErrors = this.validateField(fieldSchema, val[i]);
            errors.push(...this.prepareErrors(`${path}[${i}]`, val[i], subErrors));
          }
        }
      } else if (sub) {
        let subErrors = this.validateSchema(sub, val, view, path);
        errors = errors.concat(subErrors);
      }

      let fieldErrors = this.validateField(fieldSchema, val);
      errors.push(...this.prepareErrors(path, val, fieldErrors));
    }

    return errors;
  }

  static async validate<T>(o: T, view: string = SchemaRegistry.DEFAULT_VIEW): Promise<T> {
    let cls = SchemaRegistry.getClass(o);
    let config = SchemaRegistry.schemas.get(cls)!.views[view];

    let errors = this.validateSchema(config.schema, o, view, '');

    if (errors.length) {
      throw { errors };
    }

    return o;
  }

  static async validateAll<T>(obj: T[], view: string = SchemaRegistry.DEFAULT_VIEW): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => this.validate(o, view)));
  }
}