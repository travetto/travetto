import { FieldConfig, SchemaConfig } from '../types';
import { SchemaRegistry } from '../registry';
import { Messages } from './messages';
import { Class } from '@encore2/registry';

export type ValidationError = { message: string, path: string, kind: string };

export class SchemaValidator {

  static validateField(field: FieldConfig, value: any) {
    let criteria: string[] = [];

    if (
      (field.type === String && (typeof value !== 'string')) ||
      (field.type === Number && ((typeof value !== 'number') || Number.isNaN(value))) ||
      (field.type === Date && (typeof value !== 'number' && !(value instanceof Date))) ||
      (field.type === Boolean && typeof value !== 'boolean')
    ) {
      criteria.push('type');
      return [{ kind: 'type', type: field.type }]
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

    if (field.enum && !field.enum.values.includes(value)) {
      criteria.push('enum');
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
      let block = (field as any)[key];
      errors.push({ ...block, kind: key, value });
    }
    return errors;
  }

  static prepareErrors(path: string, errs: any[]) {
    let out = [];
    for (let err of errs) {
      let message = err.message || (err.kind === 'match' ? Messages.get(err.re) : Messages.get(err.kind))
      if (message) {
        err.path = path;
        err.message = message.replace(/\{([^}]+)\}/g, (a: string, k: string) => err[k]);
        out.push(err);
      }
    }
    return out;
  }

  private static validateSchema<T>(schema: SchemaConfig, o: T, view: string | undefined, relative: string) {
    let errors: ValidationError[] = [];

    for (let field of Object.keys(schema)) {
      let fieldSchema = schema[field];
      let val = (o as any)[field];
      let path = `${relative}${relative && '.'}${field}`;

      let hasValue = !(val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0));

      if (!hasValue) {
        if (fieldSchema.required) {
          errors.push(...this.prepareErrors(path, [{ kind: 'required' }]));
        }
        continue;
      }

      let { type, array } = fieldSchema.declared;

      let sub: SchemaConfig | undefined;
      if (SchemaRegistry.hasClass(type)) {
        sub = SchemaRegistry.getViewSchema(type, view).schema;
      } else if (type === Object) {
        sub = type as any as SchemaConfig;
      }

      if (array) {
        if (!Array.isArray(val)) {
          errors = errors.concat(this.prepareErrors(path, [{ kind: 'type', type: Array, value: val }]));
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
            errors.push(...this.prepareErrors(`${path}[${i}]`, subErrors));
          }
        }
      } else if (sub) {
        let subErrors = this.validateSchema(sub, val, view, path);
        errors.push(...subErrors);
      } else {
        let fieldErrors = this.validateField(fieldSchema, val);
        errors.push(...this.prepareErrors(path, fieldErrors));
      }
    }

    return errors;
  }

  static async validate<T>(o: T, view?: string): Promise<T> {
    let cls = o.constructor as Class;
    let config = SchemaRegistry.getViewSchema(cls, view);

    let errors = this.validateSchema(config.schema, o, view, '');

    if (errors.length) {
      throw { errors };
    }

    return o;
  }

  static async validateAll<T>(obj: T[], view?: string): Promise<T[]> {
    return await Promise.all<T>((obj || [])
      .map((o, i) => this.validate(o, view)));
  }
}